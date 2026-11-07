import { useEffect, useState, type ReactNode } from 'react';
import { usePluginTranslation, type MainserverActingPrincipalType } from '@sva/plugin-sdk';
import {
  StudioDetailPageTemplate,
  StudioDetailTabs,
  StudioFormSummaryErrors,
  StudioLoadingState,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import type { useJobEditor } from './jobs.editor-state.js';
import { JobBasisFields, JobContentFields, jobFieldId } from './jobs.fields.js';
import { canPublishJob } from './jobs.access.js';
import {
  EditorActions,
  EditorFeedback,
  EditorPrincipal,
  EditorSaveButton,
} from './jobs.editor-feedback.js';
type Props = Readonly<{
  state: ReturnType<typeof useJobEditor>;
  principalControl?: MainserverPrincipalControlModel;
  history: ReactNode;
  onPrincipalChange: (principal: MainserverActingPrincipalType) => void;
}>;
function editorCanSave(s: Props['state'], created: boolean): boolean {
  const { id } = s;
  return (
    (id ? Boolean(s.record) && s.access.canUpdate : s.access.canCreate) &&
    !s.record?.writeBlockedReason &&
    !created &&
    !s.deleted &&
    !s.loading
  );
}
export function JobEditor({ state: s, principalControl, history, onPrincipalChange }: Props) {
  const pt = usePluginTranslation('jobs');
  const { id } = s;
  const created = !id && Boolean(s.record);
  const canSave = editorCanSave(s, created);
  const disabled = s.busy || s.deleted || Boolean(s.pending) || !canSave;
  return (
    <StudioDetailPageTemplate
      stickyActions
      title={pt(id ? 'editor.edit' : 'editor.create')}
      description={!id ? pt('editor.intro') : undefined}
      actions={<EditorActions s={s} />}
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
          <EditorPrincipal
            s={s}
            created={created}
            principalControl={principalControl}
            onPrincipalChange={onPrincipalChange}
          />
          {!s.deleted ? <EditorPanels s={s} disabled={disabled} history={history} /> : null}
        </form>
      )}
    </StudioDetailPageTemplate>
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
function focusJobError(field: string) {
  focusMediaUrl(field);
  const element = document.getElementById(field);
  for (let parent = element?.parentElement; parent; parent = parent.parentElement)
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  const control = element?.matches('input,select,textarea,[contenteditable],button')
    ? element
    : element?.querySelector<HTMLElement>('input,select,textarea,[contenteditable],button');
  (control as HTMLElement | null)?.focus();
}
function useErrorFocus(errors: readonly string[], setTab: (tab: 'basis' | 'content') => void) {
  useEffect(() => {
    const path = errors[0];
    if (!path) return;
    const field = jobFieldId(path);
    setTab(
      /^job-(title|externalId|employmentType|publicationDate|dates|visible)/.test(field)
        ? 'basis'
        : 'content'
    );
    const timer = globalThis.setTimeout(() => {
      focusJobError(field);
    }, 0);
    return () => globalThis.clearTimeout(timer);
  }, [errors, setTab]);
}
function EditorPanels({
  s,
  disabled,
  history,
}: Readonly<{ s: Props['state']; disabled: boolean; history: ReactNode }>) {
  const pt = usePluginTranslation('jobs');
  const { id } = s;
  const [tab, setTab] = useState<'basis' | 'content' | 'history'>('basis');
  useErrorFocus(s.errors, setTab);

  const canPublish = canPublishJob(s.record, s.access, s.resourceAccess);
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
