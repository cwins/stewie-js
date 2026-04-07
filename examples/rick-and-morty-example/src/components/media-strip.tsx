import type { JSXElement } from '@stewie-js/core';
import { For } from '@stewie-js/core';
import type { Character, Episode } from '../api/types.js';
import { CharacterCard } from './character-card.js';
import { EpisodeCard } from './episode-card.js';

export function MediaStrip({
  mode,
  characters,
  episodes
}: {
  mode: 'characters' | 'episodes';
  characters?: Character[];
  episodes?: Episode[];
}): JSXElement {
  if (mode === 'characters') {
    return (
      <div class="media-strip media-strip--characters">
        <For each={characters ?? []}>{(character: () => Character) => <CharacterCard character={character()} />}</For>
      </div>
    );
  }

  return (
    <div class="media-strip media-strip--episodes">
      <For each={episodes ?? []}>{(episode: () => Episode) => <EpisodeCard episode={episode()} />}</For>
    </div>
  );
}
