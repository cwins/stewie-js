import { computed, defineResource, effect, Show, signal, useResource } from '@stewie-js/core';
import type { JSXElement } from '@stewie-js/core';
import { useQuery, useRouter } from '@stewie-js/router';
import { fetchGraphQL } from '../api/graphql.js';
import { EPISODES_QUERY } from '../api/queries.js';
import type { EpisodesResponse, EpisodesVariables } from '../api/types.js';
import { EpisodeList } from '../components/episode-list.js';
import { FilterBar } from '../components/filter-bar.js';
import { EmptyState } from '../components/lib/empty-state.js';
import { ErrorState } from '../components/lib/error-state.js';
import { LoadingBlock } from '../components/lib/loading-block.js';
import { Pagination } from '../components/lib/pagination.js';
import { SectionHeading } from '../components/lib/section-heading.js';
import { Shell } from '../shell.js';
import { buildPath, formatCount, getErrorMessage, parsePage } from '../utils/format.js';

const SEASON_OPTIONS = [
  { label: 'Any season', value: '' },
  { label: 'Season 1', value: 'S01' },
  { label: 'Season 2', value: 'S02' },
  { label: 'Season 3', value: 'S03' },
  { label: 'Season 4', value: 'S04' },
  { label: 'Season 5', value: 'S05' }
];

interface EpisodesSource {
  page: number;
  name: string;
  season: string;
}

const fetchEpisodes = defineResource((src: EpisodesSource, _opts: { signal: AbortSignal }) =>
  fetchGraphQL<EpisodesResponse, EpisodesVariables>(EPISODES_QUERY, {
    page: src.page,
    filter: {
      name: src.name || undefined,
      episode: src.season || undefined
    }
  })
);

export function EpisodesPage(): JSXElement {
  const router = useRouter();
  const query = useQuery<{ page?: string; name?: string; season?: string }>();

  const currentPage = computed(() => parsePage(query.page));
  const activeName = computed(() => query.name?.trim() ?? '');
  const activeSeason = computed(() => query.season?.trim() ?? '');

  const $name = signal(activeName());
  const $season = signal(activeSeason());

  // Keep form state in sync with URL params when navigation changes them.
  effect(() => {
    $name.set(activeName());
    $season.set(activeSeason());
  });

  const episodesResource = useResource(fetchEpisodes, () => ({
    page: currentPage(),
    name: activeName(),
    season: activeSeason()
  }));

  const results = computed(() => episodesResource.data()?.episodes.results ?? []);
  const info = computed(() => episodesResource.data()?.episodes.info ?? null);

  const applyFilters = (e: Event) => {
    e.preventDefault();
    router.navigate(
      buildPath('/episodes', {
        page: 1,
        name: $name().trim() || undefined,
        season: $season().trim() || undefined
      })
    );
  };

  const clearFilters = () => {
    $name.set('');
    $season.set('');
    router.navigate('/episodes');
  };

  const setPage = (page: number) => {
    router.navigate(
      buildPath('/episodes', {
        page,
        name: activeName() || undefined,
        season: activeSeason() || undefined
      })
    );
  };

  return (
    <Shell>
      <div class="page-stack">
        <SectionHeading
          eyebrow="Browse"
          title="Episodes"
          description="Filter by title or season code, then jump into a detail page backed by the same public graph."
        />

        <FilterBar
          searchValue={$name()}
          searchPlaceholder="Search episodes"
          onSearchInput={(e: Event) => {
            $name.set((e.target as HTMLInputElement).value);
          }}
          selectValue={$season()}
          selectOptions={SEASON_OPTIONS}
          onSelectChange={(e: Event) => {
            $season.set((e.target as HTMLSelectElement).value);
          }}
          onApply={applyFilters}
          onClear={clearFilters}
        />

        <div class="results-toolbar">
          <div class="results-toolbar__summary">
            {info() ? `${formatCount(info()!.count)} episodes available` : 'Querying the graph...'}
          </div>
          <Show when={() => Boolean(info())}>
            {() => (
              <Pagination
                page={currentPage()}
                totalPages={info()?.pages ?? 1}
                onPrevious={() => setPage(Math.max(1, currentPage() - 1))}
                onNext={() => setPage(Math.min(info()?.pages ?? 1, currentPage() + 1))}
              />
            )}
          </Show>
        </div>

        <Show when={() => !episodesResource.loading()} fallback={<LoadingBlock lines={4} />}>
          <Show
            when={() => !episodesResource.error()}
            fallback={
              <ErrorState
                message={getErrorMessage(episodesResource.error(), 'Unable to load episode data.')}
                onRetry={() => {
                  void episodesResource.refetch();
                }}
              />
            }
          >
            <Show
              when={() => results().length > 0}
              fallback={<EmptyState title="No episodes found" message="Try removing the season filter or broadening the search query." />}
            >
              {() => <EpisodeList episodes={results()} />}
            </Show>
          </Show>
        </Show>
      </div>
    </Shell>
  );
}
