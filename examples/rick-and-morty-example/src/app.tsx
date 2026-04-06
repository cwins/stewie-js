import { Router, Route } from '@stewie-js/router'
import { lazy } from '@stewie-js/core'
import type { JSXElement } from '@stewie-js/core'
import './styles.css'

const HomePage = lazy(() => import('./pages/home.js').then((m) => m.HomePage))
const CharactersPage = lazy(() => import('./pages/characters.js').then((m) => m.CharactersPage))
const CharacterDetailPage = lazy(() => import('./pages/character-detail.js').then((m) => m.CharacterDetailPage))
const EpisodesPage = lazy(() => import('./pages/episodes.js').then((m) => m.EpisodesPage))
const EpisodeDetailPage = lazy(() => import('./pages/episode-detail.js').then((m) => m.EpisodeDetailPage))

export function App({ initialUrl }: { initialUrl?: string } = {}): JSXElement {
  return (
    <Router initialUrl={initialUrl}>
      <Route path="/" component={HomePage} />
      <Route path="/characters" component={CharactersPage} />
      <Route path="/character" component={CharacterDetailPage} />
      <Route path="/episodes" component={EpisodesPage} />
      <Route path="/episode" component={EpisodeDetailPage} />
    </Router>
  )
}
