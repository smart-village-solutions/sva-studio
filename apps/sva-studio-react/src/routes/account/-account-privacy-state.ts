import React from 'react';
import { useStudioTableQuery } from '@sva/studio-ui-react';

import { getMyDataSubjectRights } from '../../lib/iam-api';
import {
  buildPrivacyActivityRows,
  defaultPrivacyActivityFilters,
  filterPrivacyActivityRows,
  type PrivacyActivityFilters,
} from './-account-privacy-view-model';

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const useAccountPrivacyState = () => {
  const [filters, setFilters] = React.useState<PrivacyActivityFilters>(
    defaultPrivacyActivityFilters
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [actionErrorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  const list = useStudioTableQuery(['account-privacy'], () => getMyDataSubjectRights());
  const overview = list.data?.data ?? null;
  const isLoading = list.state === 'loading';
  const errorMessage = actionErrorMessage ?? (list.error ? toErrorMessage(list.error) : null);

  const runAction = React.useCallback(
    async (work: () => Promise<void>) => {
      setIsSubmitting(true);
      setErrorMessage(null);
      setStatusMessage(null);
      try {
        await work();
        await list.refetch();
      } catch (error) {
        setErrorMessage(toErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    },
    [list.refetch]
  );

  const activityRows = React.useMemo(() => buildPrivacyActivityRows(overview), [overview]);
  const visibleRows = React.useMemo(
    () => filterPrivacyActivityRows(activityRows, filters),
    [activityRows, filters]
  );

  return {
    filters,
    errorMessage,
    isLoading,
    isSubmitting,
    overview,
    runAction,
    setErrorMessage,
    setFilters,
    setStatusMessage,
    statusMessage,
    visibleRows,
  };
};
