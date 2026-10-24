import { useParams } from '@tanstack/react-router';
import { Button } from '@sva/studio-ui-react';
import { VoucherFormSections } from './vouchers.form.js';
import { VoucherHistory } from './vouchers.history.js';
import {
  useVoucherEditorState,
  type VoucherEditorProps,
  type VoucherEditorState,
} from './vouchers.editor-state.js';
import { useVoucherEditorActions, type VoucherEditorActions } from './vouchers.editor-actions.js';
import {
  VoucherEditorHeader,
  VoucherEditorUsage,
  VoucherResetDialog,
} from './vouchers.editor-panels.js';
function VoucherEditorForm({
  state: s,
  actions,
}: Readonly<{
  state: VoucherEditorState;
  actions: VoucherEditorActions;
}>) {
  const availableLocations =
    s.record?.pointOfInterest &&
    !s.locations.some((location) => location.id === s.record?.pointOfInterest?.id)
      ? [s.record.pointOfInterest, ...s.locations]
      : s.locations;
  const disabled =
    s.busy ||
    s.unknown ||
    (s.record !== null && s.record.id !== s.id) ||
    Boolean(s.preparation) ||
    (s.id ? !s.access.canUpdate : !s.access.canCreate);
  const saveLabel = s.busy
    ? 'messages.saving'
    : s.id
      ? 'actions.update'
      : s.draft.visible
        ? 'actions.saveVisible'
        : 'actions.saveHidden';
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void actions.prepare();
      }}
      className="space-y-6"
    >
      <fieldset disabled={disabled} className="space-y-6">
        <VoucherFormSections
          draft={s.draft}
          edit={Boolean(s.id)}
          canPublish={s.access.canPublish}
          errors={s.errors}
          locations={availableLocations}
          categories={s.categories}
          hasMoreLocations={s.hasMore}
          loadMoreLocations={() => s.setLocationPage((page) => page + 1)}
          discountChosen={s.discountChosen}
          chooseDiscount={() => s.setDiscountChosen(true)}
          change={actions.change}
        />
        <Button type="submit" disabled={Boolean(s.preparation) || (Boolean(s.id) && !s.hasChanges)}>
          {s.t(saveLabel)}
        </Button>
      </fieldset>
    </form>
  );
}
export function VoucherEditor(props: VoucherEditorProps) {
  const state = useVoucherEditorState(props);
  const actions = useVoucherEditorActions(state);
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <VoucherEditorHeader state={state} actions={actions} />
      {state.loading ? (
        <p role="status">{state.t('messages.loading')}</p>
      ) : (
        <>
          <VoucherEditorUsage state={state} actions={actions} />
          {state.record && <VoucherHistory id={state.record.id} />}
          <VoucherEditorForm state={state} actions={actions} />
          <VoucherResetDialog state={state} actions={actions} />
        </>
      )}
    </main>
  );
}
export const VouchersCreatePage = (props: Omit<VoucherEditorProps, 'id'>) => (
  <VoucherEditor {...props} />
);
export function VouchersEditPage(props: Omit<VoucherEditorProps, 'id'>) {
  const params = useParams({ strict: false }) as {
    id?: string;
    contentId?: string;
  };
  return <VoucherEditor {...props} id={params.contentId ?? params.id} />;
}
