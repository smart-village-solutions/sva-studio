import { useEffect, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  useStudioEditorLeaveGuard,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import {
  getVoucher,
  listVoucherCategories,
  listVoucherLocations,
  type VoucherPreparation,
} from './vouchers.api.js';
import { useVoucherAccess } from './vouchers.access.js';
import { emptyVoucherDraft, voucherToDraft, type VoucherDraft } from './vouchers.form-model.js';
import type { VoucherRecord } from './vouchers.types.js';
export type VoucherEditorProps = Readonly<{
  principalControl?: MainserverPrincipalControlModel;
  id?: string;
}>;
function useVoucherForm() {
  const [draft, setDraft] = useState<VoucherDraft>(emptyVoucherDraft);
  const [record, setRecord] = useState<VoucherRecord | null>(null);
  const [resourceAccess, setResourceAccess] = useState<Readonly<Record<string, boolean>>>({});
  const [dirty, setDirty] = useState(false);
  const [savedDraft, setSavedDraft] = useState('');
  const [baseFingerprint, setBaseFingerprint] = useState<string | undefined>();
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const [discountChosen, setDiscountChosen] = useState(false);
  const [preparation, setPreparation] = useState<VoucherPreparation | null>(null);
  const [unknown, setUnknown] = useState(false);
  const [fetchedAt, setFetchedAt] = useState('');
  return {
    draft,
    setDraft,
    record,
    setRecord,
    resourceAccess,
    setResourceAccess,
    dirty,
    setDirty,
    savedDraft,
    setSavedDraft,
    baseFingerprint,
    setBaseFingerprint,
    errors,
    setErrors,
    discountChosen,
    setDiscountChosen,
    preparation,
    setPreparation,
    unknown,
    setUnknown,
    fetchedAt,
    setFetchedAt,
    message,
    setMessage,
    failure,
    setFailure,
  };
}
function useVoucherStatus(principalControl?: MainserverPrincipalControlModel) {
  const [principal, setPrincipal] = useState<MainserverPrincipalType>(
    principalControl?.value ?? 'user'
  );
  const [locations, setLocations] = useState<
    readonly {
      id: string;
      name: string;
    }[]
  >([]);
  const [categories, setCategories] = useState<
    readonly {
      id: string;
      name: string;
    }[]
  >([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (principalControl) setPrincipal(principalControl.value);
  }, [principalControl]);
  return {
    principal,
    setPrincipal,
    locations,
    setLocations,
    categories,
    setCategories,
    locationsLoading,
    setLocationsLoading,
    loading,
    setLoading,
    busy,
    setBusy,
  };
}
export function useVoucherEditorState(props: VoucherEditorProps) {
  const form = useVoucherForm();
  const status = useVoucherStatus(props.principalControl);
  const t = usePluginTranslation('vouchers');
  const access = useVoucherAccess(form.resourceAccess);
  const hasChanges = props.id ? JSON.stringify(form.draft) !== form.savedDraft : form.dirty;
  const guard = useStudioEditorLeaveGuard({
    enabled: true,
    hasUnsavedChanges: hasChanges || form.unknown,
  });
  const state = { ...props, ...form, ...status, t, access, hasChanges, guard };
  useVoucherRecordLoad(state);
  useVoucherLocationLoad(state);
  return state;
}
export type VoucherEditorState = ReturnType<typeof useVoucherForm> &
  ReturnType<typeof useVoucherStatus> &
  VoucherEditorProps & {
    t: ReturnType<typeof usePluginTranslation>;
    access: ReturnType<typeof useVoucherAccess>;
    hasChanges: boolean;
    guard: ReturnType<typeof useStudioEditorLeaveGuard>;
  };
function useVoucherRecordLoad(state: VoucherEditorState): void {
  useEffect(() => {
    let active = true;
    state.setLoading(true);
    state.setFailure('');
    state.setPreparation(null);
    const pending = Boolean(
      sessionStorage.getItem(`voucher-pending:${state.principal}:${state.id ?? 'new'}`)
    );
    state.setUnknown(pending);
    void Promise.all([
      listVoucherCategories().catch(() => {
        if (active) state.setFailure(state.t('messages.categoriesUnavailable'));
        return { data: [] };
      }),
      state.id && !pending ? getVoucher(state.id, state.principal) : Promise.resolve(null),
    ])
      .then(([choices, value]) => {
        if (!active) return;
        state.setCategories(choices.data);
        state.setRecord(value?.data ?? null);
        state.setBaseFingerprint(value?.data.contentFingerprint);
        state.setResourceAccess(value?.meta.access ?? {});
        const nextDraft = value ? voucherToDraft(value.data) : emptyVoucherDraft();
        state.setDraft(nextDraft);
        state.setSavedDraft(JSON.stringify(nextDraft));
        state.setDirty(false);
        state.setUnknown(
          Boolean(sessionStorage.getItem(`voucher-pending:${state.principal}:${state.id ?? 'new'}`))
        );
        state.setFetchedAt(value?.fetchedAt ?? '');
        state.setDiscountChosen(
          Boolean(value) &&
            [
              value?.data.discountType?.discountPercentage,
              value?.data.discountType?.discountAmount,
              value?.data.discountType?.discountedPrice,
            ].filter((number) => number != null).length === 1
        );
      })
      .catch(() => {
        if (active) state.setFailure(state.t('messages.error'));
      })
      .finally(() => {
        if (active) state.setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [state.id, state.principal, state.t]);
}
function useVoucherLocationLoad(state: VoucherEditorState): void {
  useEffect(() => {
    let active = true;
    state.setLocations([]);
    state.setLocationsLoading(true);
    const loadLocations = async () => {
      const choices: { id: string; name: string }[] = [];
      for (let page = 1; active; page += 1) {
        const value = await listVoucherLocations(page, state.principal);
        if (!active) return;
        choices.push(...value.data);
        state.setLocations([...choices]);
        if (!value.pagination.hasNextPage) return;
      }
    };
    void loadLocations()
      .catch(() => {
        if (active) state.setFailure(state.t('messages.error'));
      })
      .finally(() => {
        if (active) state.setLocationsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [state.principal, state.t]);
}
