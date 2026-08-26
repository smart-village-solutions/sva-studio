import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioDestructiveActionDialog } from '@sva/studio-ui-react';
import type { RefObject } from 'react';
import { useState } from 'react';

import type {
  FractionBulkDeleteRequest,
  WasteFractionsContentProps,
} from './waste-management.master-data-fractions-content.parts.js';

export const WasteMasterDataFractionDeleteDialog = ({
  fractionPendingDelete,
  fallbackFocusRef,
  onOpenDeleteFraction,
  onCancel,
}: Pick<WasteFractionsContentProps, 'onOpenDeleteFraction'> & {
  readonly fractionPendingDelete: WasteFractionsContentProps['fractions'][number] | null;
  readonly fallbackFocusRef: RefObject<HTMLElement | null>;
  readonly onCancel: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <StudioDestructiveActionDialog
      open={fractionPendingDelete !== null}
      title={pt('masterData.fractions.deleteDialog.title')}
      description={pt('masterData.fractions.deleteDialog.description', {
        value: fractionPendingDelete?.name ?? '',
      })}
      confirmLabel={pt('masterData.fractions.deleteDialog.confirm')}
      pendingLabel={pt('common.deleting')}
      cancelLabel={pt('masterData.fractions.deleteDialog.cancel')}
      pending={pending}
      errorMessage={errorMessage}
      fallbackFocusRef={fallbackFocusRef}
      onCancel={() => {
        setErrorMessage(null);
        onCancel();
      }}
      onConfirm={async () => {
        if (!fractionPendingDelete) return;
        setPending(true);
        setErrorMessage(null);
        try {
          await onOpenDeleteFraction(fractionPendingDelete);
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

export const WasteMasterDataFractionsBulkDeleteDialog = ({
  request,
  fallbackFocusRef,
  onDeleteFractions,
  onCancel,
}: Pick<WasteFractionsContentProps, 'onDeleteFractions'> & {
  readonly request: FractionBulkDeleteRequest | null;
  readonly fallbackFocusRef: RefObject<HTMLElement | null>;
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
          await onDeleteFractions(request.fractionIds);
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
