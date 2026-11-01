import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioDetailPageTemplate,
  StudioDetailTabs,
  StudioFormSummaryErrors,
  StudioLoadingState,
  StudioSaveButton,
  MainserverPrincipalControl,
  resolveMainserverPrincipalOptions,
  isMainserverPrincipalReady,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import type { useConstructionSiteEditor } from './construction-sites.editor-state.js';
import {
  ConstructionSiteBasisFields,
  ConstructionSiteContentFields,
  constructionSiteFieldId,
} from './construction-sites.fields.js';
type Props = Readonly<{
  state: ReturnType<typeof useConstructionSiteEditor>;
  principalControl?: MainserverPrincipalControlModel;
  history: ReactNode;
}>;
export function ConstructionSiteEditor({ state: s, principalControl, history }: Props) {
  const pt = usePluginTranslation('construction-sites');
  const { id } = s;
  const created = !id && Boolean(s.record);
  const canSave =
    (id ? Boolean(s.record) && s.access.canUpdate : s.access.canCreate) &&
    !s.record?.writeBlockedReason &&
    !created;
  const disabled = s.busy || Boolean(s.pending) || !canSave;
  return (
    <StudioDetailPageTemplate
      stickyActions
      title={pt(id ? 'editor.edit' : 'editor.create')}
      description={!id ? pt('editor.intro') : undefined}
      actions={
        <Button asChild variant="secondary">
          <Link
            to="/admin/content"
            search={{ type: 'construction-sites.construction-site', page: 1 }}
          >
            {pt('actions.back')}
          </Link>
        </Button>
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
          id="construction-site-form"
          className="space-y-6"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave && !disabled) void s.save();
          }}
        >
          <EditorFeedback s={s} created={created} />
          <EditorPrincipal s={s} created={created} principalControl={principalControl} />
          <EditorPanels s={s} disabled={disabled} history={history} />
        </form>
      )}
    </StudioDetailPageTemplate>
  );
}

function EditorFeedback({ s, created }: Readonly<{ s: Props['state']; created: boolean }>) {
  const pt = usePluginTranslation('construction-sites');
  return (
    <>
      {s.failure ? (
        <p role="alert" className="text-destructive">
          {pt(s.failure)}
        </p>
      ) : null}
      {s.message ? <p role="status">{pt(s.message)}</p> : null}
      {s.record?.writeBlockedReason ? <p role="alert">{pt('messages.blocked')}</p> : null}
      {s.categoryError ? <p role="status">{pt('messages.categoryError')}</p> : null}
      {s.pending ? (
        <div className="space-y-2">
          <p role="alert">{pt('messages.unknown')}</p>
          <Button type="button" disabled={s.busy} onClick={() => void s.recover()}>
            {pt('actions.recover')}
          </Button>
        </div>
      ) : null}
      {created && s.record && !s.pending ? (
        <Button asChild>
          <Link to="/admin/construction-sites/$id" params={{ id: s.record.id }}>
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
  const pt = usePluginTranslation('construction-sites');
  const { id } = s;
  return (
    <fieldset disabled={s.busy || s.dirty || Boolean(s.pending) || created}>
      <MainserverPrincipalControl
        id="cs-principal"
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
  const mediaUrl = /^cs-mediaContents-(\d+)-sourceUrl-url$/.exec(field);
  if (mediaUrl)
    globalThis.setTimeout(() => {
      const input = document.querySelectorAll<HTMLInputElement>(
        '#cs-mediaContents input[id^="content-media-"][id$="-url"]'
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
  const pt = usePluginTranslation('construction-sites');
  const { id } = s;
  const [tab, setTab] = useState<'basis' | 'content' | 'history'>('basis');
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
    disabled,
    canPublish,
  };
  const content = (
    <fieldset disabled={disabled} className="min-w-0 space-y-6">
      <ConstructionSiteContentFields {...fields} />
    </fieldset>
  );
  const basis = (
    <fieldset disabled={disabled} className="min-w-0 space-y-6">
      <ConstructionSiteBasisFields {...fields} />
    </fieldset>
  );
  const tabs = [
    { id: 'basis' as const, label: pt('tabs.basis'), panel: basis },
    { id: 'content' as const, label: pt('tabs.content'), panel: content },
    {
      id: 'history' as const,
      label: pt('tabs.history'),
      panel: history,
    },
  ];
  return (
    <>
      <StudioFormSummaryErrors
        onSelectError={({ field }) => {
          setTab(/^cs-(title|dates|visible)/.test(field) ? 'basis' : 'content');
          focusMediaUrl(field);
        }}
        title={pt('validation.summary')}
        errors={[...new Set(s.errors.map(constructionSiteFieldId))].map((field) => ({
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
  const pt = usePluginTranslation('construction-sites');
  const { id } = s;
  return (
    <StudioSaveButton
      type="submit"
      form="construction-site-form"
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
