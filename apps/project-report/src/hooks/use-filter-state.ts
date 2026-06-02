import * as React from 'react';

import { parseFilterStateFromSearchParams, stringifyFilterStateToSearchParams, type ReportFilterState } from '../lib/url-state';

const subscribeToLocation = (onStoreChange: () => void) => {
  globalThis.addEventListener('popstate', onStoreChange);
  return () => globalThis.removeEventListener('popstate', onStoreChange);
};

const readLocationSearch = () => globalThis.location.search;

export const useFilterState = (): [ReportFilterState, (updater: (current: ReportFilterState) => ReportFilterState) => void] => {
  const locationSearch = React.useSyncExternalStore(subscribeToLocation, readLocationSearch, () => '');
  const filterState = React.useMemo(
    () => parseFilterStateFromSearchParams(new URLSearchParams(locationSearch)),
    [locationSearch]
  );

  const updateState = React.useCallback((updater: (current: ReportFilterState) => ReportFilterState) => {
    const nextState = updater(parseFilterStateFromSearchParams(new URLSearchParams(globalThis.location.search)));
    const params = stringifyFilterStateToSearchParams(nextState);
    const search = params.toString();
    const nextUrl = search.length > 0 ? `${globalThis.location.pathname}?${search}` : globalThis.location.pathname;

    globalThis.history.pushState({}, '', nextUrl);
    globalThis.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return [filterState, updateState];
};
