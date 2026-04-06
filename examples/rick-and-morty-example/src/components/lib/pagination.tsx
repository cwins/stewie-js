import type { JSXElement } from '@stewie-js/core'
import { Button } from './button.js'

export function Pagination({
  page,
  totalPages,
  onPrevious,
  onNext
}: {
  page: number
  totalPages: number
  onPrevious: () => void
  onNext: () => void
}): JSXElement {
  return (
    <div class="pagination">
      <Button variant="secondary" size="sm" onClick={onPrevious} disabled={page <= 1}>
        Previous
      </Button>
      <span class="pagination__label">
        Page {page} of {Math.max(totalPages, 1)}
      </span>
      <Button variant="secondary" size="sm" onClick={onNext} disabled={page >= totalPages}>
        Next
      </Button>
    </div>
  )
}
