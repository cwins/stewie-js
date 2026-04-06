import { computed, effect, For, resource, Show } from '@stewie-js/core'
import type { Resource, JSXElement } from '@stewie-js/core'
import { LinkButton } from '../components/lib/link-button.js'
import { useQuery } from '@stewie-js/router'
import { fetchGraphQL } from '../api/graphql.js'
import { CHARACTER_DETAIL_QUERY } from '../api/queries.js'
import type { CharacterResponse, DetailVariables } from '../api/types.js'
import { CharacterDetailHero } from '../components/character-detail-hero.js'
import { EmptyState } from '../components/lib/empty-state.js'
import { ErrorState } from '../components/lib/error-state.js'
import { LoadingBlock } from '../components/lib/loading-block.js'
import { SectionHeading } from '../components/lib/section-heading.js'
import { Shell } from '../shell.js'
import { formatAirDate, getErrorMessage, parseId } from '../utils/format.js'

export function CharacterDetailPage(): JSXElement {
  const query = useQuery<{ id?: string }>()
  const characterId = computed(() => parseId(query.id))

  let characterResource!: Resource<CharacterResponse>
  characterResource = resource(() => {
    const id = characterId()
    if (!id) return Promise.resolve({ character: null })
    return fetchGraphQL<CharacterResponse, DetailVariables>(CHARACTER_DETAIL_QUERY, { id })
  })

  let didInit = false
  effect(() => {
    characterId()
    if (!didInit) {
      didInit = true
      return
    }
    void characterResource.refetch()
  })

  const character = computed(() => characterResource.data()?.character ?? null)

  return (
    <Shell>
      <div class="page-stack">
        <LinkButton to="/characters" variant="ghost" class="back-link">
          Back to characters
        </LinkButton>

        <Show
          when={() => Boolean(characterId())}
          fallback={
            <EmptyState
              title="No character selected"
              message="Open a character card from the list page, or provide a valid `?id=` query parameter."
            />
          }
        >
          <Show when={() => !characterResource.loading()} fallback={<LoadingBlock lines={5} />}>
            <Show
              when={() => !characterResource.error()}
            fallback={
              <ErrorState
                message={getErrorMessage(characterResource.error(), 'Unable to load this character.')}
                onRetry={() => {
                  void characterResource.refetch()
                }}
                />
              }
            >
              <Show
                when={() => Boolean(character())}
                fallback={
                  <EmptyState
                    title="Character not found"
                    message="The query parameter was valid, but the API did not return a matching character."
                  />
                }
              >
                {() => {
                  const currentCharacter = character()
                  if (!currentCharacter) return <span />

                  return (
                    <div class="page-stack">
                      <CharacterDetailHero character={currentCharacter} />
                      <section>
                        <SectionHeading
                          eyebrow="Appearances"
                          title="Episode appearances"
                          description="The detail page is query-param driven, while each linked episode opens on its own detail route."
                        />
                        <div class="detail-list">
                          <For each={currentCharacter.episode}>
                            {(episode: () => { id: string; name: string; episode: string; air_date: string }) => (
                              <div class="detail-list__row">
                                <div>
                                  <div class="detail-list__title">{episode().name}</div>
                                  <div class="detail-list__meta">
                                    {episode().episode} · {formatAirDate(episode().air_date)}
                                  </div>
                                </div>
                                <LinkButton to={`/episode?id=${episode().id}`} variant="secondary" size="sm">
                                  View episode
                                </LinkButton>
                              </div>
                            )}
                          </For>
                        </div>
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
