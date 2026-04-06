import type { JSXElement } from '@stewie-js/core'
import type { Character } from '../api/types.js'
import { Badge } from './lib/badge.js'
import { Card } from './lib/card.js'
import { StatCard } from './lib/stat-card.js'
import { statusTone, titleCase } from '../utils/format.js'

export function CharacterDetailHero({ character }: { character: Character }): JSXElement {
  return (
    <div class="detail-stack">
      <Card class="detail-hero">
        <img class="detail-hero__portrait" src={character.image} alt={character.name} />
        <div class="detail-hero__content">
          <div class="detail-hero__eyebrow">Character profile</div>
          <h1 class="detail-hero__title">{character.name}</h1>
          <div class="detail-hero__badges">
            <Badge tone={statusTone(character.status)}>{titleCase(character.status)}</Badge>
            <Badge tone="meta">{character.species}</Badge>
            <Badge tone="meta">{character.gender || 'Unknown gender'}</Badge>
          </div>
          <p class="detail-hero__body">
            Origin: {character.origin.name} · Last seen: {character.location.name}
          </p>
        </div>
      </Card>
      <div class="stats-grid">
        <StatCard label="Species" value={character.species} />
        <StatCard label="Type" value={character.type || 'Unclassified'} />
        <StatCard label="Origin" value={character.origin.name} />
        <StatCard label="Episodes" value={String(character.episode.length)} />
      </div>
    </div>
  )
}
