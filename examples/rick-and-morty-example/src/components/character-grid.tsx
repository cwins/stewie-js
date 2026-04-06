import type { JSXElement } from '@stewie-js/core'
import { For } from '@stewie-js/core'
import type { Character } from '../api/types.js'
import { CharacterCard } from './character-card.js'

export function CharacterGrid({
  characters,
  compact = false
}: {
  characters: Character[]
  compact?: boolean
}): JSXElement {
  return (
    <div class={compact ? 'character-grid character-grid--compact' : 'character-grid'}>
      <For each={characters}>
        {(character: () => Character) => <CharacterCard character={character()} compact={compact} />}
      </For>
    </div>
  )
}
