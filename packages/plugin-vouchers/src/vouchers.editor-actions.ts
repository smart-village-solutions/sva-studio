import { useNavigate } from '@tanstack/react-router';
import { MainserverApiError } from '@sva/plugin-sdk';
import {
  changeVoucherVisibility,
  commitVoucher,
  getVoucher,
  prepareVoucher,
  reconcileVoucher,
  type VoucherPreparation,
} from './vouchers.api.js';
import {
  parseVoucherDraft,
  voucherDraftErrors,
  voucherToDraft,
  type VoucherDraft,
} from './vouchers.form-model.js';
import type { VoucherEditorState } from './vouchers.editor-state.js';
export const changeVoucherEditor = <K extends keyof VoucherDraft>(
  state: VoucherEditorState,
  key: K,
  value: VoucherDraft[K]
) => {
  state.guard.markChanged();
  state.setDirty(true);
  state.setPreparation(null);
  state.setMessage('');
  state.setDraft((previous) => ({ ...previous, [key]: value }));
};
export const saveVoucherEditor = async (
  state: VoucherEditorState,
  navigate: ReturnType<typeof useNavigate>,
  prepared: VoucherPreparation
) => {
  state.setBusy(true);
  state.setFailure('');
  const revision = state.guard.captureRevision();
  // Keep the server-issued identity in this tab before sending the destructive request.
  const pendingKey = `voucher-pending:${state.principal}:${state.id ?? 'new'}`;
  try {
    sessionStorage.setItem(
      pendingKey,
      JSON.stringify({ preparationId: prepared.preparationId, payloadHash: prepared.payloadHash })
    );
    const response = await commitVoucher(
      parseVoucherDraft(state.draft),
      state.id,
      prepared,
      state.principal
    );
    sessionStorage.removeItem(pendingKey);
    state.setUnknown(false);
    state.setPreparation(null);
    if (state.guard.acknowledgeSaved(revision)) {
      state.setDraft(voucherToDraft(response.data));
      state.setSavedDraft(JSON.stringify(voucherToDraft(response.data)));
      state.setDirty(false);
    }
    state.setRecord(response.data);
    state.setBaseFingerprint(response.data.contentFingerprint);
    state.setFetchedAt(new Date().toISOString());
    state.setMessage(state.t(response.meta.reset ? 'messages.savedReset' : 'messages.saved'));
    if (response.data.id !== state.id) {
      try {
        await navigate({ to: '/admin/vouchers/$id', params: { id: response.data.id } });
      } catch {
        state.setFailure(state.t('messages.savedNavigation'));
      }
    }
  } catch (error) {
    if (
      error instanceof MainserverApiError &&
      [
        'forbidden',
        'voucher_invalid_input',
        'voucher_content_conflict',
        'voucher_confirmation_required',
        'voucher_no_changes',
      ].includes(error.code)
    ) {
      sessionStorage.removeItem(pendingKey);
      state.setPreparation(null);
      state.setUnknown(false);
      state.setFailure(
        error.code.startsWith('voucher_')
          ? state.t(`errors.${error.code}`)
          : state.t('messages.error')
      );
    } else {
      state.setPreparation(null);
      state.setUnknown(true);
      state.setFailure(state.t('messages.unknown'));
    }
  } finally {
    state.setBusy(false);
  }
};
export const prepareVoucherEditor = async (
  state: VoucherEditorState,
  save: (prepared: VoucherPreparation) => Promise<void>
) => {
  const invalid = [
    ...voucherDraftErrors(state.draft),
    ...(!state.discountChosen ? ['discountMode'] : []),
  ];
  state.setErrors(invalid);
  if (invalid.length) {
    document.getElementById(`voucher-${invalid[0]}`)?.focus();
    return;
  }
  state.setBusy(true);
  state.setFailure('');
  state.setMessage('');
  try {
    const result = await prepareVoucher(
      parseVoucherDraft(state.draft),
      state.id,
      state.principal,
      state.baseFingerprint
    );
    if (result.data.requiresReset) state.setPreparation(result.data);
    else await save(result.data);
  } catch (error) {
    state.setFailure(
      error instanceof MainserverApiError && error.code.startsWith('voucher_')
        ? state.t(`errors.${error.code}`)
        : state.t('messages.error')
    );
  } finally {
    state.setBusy(false);
  }
};
export const reconcileVoucherEditor = async (
  state: VoucherEditorState,
  navigate: ReturnType<typeof useNavigate>
) => {
  state.setBusy(true);
  state.setFailure('');
  try {
    const key = `voucher-pending:${state.principal}:${state.id ?? 'new'}`;
    const pending: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (
      !pending ||
      typeof pending !== 'object' ||
      !('preparationId' in pending) ||
      !('payloadHash' in pending) ||
      typeof pending.preparationId !== 'string' ||
      typeof pending.payloadHash !== 'string'
    )
      throw new Error('missing_attempt');
    const response = await reconcileVoucher(
      { preparationId: pending.preparationId, payloadHash: pending.payloadHash },
      state.principal
    );
    sessionStorage.removeItem(key);
    state.setUnknown(false);
    state.setRecord(response.data);
    state.setBaseFingerprint(response.data.contentFingerprint);
    state.setDraft(voucherToDraft(response.data));
    state.setSavedDraft(JSON.stringify(voucherToDraft(response.data)));
    state.setDirty(false);
    state.guard.acknowledgeSaved(state.guard.captureRevision());
    state.setMessage(state.t('messages.saved'));
    if (response.data.id !== state.id) {
      try {
        await navigate({ to: '/admin/vouchers/$id', params: { id: response.data.id } });
      } catch {
        state.setFailure(state.t('messages.savedNavigation'));
      }
    }
  } catch {
    state.setFailure(state.t('messages.unknown'));
  } finally {
    state.setBusy(false);
  }
};
export const refreshVoucherEditor = async (state: VoucherEditorState) => {
  if (!state.id) return;
  state.setBusy(true);
  try {
    const response = await getVoucher(state.id, state.principal);
    state.setRecord(response.data);
    if (!state.hasChanges) {
      state.setDraft(voucherToDraft(response.data));
      state.setSavedDraft(JSON.stringify(voucherToDraft(response.data)));
      state.setBaseFingerprint(response.data.contentFingerprint);
    }
    state.setFetchedAt(response.fetchedAt);
    state.setResourceAccess(response.meta.access);
  } catch {
    state.setFailure(state.t('messages.error'));
  } finally {
    state.setBusy(false);
  }
};
export const toggleVoucherEditor = async (state: VoucherEditorState) => {
  if (!state.id || !state.record || state.hasChanges || state.unknown) return;
  state.setBusy(true);
  try {
    const response = await changeVoucherVisibility(
      state.id,
      !state.record.visible,
      state.principal
    );
    state.setRecord(response.data);
    state.setBaseFingerprint(response.data.contentFingerprint);
    state.setDraft(voucherToDraft(response.data));
    state.setSavedDraft(JSON.stringify(voucherToDraft(response.data)));
    state.setFetchedAt(new Date().toISOString());
    state.setMessage(state.t('messages.saved'));
  } catch {
    state.setFailure(state.t('messages.error'));
  } finally {
    state.setBusy(false);
  }
};
export function useVoucherEditorActions(state: VoucherEditorState) {
  const navigate = useNavigate();
  const save = (prepared: VoucherPreparation) => saveVoucherEditor(state, navigate, prepared);
  return {
    save,
    change: <K extends keyof VoucherDraft>(key: K, value: VoucherDraft[K]) =>
      changeVoucherEditor(state, key, value),
    prepare: () => prepareVoucherEditor(state, save),
    reconcile: () => reconcileVoucherEditor(state, navigate),
    refresh: () => refreshVoucherEditor(state),
    toggle: () => toggleVoucherEditor(state),
  };
}
export type VoucherEditorActions = ReturnType<typeof useVoucherEditorActions>;
