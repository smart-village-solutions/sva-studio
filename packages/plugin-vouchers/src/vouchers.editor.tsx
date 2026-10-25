import { Link, useParams } from '@tanstack/react-router';
import { Button, StudioDetailPageTemplate } from '@sva/studio-ui-react';
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
  disabled,
}: Readonly<{
  state: VoucherEditorState;
  actions: VoucherEditorActions;
  disabled: boolean;
}>) {
  const availableLocations =
    s.record?.pointOfInterest &&
    !s.locations.some((location) => location.id === s.record?.pointOfInterest?.id)
      ? [s.record.pointOfInterest, ...s.locations]
      : s.locations;
  return (
    <form
      id="voucher-editor-form"
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
      </fieldset>
    </form>
  );
}
function voucherSaveLabel(state: VoucherEditorState): string {
  return state.busy
    ? 'messages.saving'
    : state.id
      ? 'actions.update'
      : state.draft.visible
        ? 'actions.saveVisible'
        : 'actions.saveHidden';
}
export function VoucherEditor(props: VoucherEditorProps) {
  const state = useVoucherEditorState(props);
  const actions = useVoucherEditorActions(state);
  const disabled =
    state.busy ||
    state.unknown ||
    (state.record !== null && state.record.id !== state.id) ||
    Boolean(state.preparation) ||
    (state.id ? !state.access.canUpdate : !state.access.canCreate);
  return (
    <StudioDetailPageTemplate
      stickyActions
      title={state.t(state.id ? 'editor.edit' : 'editor.create')}
      description={state.t('editor.intro')}
      actions={
        <Button asChild variant="secondary">
          <Link to="/admin/vouchers">{state.t('actions.back')}</Link>
        </Button>
      }
      primaryAction={
        !state.loading ? (
          <Button
            type="submit"
            form="voucher-editor-form"
            disabled={disabled || (Boolean(state.id) && !state.hasChanges)}
          >
            {state.t(voucherSaveLabel(state))}
          </Button>
        ) : undefined
      }
    >
      <VoucherEditorHeader state={state} actions={actions} />
      {state.loading ? (
        <p role="status">{state.t('messages.loading')}</p>
      ) : (
        <>
          <VoucherEditorUsage state={state} actions={actions} />
          {state.record && <VoucherHistory id={state.record.id} />}
          <VoucherEditorForm state={state} actions={actions} disabled={disabled} />
          <VoucherResetDialog state={state} actions={actions} />
        </>
      )}
    </StudioDetailPageTemplate>
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
