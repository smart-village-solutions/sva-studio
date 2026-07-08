export type MainserverProjectionPageQuery = Readonly<{
  page: number;
  pageSize: number;
}>;

type MainserverProjectionPageResult<TPageData> = Readonly<{
  data: TPageData;
  hasNextPage: boolean;
  nextPage: number;
}>;

type MainserverProjectionRoundRobinState<TTarget, TPageData> = Readonly<{
  target: TTarget;
  data: TPageData[];
}>;

export const runMainserverProjectionRoundRobin = async <TTarget, TPageData>(
  targets: readonly TTarget[],
  pageSize: number,
  loadPage: (
    target: TTarget,
    query: MainserverProjectionPageQuery
  ) => Promise<MainserverProjectionPageResult<TPageData>>,
  onPageLoaded?: (
    target: TTarget,
    pages: readonly TPageData[],
    latestPage: TPageData
  ) => Promise<void>,
  onPageFailed?: (
    target: TTarget,
    pages: readonly TPageData[],
    error: unknown
  ) => Promise<void>
): Promise<readonly MainserverProjectionRoundRobinState<TTarget, TPageData>[]> => {
  const states = targets.map((target) => ({
    target,
    data: [] as TPageData[],
    nextPage: 1,
    completed: false,
  }));

  while (states.some((state) => state.completed === false)) {
    for (const state of states) {
      if (state.completed) {
        continue;
      }

      let pageResult: MainserverProjectionPageResult<TPageData>;
      try {
        pageResult = await loadPage(state.target, {
          page: state.nextPage,
          pageSize,
        });
      } catch (error) {
        state.completed = true;
        if (onPageFailed) {
          await onPageFailed(state.target, state.data, error);
        }
        continue;
      }

      state.data.push(pageResult.data);
      if (onPageLoaded) {
        await onPageLoaded(state.target, state.data, pageResult.data);
      }

      state.completed = pageResult.hasNextPage === false;
      state.nextPage = pageResult.nextPage;
    }
  }

  return states.map((state) => ({
    target: state.target,
    data: state.data,
  }));
};
