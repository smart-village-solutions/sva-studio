import * as React from 'react';
import type { MailTemplateKind, MailTemplateView } from '@sva/core';
import { Button } from '@sva/studio-ui-react';
import { t } from '../../../i18n';
import {
  getInstanceMailTemplate,
  updateInstanceMailTemplate,
} from '../../../lib/iam-api-instance-operations';

export const MailTemplateSyncPanel = ({
  view,
  disabled,
  onReconcile,
}: {
  readonly view: MailTemplateView;
  readonly disabled?: boolean;
  readonly onReconcile: (operation: 'adopt' | 'transfer') => Promise<void>;
}) => (
  <section
    className="space-y-3 rounded-md border border-border p-3"
    aria-label={t('admin.instances.mailSync.title')}
  >
    <h3 className="text-sm font-medium">{t('admin.instances.mailSync.title')}</h3>
    <p role="status">{t(`admin.instances.mailSync.status.${view.status}`)}</p>
    {view.status !== 'synced' && view.stored.kind === 'invitation' ? (
      <p className="text-sm">{t('admin.instances.mailSync.blocked')}</p>
    ) : null}
    <details>
      <summary>{t('admin.instances.mailSync.compare')}</summary>
      <h4>{t('admin.instances.mailSync.studio')}</h4>
      <pre className="whitespace-pre-wrap break-words text-xs">
        {JSON.stringify(view.studioTexts, null, 2)}
      </pre>
      <h4>{t('admin.instances.mailSync.keycloak')}</h4>
      <pre className="whitespace-pre-wrap break-words text-xs">
        {view.keycloakTexts
          ? JSON.stringify(view.keycloakTexts, null, 2)
          : t('admin.instances.mailSync.unavailable')}
      </pre>
    </details>
    {!view.canAdopt && view.keycloakTexts ? (
      <p className="text-sm">{t('admin.instances.mailSync.unsupported')}</p>
    ) : null}
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || !view.canAdopt}
        onClick={() => {
          if (window.confirm(t('admin.instances.mailSync.adoptConfirm'))) void onReconcile('adopt');
        }}
      >
        {t('admin.instances.mailSync.adopt')}
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || !view.keycloakTexts}
        onClick={() => {
          if (window.confirm(t('admin.instances.mailSync.transferConfirm')))
            void onReconcile('transfer');
        }}
      >
        {t('admin.instances.mailSync.transfer')}
      </Button>
    </div>
  </section>
);
export const InstanceMailTemplateSync = ({
  instanceId,
  kind,
  revision,
  onReconciled,
}: {
  readonly instanceId: string;
  readonly kind: MailTemplateKind;
  readonly revision?: number;
  readonly onReconciled?: () => Promise<void>;
}) => {
  const [view, setView] = React.useState<MailTemplateView | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const load = async () => {
    setBusy(true);
    try {
      setView((await getInstanceMailTemplate(instanceId, kind)).data);
      setMessage(null);
    } catch {
      setMessage(t('admin.instances.mailSync.loadFailed'));
    } finally {
      setBusy(false);
    }
  };
  React.useEffect(() => {
    void load();
  }, [instanceId, revision]);
  const reconcile = async (operation: 'adopt' | 'transfer') => {
    if (!view || busy) return;
    setBusy(true);
    try {
      const { data } = await updateInstanceMailTemplate(instanceId, kind, {
        operation,
        expectedRevision: view.stored.revision,
        expectedStudioTexts: view.studioTexts,
        expectedKeycloakTexts: view.keycloakTexts ?? undefined,
      });
      setView(data);
      setMessage(null);
      await onReconciled?.();
    } catch {
      setMessage(t('admin.instances.mailSync.conflict'));
      setView(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" disabled={busy} onClick={() => void load()}>
        {t('admin.instances.mailSync.open')}
      </Button>
      {view ? <MailTemplateSyncPanel view={view} disabled={busy} onReconcile={reconcile} /> : null}
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
};
