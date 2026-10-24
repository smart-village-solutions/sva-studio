import { Link } from '@tanstack/react-router';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  Button,
  MainserverPrincipalControl,
  resolveMainserverPrincipalOptions,
  StudioErrorState,
} from '@sva/studio-ui-react';
import { VoucherUsageView } from './vouchers.usage-view.js';
import type { VoucherEditorState } from './vouchers.editor-state.js';
import type { VoucherEditorActions } from './vouchers.editor-actions.js';
type Props = Readonly<{
  state: VoucherEditorState;
  actions: VoucherEditorActions;
}>;
export function VoucherEditorHeader({ state: s, actions }: Props) {
  const options = resolveMainserverPrincipalOptions(s.principalControl, {
    value: 'user',
    label: s.t('values.user'),
  });
  return (
    <>
      <Link to="/admin/vouchers" className="underline">
        {s.t('actions.back')}
      </Link>
      <h1 className="text-2xl font-semibold">{s.t(s.id ? 'editor.edit' : 'editor.create')}</h1>
      <p className="text-muted-foreground">{s.t('editor.intro')}</p>
      <fieldset disabled={s.busy || s.hasChanges || s.unknown}>
        <MainserverPrincipalControl
          id="voucher-principal"
          label={s.t('fields.principal')}
          value={s.principal}
          options={options}
          onChange={(value) => {
            s.setLocationPage(1);
            s.setPrincipal(value);
          }}
          contextOptions={s.principalControl?.contextOptions}
          onContextChange={s.principalControl?.onContextChange}
        />
      </fieldset>
      {s.unknown && <p role="alert">{s.t('messages.unknown')}</p>}
      {s.unknown && (
        <Button type="button" disabled={s.busy} onClick={() => void actions.reconcile()}>
          {s.t('actions.reconcile')}
        </Button>
      )}
      {s.record && s.record.id !== s.id && (
        <Link to="/admin/vouchers/$id" params={{ id: s.record.id }} className="underline">
          {s.t('actions.edit')}
        </Link>
      )}
      {s.failure && <StudioErrorState>{s.failure}</StudioErrorState>}
      {s.message && <p role="status">{s.message}</p>}
    </>
  );
}
export function VoucherEditorUsage({ state: s, actions }: Props) {
  if (!s.record) return null;
  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <VoucherUsageView quota={s.record.quota} fetchedAt={s.fetchedAt} />
      {s.record.discountType &&
        [
          s.record.discountType.discountPercentage,
          s.record.discountType.discountAmount,
          s.record.discountType.discountedPrice,
        ].filter((value) => value != null).length > 1 && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p>{s.t('help.mixedDiscount')}</p>
            <ul>
              {(
                [
                  ['percentage', s.record.discountType.discountPercentage],
                  ['amount', s.record.discountType.discountAmount],
                  ['price', s.record.discountType.discountedPrice],
                ] as const
              )
                .filter(([, value]) => value != null)
                .map(([mode, value]) => (
                  <li key={mode}>
                    {s.t(`values.${mode}`)}: {value}
                  </li>
                ))}
            </ul>
          </div>
        )}
      <Button
        type="button"
        variant="secondary"
        disabled={s.busy}
        onClick={() => void actions.refresh()}
      >
        {s.t('actions.refresh')}
      </Button>
      {s.access.canPublish && (
        <Button
          type="button"
          variant="secondary"
          disabled={s.busy || s.hasChanges || s.unknown}
          onClick={() => void actions.toggle()}
        >
          {s.t(s.record.visible ? 'actions.hide' : 'actions.show')}
        </Button>
      )}
      {s.hasChanges && <p>{s.t('messages.dirtyVisibility')}</p>}
    </section>
  );
}
export function VoucherResetDialog({ state: s, actions }: Props) {
  return (
    <AlertDialog
      open={Boolean(s.preparation)}
      onOpenChange={(open) => {
        if (!open && !s.busy) s.setPreparation(null);
      }}
    >
      <AlertDialogContent
        onEscapeKeyDown={(event) => {
          if (s.busy) event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{s.t('confirmation.title')}</AlertDialogTitle>
          <AlertDialogDescription>{s.t('confirmation.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="font-medium">{s.preparation?.poiName}</p>
        <ul className="list-disc pl-6">
          {s.preparation?.affected.map((item) => (
            <li key={item.id}>{item.title}</li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={s.busy}>{s.t('actions.cancel')}</AlertDialogCancel>
          <Button
            type="button"
            disabled={s.busy}
            onClick={() => {
              if (s.preparation) void actions.save(s.preparation);
            }}
          >
            {s.t('actions.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
