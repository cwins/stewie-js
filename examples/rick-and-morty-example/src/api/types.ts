export interface PageInfo {
  count: number
  pages: number
  next: number | null
  prev: number | null
}

export interface LocationRef {
  name: string
}

export interface EpisodeRef {
  id: string
  name: string
  episode: string
  air_date: string
}

export interface Character {
  id: string
  name: string
  status: string
  species: string
  type: string
  gender: string
  image: string
  origin: LocationRef
  location: LocationRef
  episode: EpisodeRef[]
}

export interface Episode {
  id: string
  name: string
  episode: string
  air_date: string
  characters: Character[]
}

export interface CharactersResponse {
  characters: {
    info: PageInfo
    results: Character[]
  }
}

export interface CharacterResponse {
  character: Character | null
}

export interface EpisodesResponse {
  episodes: {
    info: PageInfo
    results: Episode[]
  }
}

export interface EpisodeResponse {
  episode: Episode | null
}

export interface HomeResponse {
  characters: {
    info: PageInfo
    results: Character[]
  }
  episodes: {
    info: PageInfo
    results: Episode[]
  }
}

export interface CharactersVariables {
  page: number
  filter?: {
    name?: string
    status?: string
  }
}

export interface EpisodesVariables {
  page: number
  filter?: {
    name?: string
    episode?: string
  }
}

export interface DetailVariables {
  id: string
}
