export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const mergeRequestHeaders = (...headersList: Array<HeadersInit | undefined>): Headers => {
  const merged = new Headers();
  for (const headers of headersList) {
    if (!headers) {
      continue;
    }
    for (const [key, value] of new Headers(headers).entries()) {
      merged.set(key, value);
    }
  }
  return merged;
};

export const requestJson = async <T>(input: {
  readonly fetch: FetchLike;
  readonly url: string;
  readonly init?: RequestInit;
  readonly errorFactory?: (response: Response) => Error;
}): Promise<T> => {
  const response = await input.fetch(input.url, {
    credentials: 'include',
    ...input.init,
    headers: mergeRequestHeaders({ Accept: 'application/json' }, input.init?.headers),
  });
  if (!response.ok) {
    throw (input.errorFactory ?? ((failingResponse: Response) => new Error(`http_${failingResponse.status}`)))(response);
  }
  return (await response.json()) as T;
};
