import type { Env, IdentityLevel } from './types'

// ─── Tool Registry ──────────────────────────────────────────────────────────
// Read tools: single call → inject into response
// Write tools: trust-state workflow (Phase 4)

export interface ToolDefinition {
  name: string
  description: string
  requires: IdentityLevel
  type: 'read' | 'write'
  channel?: 'chat_only' // write tools restricted to chat channel
  parameters: Record<string, 'string' | 'number' | 'boolean'>
}

export interface ToolResult {
  status: 'success' | 'error' | 'not_found' | 'unauthorized'
  data: Record<string, unknown>
  safe_to_show: boolean
  tool_call_id: string
  freshness: 'live' | 'cached'
}

// ─── Read Tools ─────────────────────────────────────────────────────────────

export const READ_TOOLS: ToolDefinition[] = [
  {
    name: 'get_order_status',
    description: 'Look up order status, tracking number, and shipment details by order number',
    requires: 'verified-light',
    type: 'read',
    parameters: { order_number: 'string' },
  },
  {
    name: 'get_tracking',
    description: 'Get live carrier tracking details (current status, location, estimated delivery)',
    requires: 'verified-light',
    type: 'read',
    parameters: { tracking_number: 'string' },
  },
  {
    name: 'get_subscription',
    description: 'Get subscription status, next billing date, and product details',
    requires: 'verified-light',
    type: 'read',
    parameters: { customer_id: 'string' },
  },
  {
    name: 'check_return_eligibility',
    description: 'Check if an order is eligible for return (within 30 days, delivered, not already returned)',
    requires: 'verified-light',
    type: 'read',
    parameters: { order_number: 'string' },
  },
]

// ─── Write Tools (Phase 4) ──────────────────────────────────────────────────

export const WRITE_TOOLS: ToolDefinition[] = [
  {
    name: 'skip_subscription',
    description: 'Skip the next subscription delivery',
    requires: 'verified-strong',
    type: 'write',
    channel: 'chat_only',
    parameters: { subscription_id: 'string' },
  },
  {
    name: 'cancel_subscription',
    description: 'Cancel a subscription permanently',
    requires: 'verified-strong',
    type: 'write',
    channel: 'chat_only',
    parameters: { subscription_id: 'string', reason: 'string' },
  },
]

export const ALL_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS]

// ─── Tool Executor ──────────────────────────────────────────────────────────

export async function executeTool(
  env: Env,
  toolName: string,
  args: Record<string, string>,
  identityLevel: IdentityLevel
): Promise<ToolResult> {
  const tool = ALL_TOOLS.find((t) => t.name === toolName)
  const toolCallId = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  if (!tool) {
    return { status: 'error', data: { error: `Unknown tool: ${toolName}` }, safe_to_show: false, tool_call_id: toolCallId, freshness: 'live' }
  }

  // Identity gate
  const levelRank: Record<IdentityLevel, number> = { anonymous: 0, claimed: 1, 'verified-light': 2, 'verified-strong': 3 }
  if (levelRank[identityLevel] < levelRank[tool.requires]) {
    return { status: 'unauthorized', data: { error: `Requires ${tool.requires} identity` }, safe_to_show: false, tool_call_id: toolCallId, freshness: 'live' }
  }

  // Execute via Nexus API
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (env.NEXUS_API_KEY) headers['Authorization'] = `Bearer ${env.NEXUS_API_KEY}`

  try {
    const res = await fetch(`${env.NEXUS_API_URL}/api/ai/tools/${toolName.replace(/_/g, '-')}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
    })

    if (!res.ok) {
      const text = await res.text()
      return { status: 'error', data: { error: text }, safe_to_show: false, tool_call_id: toolCallId, freshness: 'live' }
    }

    const data = (await res.json()) as Record<string, unknown>
    return { status: 'success', data, safe_to_show: true, tool_call_id: toolCallId, freshness: 'live' }
  } catch (err) {
    return { status: 'error', data: { error: String(err) }, safe_to_show: false, tool_call_id: toolCallId, freshness: 'live' }
  }
}

// ─── Tool Selection Prompt ──────────────────────────────────────────────────
// Ask LLM to select a tool based on the customer's question

export function buildToolSelectionPrompt(tools: ToolDefinition[]): string {
  const toolDescriptions = tools
    .map((t) => `- ${t.name}: ${t.description} (params: ${Object.keys(t.parameters).join(', ')})`)
    .join('\n')

  return `You are a tool router. Given the customer's question and available tools, decide:
1. If a tool would help answer the question, output JSON: {"tool": "tool_name", "arguments": {"param": "value"}}
2. If no tool is needed (knowledge question), output JSON: {"tool": "none"}
3. If you need more information, output JSON: {"tool": "ask_user", "question": "What is your order number?"}

Available tools:
${toolDescriptions}

Rules:
- Only select a tool if the customer is asking about their specific order, tracking, subscription, or return.
- For general product questions, use "none".
- Extract order numbers, tracking numbers from the conversation if mentioned.
- Output ONLY valid JSON, nothing else.`
}
