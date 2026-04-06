import type { JSXElement } from '@stewie-js/core'
import { LinkButton } from './lib/link-button.js'
import { Card } from './lib/card.js'
import { Icon } from './lib/icon.js'

export function HomeHero(): JSXElement {
  return (
    <section class="home-hero">
      <div class="home-hero__copy">
        <div class="section-eyebrow">Stewie demo</div>
        <h1 class="hero-title">A field guide to the Rick and Morty multiverse.</h1>
        <p class="hero-body">
          Browse characters, inspect episode casts, and move between pages with fine-grained updates and a small
          reactive runtime.
        </p>
        <div class="hero-actions">
          <LinkButton to="/characters" variant="primary">
            <span class="button__content">
              <Icon name="people" />
              <span>Explore characters</span>
            </span>
          </LinkButton>
          <LinkButton to="/episodes" variant="secondary">
            <span class="button__content">
              <Icon name="episode" />
              <span>Browse episodes</span>
            </span>
          </LinkButton>
        </div>
      </div>
      <Card class="hero-panel">
        <div class="hero-panel__eyebrow">Signal check</div>
        <div class="hero-panel__title">Client-side GraphQL, query-param routes, and lazy pages.</div>
        <ul class="hero-panel__list">
          <li>Characters and episodes fetched live from the public API</li>
          <li>List pages with filters, pagination, and empty states</li>
          <li>Detail pages driven by `?id=` query parameters</li>
        </ul>
      </Card>
    </section>
  )
}
