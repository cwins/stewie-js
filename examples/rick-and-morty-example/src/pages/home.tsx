import { computed, resource, Show } from '@stewie-js/core';
import type { JSXElement } from '@stewie-js/core';
import { fetchGraphQL } from '../api/graphql.js';
import { HOME_QUERY } from '../api/queries.js';
import type { HomeResponse } from '../api/types.js';
import { HomeHero } from '../components/home-hero.js';
import { HomeStatStrip } from '../components/home-stat-strip.js';
import { MediaStrip } from '../components/media-strip.js';
import { ErrorState } from '../components/lib/error-state.js';
import { LoadingBlock } from '../components/lib/loading-block.js';
import { SectionHeading } from '../components/lib/section-heading.js';
import { Shell } from '../shell.js';
import { formatCount, getErrorMessage } from '../utils/format.js';

export function HomePage(): JSXElement {
  const homeResource = resource(() => fetchGraphQL<HomeResponse>(HOME_QUERY));

  const stats = computed(() => {
    const payload = homeResource.data();
    if (!payload) return [];

    return [
      { label: 'Characters', value: formatCount(payload.characters.info.count), hint: 'Tracked by the live API' },
      { label: 'Episodes', value: formatCount(payload.episodes.info.count), hint: 'Transmission logs available' },
      { label: 'Character pages', value: formatCount(payload.characters.info.pages), hint: 'Paginated exploration' },
      { label: 'Episode pages', value: formatCount(payload.episodes.info.pages), hint: 'Browse by season and title' }
    ];
  });

  const featuredCharacters = computed(() => homeResource.data()?.characters.results.slice(0, 4) ?? []);
  const featuredEpisodes = computed(() => homeResource.data()?.episodes.results.slice(0, 3) ?? []);

  return (
    <Shell>
      <div class="page-stack">
        <HomeHero />
        <Show
          when={() => !homeResource.loading()}
          fallback={
            <div class="section-stack">
              <LoadingBlock lines={3} />
              <LoadingBlock lines={3} />
            </div>
          }
        >
          <Show
            when={() => !homeResource.error()}
            fallback={
              <ErrorState
                message={getErrorMessage(homeResource.error(), 'Unable to load multiverse data.')}
                onRetry={() => {
                  void homeResource.refetch();
                }}
              />
            }
          >
            <div class="section-stack">
              <HomeStatStrip stats={stats()} />

              <section>
                <SectionHeading
                  eyebrow="Featured"
                  title="Core characters"
                  description="A quick look at a few of the most recognizable entities in the graph."
                />
                <Show when={() => featuredCharacters().length > 0} fallback={<LoadingBlock lines={2} />}>
                  {() => <MediaStrip mode="characters" characters={featuredCharacters()} />}
                </Show>
              </section>

              <section>
                <SectionHeading
                  eyebrow="Featured"
                  title="Recent transmissions"
                  description="Episode cards double as a good demo of dense text metadata with no visual clutter."
                />
                <Show when={() => featuredEpisodes().length > 0} fallback={<LoadingBlock lines={2} />}>
                  {() => <MediaStrip mode="episodes" episodes={featuredEpisodes()} />}
                </Show>
              </section>
            </div>
          </Show>
        </Show>
      </div>
    </Shell>
  );
}
