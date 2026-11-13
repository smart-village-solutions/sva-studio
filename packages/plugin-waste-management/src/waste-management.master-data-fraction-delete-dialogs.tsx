import { FractionDeletionContent } from './waste-management.master-data-fraction-delete-dialogs.parts.js';
import type {
  WasteFractionDeleteMode,
  WasteFractionDeletePreview,
} from '@sva/waste-management-contracts';
import { previewWasteManagementFractionDeletion } from './waste-management.api.master-data-addresses.fractions.js';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioDestructiveActionDialog } from '@sva/studio-ui-react';
import type { RefObject } from 'react';
import { useEffect, useState } from 'react';

import type {
  FractionBulkDeleteRequest,
  WasteFractionsContentProps,
} from './waste-management.master-data-fractions-content.parts.js';

const useFractionDeletionPreview = (
  fractionId: string | undefined,
  mode: WasteFractionDeleteMode | '',
  targetFractionId: string,
  revision: number
) => {
  const [preview, setPreview] = useState<WasteFractionDeletePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!fractionId) return;
    let current = true;
    setPreview(null);
    setLoading(true);
    setErrorMessage(null);
    void previewWasteManagementFractionDeletion({
      fractionId,
      mode: mode || 'detach',
      ...(mode === 'replace' && targetFractionId ? { targetFractionId } : {}),
    })
      .then((result) => {
        if (!current) return;
        setPreview(result);
      })
      .catch(() => {
        if (current) setErrorMessage('previewError');
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [fractionId, mode, targetFractionId, revision]);
  return { preview, setPreview, loading, errorMessage, setErrorMessage };
};
const isDeletionPreviewReady = (
  preview: WasteFractionDeletePreview | null,
  fractionId: string | undefined,
  effectiveMode: WasteFractionDeleteMode | '',
  targetFractionId: string,
  loading: boolean
) =>
  preview &&
  preview.input.fractionId === fractionId &&
  preview.input.mode === effectiveMode &&
  (effectiveMode !== 'replace' ||
    (preview.input.targetFractionId === targetFractionId &&
      preview.targets.some((target) => target.id === targetFractionId))) &&
  !preview.blockedReason &&
  !loading;
type FractionDeleteDialogProps = Pick<WasteFractionsContentProps, 'onOpenDeleteFraction'> & {
  readonly fractionPendingDelete: WasteFractionsContentProps['fractions'][number] | null;
  readonly fallbackFocusRef: RefObject<HTMLElement | null>;
  readonly onCancel: () => void;
};
export const WasteMasterDataFractionDeleteDialog = ({
  fractionPendingDelete,
  fallbackFocusRef,
  onOpenDeleteFraction,
  onCancel,
}: FractionDeleteDialogProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<WasteFractionDeleteMode | ''>('');
  const [targetFractionId, setTargetFractionId] = useState('');
  const [revision, setRevision] = useState(0);
  const fractionId = fractionPendingDelete?.id;
  const { preview, setPreview, loading, errorMessage, setErrorMessage } =
    useFractionDeletionPreview(fractionId, mode, targetFractionId, revision);
  useEffect(() => {
    setMode('');
    setTargetFractionId('');
  }, [fractionId]);
  const effectiveMode = mode || (preview && !preview.tours.length ? 'detach' : '');
  const ready = isDeletionPreviewReady(
    preview,
    fractionId,
    effectiveMode,
    targetFractionId,
    loading
  );
  return (
    <StudioDestructiveActionDialog
      open={fractionPendingDelete !== null}
      title={pt('masterData.fractions.deleteDialog.title')}
      description={pt('masterData.fractions.deleteDialog.description', {
        value: fractionPendingDelete?.name ?? '',
      })}
      confirmLabel={pt(
        effectiveMode
          ? `masterData.fractions.deleteOptions.confirm.${effectiveMode}`
          : 'masterData.fractions.deleteDialog.confirm'
      )}
      pendingLabel={pt('common.deleting')}
      cancelLabel={pt('masterData.fractions.deleteDialog.cancel')}
      pending={pending}
      confirmDisabled={!ready}
      errorMessage={errorMessage ? pt(`masterData.fractions.deleteOptions.${errorMessage}`) : null}
      fallbackFocusRef={fallbackFocusRef}
      onCancel={onCancel}
      onConfirm={async () => {
        if (!fractionPendingDelete || !preview || !ready || !effectiveMode) return;
        setPending(true);
        setErrorMessage(null);
        try {
          await onOpenDeleteFraction(fractionPendingDelete, {
            mode: effectiveMode,
            confirmationToken: preview.token,
            ...(effectiveMode === 'replace' ? { targetFractionId } : {}),
          });
          onCancel();
        } catch {
          setPreview(null);
          setErrorMessage('executeError');
        } finally {
          setPending(false);
        }
      }}
    >
      <FractionDeletionContent
        preview={preview}
        mode={effectiveMode}
        targetFractionId={targetFractionId}
        pending={pending}
        loading={loading}
        source={fractionPendingDelete?.name ?? ''}
        onMode={(value) => {
          setPreview(null);
          setMode(value);
        }}
        onTarget={(value) => {
          setPreview(null);
          setTargetFractionId(value);
        }}
        onRefresh={() => {
          setPreview(null);
          setRevision((value) => value + 1);
        }}
      />
    </StudioDestructiveActionDialog>
  );
};

export const WasteMasterDataFractionsBulkDeleteDialog = ({
  request,
  fallbackFocusRef,
  onDeleteFractions,
  onPartialFailure,
  onCancel,
}: Pick<WasteFractionsContentProps, 'onDeleteFractions'> & {
  readonly request: FractionBulkDeleteRequest | null;
  readonly fallbackFocusRef: RefObject<HTMLElement | null>;
  readonly onPartialFailure: (failedIds: readonly string[]) => void;
  readonly onCancel: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <StudioDestructiveActionDialog
      open={request !== null}
      title={pt('masterData.fractions.bulkDeleteDialog.title')}
      description={pt('masterData.fractions.bulkDeleteDialog.description', {
        count: request?.fractionIds.length ?? 0,
      })}
      confirmLabel={pt('masterData.fractions.bulkDeleteDialog.confirm')}
      pendingLabel={pt('common.deleting')}
      cancelLabel={pt('masterData.fractions.bulkDeleteDialog.cancel')}
      pending={pending}
      errorMessage={errorMessage}
      fallbackFocusRef={fallbackFocusRef}
      onCancel={() => {
        setErrorMessage(null);
        onCancel();
      }}
      onConfirm={async () => {
        if (!request) return;
        setPending(true);
        setErrorMessage(null);
        try {
          const result = await onDeleteFractions(request.fractionIds);
          if (result.failedIds.length > 0) {
            onPartialFailure(result.failedIds);
            setErrorMessage(pt('masterData.fractions.messages.deleteError'));
            return;
          }
          request.clearSelection();
          onCancel();
        } catch {
          setErrorMessage(pt('masterData.fractions.messages.deleteError'));
        } finally {
          setPending(false);
        }
      }}
    />
  );
};
