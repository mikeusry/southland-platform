import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { visibleProductQuestions } from './product-questions'

const toteQuestion = {
  content: 'Can we get this product in a larger container ',
  author: 'Wes P.',
  publicReply: {
    content:
      "Hi Wes, you sure can! We also sell Big Ole Bird in a tote for people who need it in bulk. If that's of interest to you, contact Allen Reynolds at allen@southlandorganics.com and he will be able to get pricing for you. Thanks for your question!",
  },
}

const otherQuestion = {
  content: 'once solution is mixed how long is it good to run or is there an expiration time',
  author: 'Elkinsfarm1',
  publicReply: {
    content:
      'It is good for 24 hours but as long as it is in a medicator with open air it should be good.',
  },
}

describe('visibleProductQuestions', () => {
  it('removes the whole Big Ole Bird tote Q&A on both product URLs', () => {
    for (const handle of ['poultry-probiotic', 'big-ole-bird']) {
      const visible = visibleProductQuestions(handle, [otherQuestion, toteQuestion])
      assert.deepEqual(visible, [otherQuestion])
      assert.equal(
        visible.some((question) => question.publicReply.content.includes('tote')),
        false
      )
    }
  })

  it('leaves the same reply in place on every other product', () => {
    const visible = visibleProductQuestions('litter-life', [toteQuestion, otherQuestion])
    assert.deepEqual(visible, [toteQuestion, otherQuestion])
  })
})
