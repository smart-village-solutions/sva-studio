import React from 'react';

import { getMyDataSubjectRights } from '../../lib/iam-api';
import {
  buildPrivacyActivityRows,
  defaultPrivacyActivityFilters,
  filterPrivacyActivityRows,
  type PrivacyActivityFilters,
} from './-account-privacy-view-model';

type PrivacyOverview = Awaited<ReturnType<typeof getMyDataSubjectRights>>['data'];

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const useAccountPrivacyState = () => {
  const [overview, setOverview] = React.useState<PrivacyOverview | null>(null);
  const [filters, setFilters] = React.useState<PrivacyActivityFilters>(defaultPrivacyActivityFilters);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  const loadOverview = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await getMyDataSubjectRights();
      setOverview(response.data);
    } catch (error) {
      setOverview(null);
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadOverview().catch(() => undefined);
  }, [loadOverview]);

  const runAction = React.useCallback(
    async (work: () => Promise<void>) => {
      setIsSubmitting(true);
      setErrorMessage(null);
      setStatusMessage(null);
      try {
        await work();
        await loadOverview();
      } catch (error) {
        setErrorMessage(toErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadOverview]
  );

  const activityRows = React.useMemo(() => buildPrivacyActivityRows(overview), [overview]);
  const visibleRows = React.useMemo(() => filterPrivacyActivityRows(activityRows, filters), [activityRows, filters]);

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
