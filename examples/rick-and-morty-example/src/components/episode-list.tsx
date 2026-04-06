import type { JSXElement } from '@stewie-js/core'
import { For } from '@stewie-js/core'
import type { Episode } from '../api/types.js'
import { EpisodeCard } from './episode-card.js'

export function EpisodeList({ episodes }: { episodes: Episode[] }): JSXElement {
  return (
    <div class="episode-list">
      <For each={episodes}>{(episode: () => Episode) => <EpisodeCard episode={episode()} />}</For>
    </div>
  )
}
