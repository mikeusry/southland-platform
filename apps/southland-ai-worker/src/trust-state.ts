import type { IdentityLevel } from './types'

/**
 * Trust-State Machine for Write Tool Workflows
 *
 * States: needs_identity → needs_scope → needs_policy_check →
 *         needs_confirmation → ready_to_execute → executed
 *                                              ↘ blocked → escalate
 *
 * Write tools NEVER execute from email channel — chat only.
 */

export type TrustState =
  | 'needs_identity'
  | 'needs_scope'
  | 'needs_policy_check'
  | 'needs_confirmation'
  | 'ready_to_execute'
  | 'executed'
  | 'blocked'
  | 'escalate'

export interface WriteWorkflow {
  tool: string
  state: TrustState
  scope?: {
    subscription_id?: string
    product_name?: string
    next_billing?: string
  }
  policy_result?: {
    allowed: boolean
    reason: string
  }
  confirmation_message?: string
  idempotency_key?: string
}

/**
 * Advance the trust-state machine based on current state and inputs
 */
export function advanceWriteWorkflow(
  workflow: WriteWorkflow,
  identityLevel: IdentityLevel,
  userResponse?: string,
  channel?: string
): { workflow: WriteWorkflow; response: string } {
  // Channel gate — write tools are chat-only
  if (channel === 'email') {
    return {
      workflow: { ...workflow, state: 'blocked' },
      response: "I can't make account changes via email. Please use our chat widget or call (800) 608-3755.",
    }
  }

  switch (workflow.state) {
    case 'needs_identity': {
      if (identityLevel !== 'verified-strong') {
        return {
          workflow,
          response: "To make changes to your account, I need to verify your identity. Can you provide your email address and the last 4 digits of the card on file?",
        }
      }
      return {
        workflow: { ...workflow, state: 'needs_scope' },
        response: '', // Auto-advance
      }
    }

    case 'needs_scope': {
      if (!workflow.scope?.subscription_id) {
        return {
          workflow,
          response: "Which subscription would you like to modify? Please let me know the product name or subscription details.",
        }
      }
      return {
        workflow: { ...workflow, state: 'needs_policy_check' },
        response: '', // Auto-advance
      }
    }

    case 'needs_policy_check': {
      // Policy checks happen server-side during tool execution
      return {
        workflow: { ...workflow, state: 'needs_confirmation' },
        response: '', // Auto-advance
      }
    }

    case 'needs_confirmation': {
      const msg = workflow.confirmation_message || `Are you sure you want to ${workflow.tool.replace(/_/g, ' ')}?`

      if (!userResponse) {
        return { workflow, response: `${msg} Reply "yes" to confirm.` }
      }

      const confirmed = ['yes', 'confirm', 'ok', 'sure', 'do it', 'go ahead', 'proceed'].some(
        (w) => userResponse.toLowerCase().includes(w)
      )

      if (confirmed) {
        return {
          workflow: {
            ...workflow,
            state: 'ready_to_execute',
            idempotency_key: `idem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          },
          response: '', // Will execute
        }
      }

      // Customer declined
      return {
        workflow: { ...workflow, state: 'blocked' },
        response: "No problem, I won't make any changes. Is there anything else I can help with?",
      }
    }

    case 'ready_to_execute':
      return { workflow: { ...workflow, state: 'executed' }, response: '' }

    case 'executed':
      return { workflow, response: 'This action has already been completed.' }

    case 'blocked':
      return { workflow, response: "This action was cancelled. Let me know if you'd like help with anything else." }

    case 'escalate':
      return { workflow, response: "I'll connect you with our team to handle this. You'll hear back shortly." }

    default:
      return { workflow, response: '' }
  }
}
