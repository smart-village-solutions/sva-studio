import type {
  StudioJobResponse,
  WasteManagementImportProfileCatalogEntry,
  WasteManagementImportSourceFormat,
  WasteManagementSettingsRecord,
} from '@sva/plugin-sdk';
import { usePluginTranslation, wasteManagementOperationsContract } from '@sva/plugin-sdk';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Input,
  StudioConfirmDialog,
  StudioField,
  StudioFieldGroup,
} from '@sva/studio-ui-react';
import * as XLSX from 'xlsx';

import { WasteManagementApiError } from './waste-management.api.js';

export type StatusMessage = {
  readonly kind: 'success' | 'error';
  readonly text: string;
};

export type TechnicalStatusTone = 'neutral' | 'success' | 'warning' | 'error';

export const compactOptionalString = (value: string): string | undefined => {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const resolveApiErrorCode = (error: unknown): string | null =>
  error instanceof WasteManagementApiError ? error.code : null;

export const formatUpdatedAt = (value?: string) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

export const toTechnicalStatusTone = (
  status: WasteManagementSettingsRecord['visibleStatus'] | undefined
): TechnicalStatusTone => {
  switch (status) {
    case 'ok':
      return 'success';
    case 'error':
      return 'error';
    case 'unknown':
      return 'warning';
    case 'not_configured':
    default:
      return 'neutral';
  }
};

export const toJobStatusTone = (status: StudioJobResponse['data']['status'] | undefined): TechnicalStatusTone => {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'failed':
    case 'cancelled':
      return 'error';
    case 'queued':
    case 'running':
    case 'retrying':
      return 'warning';
    default:
      return 'neutral';
  }
};

const createImportTemplateCsv = (profile: WasteManagementImportProfileCatalogEntry) => {
  const headers = [...profile.requiredColumns, ...profile.optionalColumns].map((column) => column.key);
  const sampleRow = [...profile.requiredColumns, ...profile.optionalColumns].map((column) => column.example ?? '');
  return `${headers.join(',')}\n${sampleRow.join(',')}\n`;
};

const createImportTemplateWorkbook = (profile: WasteManagementImportProfileCatalogEntry) => {
  const headers = [...profile.requiredColumns, ...profile.optionalColumns].map((column) => column.key);
  const sampleRow = [...profile.requiredColumns, ...profile.optionalColumns].map((column) => column.example ?? '');
  const sheet = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Import');
  return workbook;
};

export const downloadImportTemplate = (
  profile: WasteManagementImportProfileCatalogEntry,
  sourceFormat: WasteManagementImportSourceFormat
) => {
  const blob =
    sourceFormat === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ? new Blob([XLSX.write(createImportTemplateWorkbook(profile), { type: 'array', bookType: 'xlsx' })], {
          type: sourceFormat,
        })
      : new Blob([createImportTemplateCsv(profile)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download =
    sourceFormat === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ? `${profile.profileId}.xlsx`
      : `${profile.profileId}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const readFileAsDataUrl = async (file: File): Promise<string> =>
  await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('file_read_failed'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('file_read_failed'));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });

export const StatusNotice = ({ message }: { readonly message: StatusMessage | null }) => {
  const pt = usePluginTranslation('wasteManagement');

  return message ? (
    <Alert>
      <AlertTitle>{message.kind === 'success' ? pt('common.statusSuccessTitle') : pt('common.statusErrorTitle')}</AlertTitle>
      <AlertDescription>{message.text}</AlertDescription>
    </Alert>
  ) : null;
};

export const ResetConfirmationDialog = ({
  open,
  token,
  running,
  onOpenChange,
  onTokenChange,
  onConfirm,
}: {
  readonly open: boolean;
  readonly token: string;
  readonly running: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onTokenChange: (value: string) => void;
  readonly onConfirm: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <StudioConfirmDialog
      open={open}
      title={pt('tools.reset.confirmTitle')}
      description={pt('tools.reset.confirmDescription')}
      confirmLabel={running ? pt('tools.actions.starting') : pt('tools.reset.confirmAction')}
      cancelLabel={pt('tools.reset.confirmCancel')}
      confirmDisabled={running || token.trim() !== wasteManagementOperationsContract.resetConfirmationToken}
      onCancel={() => onOpenChange(false)}
      onConfirm={onConfirm}
    >
      <StudioFieldGroup>
        <StudioField id="waste-tools-reset-token-dialog" label={pt('tools.reset.tokenLabel')}>
          <Input
            id="waste-tools-reset-token-dialog"
            value={token}
            onChange={(event) => onTokenChange(event.target.value)}
            placeholder={wasteManagementOperationsContract.resetConfirmationToken}
          />
        </StudioField>
      </StudioFieldGroup>
    </StudioConfirmDialog>
  );
};
