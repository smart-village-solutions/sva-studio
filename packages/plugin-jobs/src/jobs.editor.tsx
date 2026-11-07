import { useEffect, useState, type ReactNode } from 'react';
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
  StudioDetailPageTemplate,
  StudioDetailTabs,
  StudioFormSummaryErrors,
  StudioLoadingState,
  StudioSaveButton,
  StudioPersistentFormError,
  StudioFormSummary,
  MainserverPrincipalControl,
  resolveMainserverPrincipalOptions,
  isMainserverPrincipalReady,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import type { useJobEditor } from './jobs.editor-state.js';
import { JobBasisFields, JobContentFields, jobFieldId } from './jobs.fields.js';
type Props = Readonly<{
  state: ReturnType<typeof useJobEditor>;
  principalControl?: MainserverPrincipalControlModel;
  history: ReactNode;
}>;
export function JobEditor({ state: s, principalControl, history }: Props) {
  const pt = usePluginTranslation('jobs');
  const { id } = s;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const created = !id && Boolean(s.record);
  const canSave =
    (id ? Boolean(s.record) && s.access.canUpdate : s.access.canCreate) &&
    !s.record?.writeBlockedReason &&
    !created &&
    !s.deleted &&
    !s.loading;
  const disabled = s.busy || s.deleted || Boolean(s.pending) || !canSave;
  return (
    <StudioDetailPageTemplate
      stickyActions
      title={pt(id ? 'editor.edit' : 'editor.create')}
      description={!id ? pt('editor.intro') : undefined}
      actions={
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
      }
      primaryAction={
        canSave ? (
          <EditorSaveButton s={s} disabled={disabled} principalControl={principalControl} />
        ) : undefined
      }
    >
      {s.loading ? (
        <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>
      ) : (
        <form
          id="job-form"
          className="space-y-6"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave && !disabled) void s.save();
          }}
        >
          <EditorFeedback s={s} created={created} />
          <EditorPrincipal s={s} created={created} principalControl={principalControl} />
          {!s.deleted ? <EditorPanels s={s} disabled={disabled} history={history} /> : null}
        </form>
      )}
    </StudioDetailPageTemplate>
  );
}

function EditorFeedback({ s, created }: Readonly<{ s: Props['state']; created: boolean }>) {
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
function EditorPrincipal({
  s,
  created,
  principalControl,
}: Readonly<{
  s: Props['state'];
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
function focusMediaUrl(field: string) {
  const mediaUrl = /^job-mediaContents-(\d+)-sourceUrl-url$/.exec(field);
  if (mediaUrl)
    globalThis.setTimeout(() => {
      const input = document.querySelectorAll<HTMLInputElement>(
        '#job-mediaContents input[id^="content-media-"][id$="-url"]'
      )[Number(mediaUrl[1])];
      if (!input) return;
      const details = input.closest('details');
      if (details) details.open = true;
      input.focus();
    }, 0);
}
function EditorPanels({
  s,
  disabled,
  history,
}: Readonly<{ s: Props['state']; disabled: boolean; history: ReactNode }>) {
  const pt = usePluginTranslation('jobs');
  const { id } = s;
  const [tab, setTab] = useState<'basis' | 'content' | 'history'>('basis');
  useEffect(() => {
    const path = s.errors[0];
    if (!path) return;
    const field = jobFieldId(path);
    setTab(
      /^job-(title|externalId|employmentType|publicationDate|dates|visible)/.test(field)
        ? 'basis'
        : 'content'
    );
    const timer = globalThis.setTimeout(() => {
      focusMediaUrl(field);
      const element = document.getElementById(field);
      for (let parent = element?.parentElement; parent; parent = parent.parentElement)
        if (parent instanceof HTMLDetailsElement) parent.open = true;
      const control = element?.matches('input,select,textarea,[contenteditable],button')
        ? element
        : element?.querySelector<HTMLElement>('input,select,textarea,[contenteditable],button');
      (control as HTMLElement | null)?.focus();
    }, 0);
    return () => globalThis.clearTimeout(timer);
  }, [s.errors]);

  const lifecycle = s.record
    ? s.record.visible
      ? 'content.changeStatus'
      : 'content.publish'
    : 'content.publish';
  const canPublish = s.record
    ? s.access.session.unscopedPermissionActions.includes(lifecycle) ||
      s.resourceAccess[lifecycle] === true
    : s.access.permissionActions.includes(lifecycle);
  const fields = {
    draft: s.draft,
    change: s.change,
    errors: s.errors,
    categories: s.categories,
    categoriesLoading: s.categoriesLoading,
    categoryError: s.categoryError,
    disabled,
    canPublish,
  };
  const content = (
    <fieldset disabled={disabled} className="min-w-0 space-y-6">
      <JobContentFields {...fields} />
    </fieldset>
  );
  const basis = (
    <fieldset disabled={disabled} className="min-w-0 space-y-6">
      <JobBasisFields {...fields} />
    </fieldset>
  );
  const tabs = [
    { id: 'basis' as const, label: pt('tabs.basis'), icon: 'basis' as const, panel: basis },
    { id: 'content' as const, label: pt('tabs.content'), icon: 'content' as const, panel: content },
    {
      id: 'history' as const,
      label: pt('tabs.history'),
      icon: 'history' as const,
      panel: history,
    },
  ];
  return (
    <>
      <StudioFormSummaryErrors
        onSelectError={({ field }) => {
          setTab(
            /^job-(title|externalId|employmentType|publicationDate|dates|visible)/.test(field)
              ? 'basis'
              : 'content'
          );
          focusMediaUrl(field);
        }}
        title={pt('validation.summary')}
        errors={[...new Set(s.errors.map(jobFieldId))].map((field) => ({
          field,
          message: pt('validation.invalid'),
        }))}
      />

      {id ? (
        <StudioDetailTabs
          ariaLabel={pt('tabs.label')}
          mobileSelectLabel={pt('tabs.label')}
          value={tab}
          onValueChange={setTab}
          tabs={tabs}
          keepMounted
        />
      ) : (
        <>
          {basis}
          {content}
        </>
      )}
    </>
  );
}

function EditorSaveButton({
  s,
  disabled,
  principalControl,
}: Readonly<{
  s: Props['state'];
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
