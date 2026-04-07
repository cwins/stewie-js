export const HOME_QUERY = `
  query HomeQuery {
    characters(page: 1) {
      info { count pages next prev }
      results {
        id
        name
        status
        species
        gender
        image
        type
        origin { name }
        location { name }
        episode {
          id
          name
          episode
          air_date
        }
      }
    }
    episodes(page: 1) {
      info { count pages next prev }
      results {
        id
        name
        episode
        air_date
        characters {
          id
          name
          status
          species
          image
          gender
          type
          origin { name }
          location { name }
          episode {
            id
            name
            episode
            air_date
          }
        }
      }
    }
  }
`;

export const CHARACTERS_QUERY = `
  query CharactersQuery($page: Int!, $filter: FilterCharacter) {
    characters(page: $page, filter: $filter) {
      info { count pages next prev }
      results {
        id
        name
        status
        species
        gender
        image
        type
        origin { name }
        location { name }
        episode {
          id
          name
          episode
          air_date
        }
      }
    }
  }
`;

export const CHARACTER_DETAIL_QUERY = `
  query CharacterDetailQuery($id: ID!) {
    character(id: $id) {
      id
      name
      status
      species
      gender
      type
      image
      origin { name }
      location { name }
      episode {
        id
        name
        episode
        air_date
      }
    }
  }
`;

export const EPISODES_QUERY = `
  query EpisodesQuery($page: Int!, $filter: FilterEpisode) {
    episodes(page: $page, filter: $filter) {
      info { count pages next prev }
      results {
        id
        name
        episode
        air_date
        characters {
          id
          name
          status
          species
          image
          gender
          type
          origin { name }
          location { name }
          episode {
            id
            name
            episode
            air_date
          }
        }
      }
    }
  }
`;

export const EPISODE_DETAIL_QUERY = `
  query EpisodeDetailQuery($id: ID!) {
    episode(id: $id) {
      id
      name
      episode
      air_date
      characters {
        id
        name
        status
        species
        gender
        type
        image
        origin { name }
        location { name }
        episode {
          id
          name
          episode
          air_date
        }
      }
    }
  }
`;
