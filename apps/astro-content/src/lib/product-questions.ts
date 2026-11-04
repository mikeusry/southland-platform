/**
 * Customer questions rendered under reviews are published in Nexus.
 * A published reply can still be wrong. Drop the whole question, reply included.
 */

export interface AnsweredQuestion {
  publicReply: { content: string } | null
}

/**
 * Big Ole Bird is not sold in a tote or in bulk. The published reply that says
 * otherwise must not render on either product URL.
 */
const BULK_TOTE_REPLY = 'We also sell Big Ole Bird in a tote for people who need it in bulk.'

const BIG_OLE_BIRD_HANDLES = new Set(['poultry-probiotic', 'big-ole-bird'])

export function visibleProductQuestions<T extends AnsweredQuestion>(
  shopifyHandle: string,
  questions: T[]
): T[] {
  if (!BIG_OLE_BIRD_HANDLES.has(shopifyHandle)) return questions
  return questions.filter((question) => {
    const answer = question.publicReply?.content ?? ''
    return !answer.includes(BULK_TOTE_REPLY)
  })
}
