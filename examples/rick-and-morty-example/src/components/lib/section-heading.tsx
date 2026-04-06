import type { JSXElement } from '@stewie-js/core'

export function SectionHeading({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: JSXElement | null
}): JSXElement {
  return (
    <div class="section-heading">
      <div>
        {eyebrow ? <div class="section-eyebrow">{eyebrow}</div> : null}
        <h2 class="section-title">{title}</h2>
        {description ? <p class="section-description">{description}</p> : null}
      </div>
      {action ?? null}
    </div>
  )
}
