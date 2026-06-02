import * as React from 'react';

import {
  getEditableWorkPackageOptions,
  isLocalProjectStatusHost,
  updateWorkPackageAssignment,
  type EditableWorkPackageOptions,
} from '../lib/local-editing';
import type { ProjectStatusReport } from '../lib/report-model';
import {
  loadLocalProjectStatusReport,
  saveLocalProjectStatusUpdate,
  type LocalProjectStatusPatchRequest,
} from '../lib/project-status-api';

export type LocalEditingNotice = 'loading' | 'active' | 'loadError' | 'saveError';

export type UseLocalProjectStatusResult = Readonly<{
  editableOptions: EditableWorkPackageOptions;
  isLocalEditingEnabled: boolean;
  isSaving: boolean;
  localEditingNotice: LocalEditingNotice | null;
  report: ProjectStatusReport;
  updateLocalWorkPackage: (payload: LocalProjectStatusPatchRequest) => void;
}>;

export const useLocalProjectStatus = (initialReport: ProjectStatusReport): UseLocalProjectStatusResult => {
  const [report, setReport] = React.useState(initialReport);
  const [localEditingNotice, setLocalEditingNotice] = React.useState<LocalEditingNotice | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const isLocalEditingEnabled = React.useMemo(() => isLocalProjectStatusHost(globalThis.location.hostname), []);
  const confirmedReportRef = React.useRef(initialReport);

  const editableOptions = React.useMemo(() => getEditableWorkPackageOptions(report), [report]);

  React.useEffect(() => {
    if (!isLocalEditingEnabled) {
      return;
    }

    let isDisposed = false;
    setLocalEditingNotice('loading');

    void loadLocalProjectStatusReport()
      .then((nextReport) => {
        if (isDisposed) {
          return;
        }

        confirmedReportRef.current = nextReport;
        setReport(nextReport);
        setLocalEditingNotice('active');
      })
      .catch(() => {
        if (isDisposed) {
          return;
        }

        setLocalEditingNotice('loadError');
      });

    return () => {
      isDisposed = true;
    };
  }, [isLocalEditingEnabled]);

  const updateLocalWorkPackage = React.useCallback(
    (payload: LocalProjectStatusPatchRequest) => {
      if (!isLocalEditingEnabled || isSaving) {
        return;
      }

      const previousReport = confirmedReportRef.current;
      const optimisticReport = updateWorkPackageAssignment(previousReport, payload);

      setIsSaving(true);
      setLocalEditingNotice('active');
      setReport(optimisticReport);

      void saveLocalProjectStatusUpdate(payload)
        .then((nextReport) => {
          confirmedReportRef.current = nextReport;
          setReport(nextReport);
          setLocalEditingNotice('active');
        })
        .catch(() => {
          confirmedReportRef.current = previousReport;
          setReport(previousReport);
          setLocalEditingNotice('saveError');
        })
        .finally(() => {
          setIsSaving(false);
        });
    },
    [isLocalEditingEnabled, isSaving]
  );

  return {
    editableOptions,
    isLocalEditingEnabled,
    isSaving,
    localEditingNotice,
    report,
    updateLocalWorkPackage,
  };
};
