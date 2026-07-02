import type {
  StudioJobResponse,
  WasteLocationTourPickupDateImportPreview,
  WasteManagementImportProfileCatalogEntry,
  WasteManagementImportSourceFormat,
  WasteManagementSettingsRecord,
} from '@sva/plugin-sdk';
import {
  formatTechnicalDateTimeInEditorTimeZone,
  usePluginTranslation,
  wasteManagementOperationsContract,
} from '@sva/plugin-sdk';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  StudioConfirmDialog,
  StudioField,
  StudioFieldGroup,
} from '@sva/studio-ui-react';
import ExcelJS from 'exceljs';

import { WasteManagementApiError } from './waste-management.api.js';
const { Workbook } = ExcelJS;

export type StatusMessage = {
  readonly kind: 'success' | 'error' | 'warning';
  readonly text: string;
  readonly retryAction?: 'sync-waste-types';
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
  return formatTechnicalDateTimeInEditorTimeZone(value) ?? value;
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
  const delimiter = profile.templateDelimiter ?? ',';
  const headers = profile.templateHeaders ?? [...profile.requiredColumns, ...profile.optionalColumns].map((column) => column.key);
  const sampleRows =
    profile.templateSampleRows ??
    [[...profile.requiredColumns, ...profile.optionalColumns].map((column) => column.example ?? '')];
  return [headers.join(delimiter), ...sampleRows.map((row) => row.join(delimiter))].join('\n').concat('\n');
};

const createImportTemplateWorkbookBuffer = async (profile: WasteManagementImportProfileCatalogEntry): Promise<ArrayBuffer> => {
  const headers = [...profile.requiredColumns, ...profile.optionalColumns].map((column) => column.key);
  const sampleRow = [...profile.requiredColumns, ...profile.optionalColumns].map((column) => column.example ?? '');
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Import');
  worksheet.addRow(headers);
  worksheet.addRow(sampleRow);
  return await workbook.xlsx.writeBuffer();
};

export const downloadImportTemplate = async (
  profile: WasteManagementImportProfileCatalogEntry,
  sourceFormat: WasteManagementImportSourceFormat
) => {
  const blob =
    sourceFormat === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ? new Blob([await createImportTemplateWorkbookBuffer(profile)], {
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

export const downloadImportPreviewErrors = (preview: WasteLocationTourPickupDateImportPreview) => {
  const rows = [
    ['Row', 'Column', 'Message', 'Value'],
    ...preview.errors.map((error) => [
      String(error.rowNumber),
      error.column,
      error.message,
      error.value ?? '',
    ]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${cell.split('"').join('""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'waste-import-errors.csv';
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

export const StatusNotice = ({
  message,
  onRetry,
}: {
  readonly message: StatusMessage | null;
  readonly onRetry?: (action: NonNullable<StatusMessage['retryAction']>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const retryAction = message?.retryAction;

  return message ? (
    <Alert>
      <AlertTitle>
        {message.kind === 'success'
          ? pt('common.statusSuccessTitle')
          : message.kind === 'warning'
            ? pt('common.statusWarningTitle')
            : pt('common.statusErrorTitle')}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{message.text}</p>
        {retryAction && onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onRetry(retryAction)}>
            {pt('masterData.fractions.actions.retrySync')}
          </Button>
        ) : null}
      </AlertDescription>
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
