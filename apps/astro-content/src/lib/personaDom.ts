/**
 * Shared DOM utilities for persona selection UI.
 *
 * Used by both the Hero persona cards and the DecisionEngine component
 * to avoid duplicating click-handler / highlight logic.
 */

import { setPersona, getPersonaId } from './persona'
import type { PersonaId, PersonaData } from './persona'

/**
 * Attach click handlers to all `[data-persona-select]` elements within `root`,
 * and highlight the active persona card (if one is already stored).
 */
export function attachPersonaHandlers(
  root: HTMLElement,
  source: PersonaData['source'] = 'decision_engine',
  scrollTarget: string = 'featured-products',
): void {
  root.querySelectorAll<HTMLElement>('[data-persona-select]').forEach((el) => {
    el.addEventListener('click', () => {
      const personaId = el.dataset.personaSelect as PersonaId
      if (!personaId) return

      setPersona(personaId, source)

      // Visual feedback on the clicked card
      el.classList.add('ring-2', 'ring-offset-2', 'ring-green-500')

      // Track via point.dog pixel
      if ((window as any).pdPixel) {
        ;(window as any).pdPixel.track('persona_path_selected', {
          persona_id: personaId,
          source,
          page: window.location.pathname,
        })
      }

      // Track via GTM dataLayer
      if ((window as any).dataLayer) {
        ;(window as any).dataLayer.push({
          event: 'persona_path_selected',
          persona_id: personaId,
          source,
        })
      }

      // Smooth-scroll to target section
      document.getElementById(scrollTarget)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  })

  highlightActivePersona(root)
}

/**
 * Add a ring highlight to the persona card matching the stored persona.
 */
export function highlightActivePersona(root: HTMLElement): void {
  const personaId = getPersonaId()
  if (!personaId || personaId === 'general') return

  root.querySelectorAll<HTMLElement>('[data-persona-id]').forEach((el) => {
    if (el.dataset.personaId === personaId) {
      el.classList.add('ring-2', 'ring-offset-2', 'ring-green-500')
    }
  })
}
