import { computed, defineResource, effect, Show, signal, useResource } from '@stewie-js/core';
import type { JSXElement } from '@stewie-js/core';
import { useQuery, useRouter } from '@stewie-js/router';
import { fetchGraphQL } from '../api/graphql.js';
import { CHARACTERS_QUERY } from '../api/queries.js';
import type { CharactersResponse, CharactersVariables } from '../api/types.js';
import { CharacterGrid } from '../components/character-grid.js';
import { FilterBar } from '../components/filter-bar.js';
import { EmptyState } from '../components/lib/empty-state.js';
import { ErrorState } from '../components/lib/error-state.js';
import { LoadingBlock } from '../components/lib/loading-block.js';
import { Pagination } from '../components/lib/pagination.js';
import { SectionHeading } from '../components/lib/section-heading.js';
import { Shell } from '../shell.js';
import { buildPath, formatCount, getErrorMessage, parsePage } from '../utils/format.js';

const STATUS_OPTIONS = [
  { label: 'Any status', value: '' },
  { label: 'Alive', value: 'alive' },
  { label: 'Dead', value: 'dead' },
  { label: 'Unknown', value: 'unknown' }
];

interface CharactersSource {
  page: number;
  name: string;
  status: string;
}

const fetchCharacters = defineResource((src: CharactersSource, _opts: { signal: AbortSignal }) =>
  fetchGraphQL<CharactersResponse, CharactersVariables>(CHARACTERS_QUERY, {
    page: src.page,
    filter: {
      name: src.name || undefined,
      status: src.status || undefined
    }
  })
);

export function CharactersPage(): JSXElement {
  const router = useRouter();
  const query = useQuery<{ page?: string; name?: string; status?: string }>();

  const currentPage = computed(() => parsePage(query.page));
  const activeName = computed(() => query.name?.trim() ?? '');
  const activeStatus = computed(() => query.status?.trim() ?? '');

  const $name = signal(activeName());
  const $status = signal(activeStatus());

  // Keep form state in sync with URL params when navigation changes them.
  effect(() => {
    $name.set(activeName());
    $status.set(activeStatus());
  });

  const charactersResource = useResource(fetchCharacters, () => ({
    page: currentPage(),
    name: activeName(),
    status: activeStatus()
  }));

  const results = computed(() => charactersResource.data()?.characters.results ?? []);
  const info = computed(() => charactersResource.data()?.characters.info ?? null);

  const applyFilters = (e: Event) => {
    e.preventDefault();
    router.navigate(
      buildPath('/characters', {
        page: 1,
        name: $name().trim() || undefined,
        status: $status().trim() || undefined
      })
    );
  };

  const clearFilters = () => {
    $name.set('');
    $status.set('');
    router.navigate('/characters');
  };

  const setPage = (page: number) => {
    router.navigate(
      buildPath('/characters', {
        page,
        name: activeName() || undefined,
        status: activeStatus() || undefined
      })
    );
  };

  return (
    <Shell>
      <div class="page-stack">
        <SectionHeading
          eyebrow="Browse"
          title="Characters"
          description="Search by name, filter by status, and open a detail page with a query-param id."
        />

        <FilterBar
          searchValue={$name()}
          searchPlaceholder="Search characters"
          onSearchInput={(e: Event) => {
            $name.set((e.target as HTMLInputElement).value);
          }}
          selectValue={$status()}
          selectOptions={STATUS_OPTIONS}
          onSelectChange={(e: Event) => {
            $status.set((e.target as HTMLSelectElement).value);
          }}
          onApply={applyFilters}
          onClear={clearFilters}
        />

        <div class="results-toolbar">
          <div class="results-toolbar__summary">
            {info() ? `${formatCount(info()!.count)} characters available` : 'Querying the graph...'}
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

        <Show when={() => !charactersResource.loading()} fallback={<LoadingBlock lines={4} />}>
          <Show
            when={() => !charactersResource.error()}
            fallback={
              <ErrorState
                message={getErrorMessage(charactersResource.error(), 'Unable to load character data.')}
                onRetry={() => {
                  void charactersResource.refetch();
                }}
              />
            }
          >
            <Show
              when={() => results().length > 0}
              fallback={<EmptyState title="No characters found" message="Try widening the search or clearing the active filters." />}
            >
              {() => <CharacterGrid characters={results()} />}
            </Show>
          </Show>
        </Show>
      </div>
    </Shell>
  );
}
