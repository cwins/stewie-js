import type { JSXElement } from '@stewie-js/core';
import type { Episode } from '../api/types.js';
import { Badge } from './lib/badge.js';
import { Card } from './lib/card.js';
import { StatCard } from './lib/stat-card.js';
import { formatAirDate, getSeasonLabel } from '../utils/format.js';

export function EpisodeDetailHero({ episode }: { episode: Episode }): JSXElement {
  return (
    <div class="detail-stack">
      <Card class="detail-hero detail-hero--episode">
        <div class="detail-hero__content">
          <div class="detail-hero__eyebrow">Episode transmission</div>
          <h1 class="detail-hero__title">{episode.name}</h1>
          <div class="detail-hero__badges">
            <Badge tone="meta">{episode.episode}</Badge>
            <Badge tone="meta">{getSeasonLabel(episode.episode)}</Badge>
          </div>
          <p class="detail-hero__body">Air date: {formatAirDate(episode.air_date)}</p>
        </div>
      </Card>
      <div class="stats-grid">
        <StatCard label="Code" value={episode.episode} />
        <StatCard label="Season" value={getSeasonLabel(episode.episode)} />
        <StatCard label="Air date" value={formatAirDate(episode.air_date)} />
        <StatCard label="Cast" value={String(episode.characters.length)} />
      </div>
    </div>
  );
}
