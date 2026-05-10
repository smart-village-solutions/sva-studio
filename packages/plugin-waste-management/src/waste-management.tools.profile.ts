import { useEffect } from 'react';

import { getWasteManagementImportCatalog, type StartWasteManagementImportInput } from './waste-management.api.js';

export const useWasteSelectedImportProfile = ({
  importCatalog,
  importProfileId,
  importSourceFormat,
  setImportSourceFormat,
}: {
  readonly importCatalog: ReturnType<typeof getWasteManagementImportCatalog>;
  readonly importProfileId: StartWasteManagementImportInput['importProfileId'] | '';
  readonly importSourceFormat: StartWasteManagementImportInput['sourceFormat'];
  readonly setImportSourceFormat: (sourceFormat: StartWasteManagementImportInput['sourceFormat']) => void;
}) => {
  const selectedImportProfile =
    importCatalog.find((profile) => profile.profileId === importProfileId) ?? importCatalog[0] ?? null;

  useEffect(() => {
    if (!selectedImportProfile) {
      return;
    }
    if (!selectedImportProfile.sourceFormats.includes(importSourceFormat)) {
      setImportSourceFormat(selectedImportProfile.sourceFormats[0] ?? 'text/csv');
    }
  }, [importSourceFormat, selectedImportProfile, setImportSourceFormat]);

  return selectedImportProfile;
};
