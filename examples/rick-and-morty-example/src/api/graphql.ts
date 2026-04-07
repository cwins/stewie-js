const GRAPHQL_ENDPOINT = 'https://rickandmortyapi.com/graphql';

interface GraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

export async function fetchGraphQL<TData, TVariables extends object | undefined = undefined>(
  query: string,
  variables?: TVariables
): Promise<TData> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as GraphqlResponse<TData>;

  if (payload.errors && payload.errors.length > 0) {
    throw new Error(payload.errors.map((err) => err.message ?? 'Unknown GraphQL error').join(', '));
  }

  if (!payload.data) {
    throw new Error('GraphQL response did not include data');
  }

  return payload.data;
}
