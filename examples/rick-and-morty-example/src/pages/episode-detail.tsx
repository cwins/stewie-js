import { computed, effect, resource, Show } from '@stewie-js/core'
import type { Resource, JSXElement } from '@stewie-js/core'
import { useQuery } from '@stewie-js/router'
import { fetchGraphQL } from '../api/graphql.js'
import { EPISODE_DETAIL_QUERY } from '../api/queries.js'
import type { DetailVariables, EpisodeResponse } from '../api/types.js'
import { CharacterGrid } from '../components/character-grid.js'
import { EpisodeDetailHero } from '../components/episode-detail-hero.js'
import { EmptyState } from '../components/lib/empty-state.js'
import { ErrorState } from '../components/lib/error-state.js'
import { LinkButton } from '../components/lib/link-button.js'
import { LoadingBlock } from '../components/lib/loading-block.js'
import { SectionHeading } from '../components/lib/section-heading.js'
import { Shell } from '../shell.js'
import { getErrorMessage, parseId } from '../utils/format.js'

export function EpisodeDetailPage(): JSXElement {
  const query = useQuery<{ id?: string }>()
  const episodeId = computed(() => parseId(query.id))

  let episodeResource!: Resource<EpisodeResponse>
  episodeResource = resource(() => {
    const id = episodeId()
    if (!id) return Promise.resolve({ episode: null })
    return fetchGraphQL<EpisodeResponse, DetailVariables>(EPISODE_DETAIL_QUERY, { id })
  })

  let didInit = false
  effect(() => {
    episodeId()
    if (!didInit) {
      didInit = true
      return
    }
    void episodeResource.refetch()
  })

  const episode = computed(() => episodeResource.data()?.episode ?? null)

  return (
    <Shell>
      <div class="page-stack">
        <LinkButton to="/episodes" variant="ghost" class="back-link">
          Back to episodes
        </LinkButton>

        <Show
          when={() => Boolean(episodeId())}
          fallback={
            <EmptyState
              title="No episode selected"
              message="Open an episode card from the list page, or provide a valid `?id=` query parameter."
            />
          }
        >
          <Show when={() => !episodeResource.loading()} fallback={<LoadingBlock lines={5} />}>
            <Show
              when={() => !episodeResource.error()}
            fallback={
              <ErrorState
                message={getErrorMessage(episodeResource.error(), 'Unable to load this episode.')}
                onRetry={() => {
                  void episodeResource.refetch()
                }}
                />
              }
            >
              <Show
                when={() => Boolean(episode())}
                fallback={
                  <EmptyState
                    title="Episode not found"
                    message="The query parameter was valid, but the API did not return a matching episode."
                  />
                }
              >
                {() => {
                  const currentEpisode = episode()
                  if (!currentEpisode) return <span />

                  return (
                    <div class="page-stack">
                      <EpisodeDetailHero episode={currentEpisode} />
                      <section>
                        <SectionHeading
                          eyebrow="Cast"
                          title="Characters in this episode"
                          description="The cast grid reuses the same character-card system as the list page, just in a denser layout."
                        />
                        <CharacterGrid characters={currentEpisode.characters} compact />
                      </section>
                    </div>
                  )
                }}
              </Show>
            </Show>
          </Show>
        </Show>
      </div>
    </Shell>
  )
}
