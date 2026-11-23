import { useRef, useState } from 'react';
import type { usePluginTranslation } from '@sva/plugin-sdk';

import type { PendingAddressDelete } from './waste-management.master-data-address-delete-dialog.js';
import type { AddressRow } from './waste-management.master-data-addresses.helpers.js';
import { deleteWasteAddressEntity, previewWasteAddressMutation } from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

const loadDeletePreview = async ({
  row,
  pt,
  previewSequence,
  setPendingDelete,
  previewFresh,
  transfer,
  targetEntityId,
}: {
  row: AddressRow;
  pt: ReturnType<typeof usePluginTranslation>;
  previewSequence: { current: number };
  setPendingDelete: (value: PendingAddressDelete) => void;
  previewFresh: boolean;
  transfer: boolean;
  targetEntityId?: string;
}) => {
  const sequence = ++previewSequence.current;
  try {
    const preview = await previewWasteAddressMutation({
      entityType: row.type,
      entityId: row.id,
      mode: 'delete',
      ...(targetEntityId ? { targetEntityId } : {}),
    });
    if (sequence !== previewSequence.current) return;
    setPendingDelete({
      row,
      transfer,
      targetEntityId,
      preview,
      loading: false,
      ...(previewFresh
        ? { previewFresh, error: pt('masterData.locationsWorkspace.addresses.previewStale') }
        : {}),
    });
  } catch {
    if (sequence !== previewSequence.current) return;
    setPendingDelete({
      row,
      transfer,
      targetEntityId,
      loading: false,
      error: pt('masterData.locationsWorkspace.addresses.previewError'),
    });
  }
};

const useAddressDeleteConfirmation = ({
  pendingDelete,
  setPendingDelete,
  loadPreview,
  reloadOverview,
  pt,
  onComplete,
}: {
  pendingDelete: PendingAddressDelete | null;
  setPendingDelete: (value: PendingAddressDelete) => void;
  loadPreview: (
    row: AddressRow,
    previewFresh: boolean,
    transfer?: boolean,
    targetEntityId?: string
  ) => Promise<void>;
  reloadOverview: () => Promise<unknown>;
  pt: ReturnType<typeof usePluginTranslation>;
  onComplete: () => void;
}) => {
  const [deleting, setDeleting] = useState(false);
  const confirmDelete = async () => {
    if (!pendingDelete?.preview) return;
    setDeleting(true);
    try {
      await deleteWasteAddressEntity(
        pendingDelete.row.type,
        pendingDelete.row.id,
        pendingDelete.preview.token,
        pendingDelete.targetEntityId
      );
    } catch (error) {
      if (resolveApiErrorCode(error) === 'conflict') {
        await loadPreview(
          pendingDelete.row,
          true,
          pendingDelete.transfer,
          pendingDelete.targetEntityId
        );
      } else {
        setPendingDelete({
          ...pendingDelete,
          error: pt('masterData.locationsWorkspace.addresses.deleteError'),
        });
      }
      setDeleting(false);
      return;
    }
    try {
      await reloadOverview();
    } finally {
      onComplete();
      setDeleting(false);
    }
  };
  return { deleting, confirmDelete };
};

export const useWasteAddressDeletion = (
  pt: ReturnType<typeof usePluginTranslation>,
  reloadOverview: () => Promise<unknown>
) => {
  const previewSequence = useRef(0);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingAddressDelete | null>(null);
  const loadPreview = (
    row: AddressRow,
    previewFresh = false,
    transfer = false,
    targetEntityId?: string
  ) =>
    loadDeletePreview({
      row,
      pt,
      previewSequence,
      setPendingDelete,
      previewFresh,
      transfer,
      targetEntityId,
    });
  const openDelete = async (row: AddressRow, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setPendingDelete({ row, loading: true });
    await loadPreview(row);
  };
  const reloadPreview = () => {
    if (!pendingDelete) return;
    const { row, transfer, targetEntityId } = pendingDelete;
    setPendingDelete({ row, transfer, targetEntityId, loading: true });
    void loadPreview(row, false, transfer, targetEntityId);
  };
  const { deleting, confirmDelete } = useAddressDeleteConfirmation({
    pendingDelete,
    setPendingDelete,
    loadPreview,
    reloadOverview,
    pt,
    onComplete: () => {
      triggerRef.current =
        typeof document === 'undefined'
          ? null
          : document.getElementById('waste-address-entity-type');
      setPendingDelete(null);
    },
  });
  const onChangeTransfer = (transfer: boolean, targetEntityId?: string) => {
    if (!pendingDelete || deleting) return;
    ++previewSequence.current;
    const { row } = pendingDelete;
    setPendingDelete({
      row,
      transfer,
      targetEntityId,
      loading: !transfer || Boolean(targetEntityId),
    });
    if (!transfer || targetEntityId) void loadPreview(row, false, transfer, targetEntityId);
  };
  const onCancel = () => {
    ++previewSequence.current;
    setPendingDelete(null);
  };
  return {
    pendingDelete,
    openDelete,
    dialogProps: {
      pendingDelete,
      deleting,
      triggerRef,
      onChangeTransfer,
      onCancel,
      onConfirm: confirmDelete,
      onReloadPreview: reloadPreview,
    },
  };
};
