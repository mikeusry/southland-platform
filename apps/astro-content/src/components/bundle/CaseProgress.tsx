/**
 * CaseProgress - Visual 4-slot progress indicator for the case builder.
 * Shows filled/empty slots as the customer selects gallon products.
 */

interface Props {
  filled: number
  total?: number
}

export default function CaseProgress({ filled, total = 4 }: Props) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-3 w-3 rounded-full border-2 transition-colors ${
              i < filled
                ? 'border-shopify-link bg-shopify-link'
                : 'border-gray-300 bg-white'
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-medium text-shopify-text">
        {filled} of {total} selected
      </span>
      {filled === total && (
        <span className="text-sm font-medium text-shopify-link">
          Case complete!
        </span>
      )}
    </div>
  )
}
