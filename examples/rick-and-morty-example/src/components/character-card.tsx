import type { JSXElement } from '@stewie-js/core'
import type { Character } from '../api/types.js'
import { Badge } from './lib/badge.js'
import { Card } from './lib/card.js'
import { LinkButton } from './lib/link-button.js'
import { statusTone, titleCase } from '../utils/format.js'

export function CharacterCard({ character, compact = false }: { character: Character; compact?: boolean }): JSXElement {
  return (
    <Card class={compact ? 'character-card character-card--compact' : 'character-card'} interactive>
      <div class="character-card__media">
        <img class="character-card__image" src={character.image} alt={character.name} />
      </div>
      <div class="character-card__body">
        <div class="character-card__header">
          <h3 class="character-card__title">{character.name}</h3>
          <Badge tone={statusTone(character.status)}>{titleCase(character.status)}</Badge>
        </div>
        <p class="character-card__meta">
          {character.species}
          {character.type ? ` • ${character.type}` : ''}
        </p>
        <p class="character-card__detail">Last seen: {character.location.name}</p>
        <LinkButton to={`/character?id=${character.id}`} size="sm">
          View profile
        </LinkButton>
      </div>
    </Card>
  )
}
