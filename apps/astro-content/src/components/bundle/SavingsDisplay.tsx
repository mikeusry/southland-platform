/**
 * SavingsDisplay - Shows running savings calculation as the customer
 * fills their case. Exact product discount + estimated shipping savings.
 */

interface Props {
  subtotal: number
  discountPercent: number
  filled: number
  total?: number
}

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export default function SavingsDisplay({
  subtotal,
  discountPercent,
  filled,
  total = 4,
}: Props) {
  const caseComplete = filled === total
  const discountAmount = caseComplete ? subtotal * (discountPercent / 100) : 0

  if (filled === 0) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-shopify-text">
          Subtotal ({filled} gallon{filled !== 1 ? 's' : ''})
        </span>
        <span className="font-medium text-shopify-text">
          {formatMoney(subtotal)}
        </span>
      </div>

      {caseComplete ? (
        <>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="font-medium text-shopify-link">
              Case discount ({discountPercent}% off)
            </span>
            <span className="font-medium text-shopify-link">
              -{formatMoney(discountAmount)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="italic text-brand-gray-dark">
              Estimated shipping savings
            </span>
            <span className="italic text-brand-gray-dark">
              Ships as 1 case
            </span>
          </div>
          <p className="mt-1 text-xs text-brand-gray-dark">
            Actual shipping calculated at checkout.
          </p>
          <div className="mt-3 border-t border-gray-200 pt-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-shopify-title">
                Case total
              </span>
              <span className="text-lg font-bold text-shopify-title">
                {formatMoney(subtotal - discountAmount)}
              </span>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-brand-gray-dark">
          Add {total - filled} more gallon{total - filled !== 1 ? 's' : ''} to
          unlock your case discount ({discountPercent}% off + shipping savings)
        </p>
      )}
    </div>
  )
}
