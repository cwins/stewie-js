import type { JSXElement } from '@stewie-js/core';
import type { Episode } from '../api/types.js';
import { Badge } from './lib/badge.js';
import { Card } from './lib/card.js';
import { LinkButton } from './lib/link-button.js';
import { formatAirDate, getSeasonLabel } from '../utils/format.js';

export function EpisodeCard({ episode }: { episode: Episode }): JSXElement {
  return (
    <Card class="episode-card" interactive>
      <div class="episode-card__header">
        <div>
          <div class="episode-card__code">{episode.episode}</div>
          <h3 class="episode-card__title">{episode.name}</h3>
        </div>
        <Badge tone="meta">{getSeasonLabel(episode.episode)}</Badge>
      </div>
      <p class="episode-card__meta">Aired {formatAirDate(episode.air_date)}</p>
      <p class="episode-card__detail">{episode.characters.length} cast members tracked in this transmission.</p>
      <LinkButton to={`/episode?id=${episode.id}`} size="sm">
        View episode
      </LinkButton>
    </Card>
  );
}
