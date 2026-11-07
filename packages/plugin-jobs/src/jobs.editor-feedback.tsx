import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  StudioPersistentFormError,
  StudioFormSummary,
  MainserverPrincipalControl,
  resolveMainserverPrincipalOptions,
  StudioSaveButton,
  isMainserverPrincipalReady,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import type { useJobEditor } from './jobs.editor-state.js';
type JobEditorState = ReturnType<typeof useJobEditor>;

export function EditorFeedback({ s, created }: Readonly<{ s: JobEditorState; created: boolean }>) {
  const pt = usePluginTranslation('jobs');
  return (
    <>
      {s.failure ? <StudioPersistentFormError message={pt(s.failure)} /> : null}
      {s.message === 'messages.saved' || s.message === 'messages.deleted' ? (
        <StudioFormSummary kind="success">{pt(s.message)}</StudioFormSummary>
      ) : s.message ? (
        <p role="status">{pt(s.message)}</p>
      ) : null}
      {s.record?.writeBlockedReason ? <p role="alert">{pt('messages.blocked')}</p> : null}
      {s.categoryError ? <p role="status">{pt('messages.categoryError')}</p> : null}
      {s.pending ? (
        <StudioPersistentFormError
          message={pt(s.pending.kind === 'delete' ? 'messages.deleteUnknown' : 'messages.unknown')}
          retryLabel={pt(s.pending.kind === 'delete' ? 'actions.checkDelete' : 'actions.recover')}
          retryDisabled={s.busy}
          onRetry={() => void s.recover()}
        />
      ) : null}
      {created && s.record && !s.pending ? (
        <Button asChild>
          <Link to="/admin/jobs/$id" params={{ id: s.record.id }}>
            {pt('actions.openSaved')}
          </Link>
        </Button>
      ) : null}
    </>
  );
}
export function EditorPrincipal({
  s,
  created,
  principalControl,
}: Readonly<{
  s: JobEditorState;
  created: boolean;
  principalControl?: MainserverPrincipalControlModel;
}>) {
  const pt = usePluginTranslation('jobs');
  const { id } = s;
  return (
    <fieldset disabled={s.busy || s.dirty || Boolean(s.pending) || created}>
      <MainserverPrincipalControl
        fixedLabel={!id ? pt('principal.responsible') : undefined}
        id="job-principal"
        label={pt(id ? 'principal.actAs' : 'principal.createAs')}
        value={s.principal}
        onChange={s.setPrincipal}
        options={resolveMainserverPrincipalOptions(principalControl, {
          value: s.principal,
          label: pt(`principal.${s.principal}`),
        })}
        contextOptions={principalControl?.contextOptions}
        onContextChange={principalControl?.onContextChange}
        readinessByPrincipal={principalControl?.readinessByPrincipal}
        readinessMessage={principalControl?.readinessMessage}
      />
    </fieldset>
  );
}
export function EditorSaveButton({
  s,
  disabled,
  principalControl,
}: Readonly<{
  s: JobEditorState;
  disabled: boolean;
  principalControl?: MainserverPrincipalControlModel;
}>) {
  const pt = usePluginTranslation('jobs');
  const { id } = s;
  return (
    <StudioSaveButton
      type="submit"
      form="job-form"
      status={s.busy ? 'saving' : s.message === 'messages.saved' ? 'saved' : 'idle'}
      disabled={disabled || (!id && !isMainserverPrincipalReady(principalControl, s.principal))}
      labels={{
        idle: pt(id ? 'actions.update' : 'actions.create'),
        saving: pt('actions.saving'),
        saved: pt('actions.saved'),
      }}
    />
  );
}
export function EditorActions({ s }: Readonly<{ s: JobEditorState }>) {
  const pt = usePluginTranslation('jobs');
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="secondary">
        <Link to="/admin/content" search={{ type: 'jobs.job', page: 1 }}>
          {pt('actions.back')}
        </Link>
      </Button>
      {s.record && s.access.canDelete && !s.deleted && !s.loading ? (
        <Button
          type="button"
          variant="destructive"
          disabled={s.busy || Boolean(s.pending)}
          onClick={() => setConfirmDelete(true)}
        >
          {pt('actions.delete')}
        </Button>
      ) : null}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pt('confirmation.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pt('confirmation.description', { title: s.record?.title ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{pt('actions.cancel')}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmDelete(false);
                void s.remove();
              }}
            >
              {pt('actions.delete')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
