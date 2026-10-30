import * as React from 'react';
import { MailTemplateSyncPanel } from './-mail-template-sync-panel';
import {
  DEFAULT_EMAIL_VERIFICATION_TEMPLATE,
  EmailVerificationTemplateError,
  validateEmailVerificationTemplate,
  type EmailVerificationTemplate,
  type MailTemplateView,
  type ServerEmailVerificationTemplateView,
} from '@sva/core';
import {
  Button,
  StudioField,
  StudioLoadingState,
  getStudioFormFieldProps,
} from '@sva/studio-ui-react';
import { Card } from '../../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { t } from '../../../i18n';
import { IamHttpError } from '../../../lib/iam-api';
import {
  getInstanceMailTemplate,
  getServerEmailVerificationTemplate,
  updateServerEmailVerificationTemplate,
  updateInstanceMailTemplate,
} from '../../../lib/iam-api-instance-operations';

type VerificationView = MailTemplateView | ServerEmailVerificationTemplateView;
type CardProps = { readonly disabled?: boolean } & (
  | { readonly mode: 'server'; readonly instanceId?: never }
  | { readonly mode?: 'instance'; readonly instanceId: string }
);
export const EmailVerificationTemplateCard = (props: CardProps) => {
  const { disabled = false, instanceId } = props;
  const server = props.mode === 'server';
  const load = () =>
    props.mode === 'server'
      ? getServerEmailVerificationTemplate()
      : getInstanceMailTemplate(props.instanceId, 'verification');
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<VerificationView | null>(null);
  const [draft, setDraft] = React.useState<EmailVerificationTemplate>(
    DEFAULT_EMAIL_VERIFICATION_TEMPLATE
  );
  const [message, setMessage] = React.useState<string | null>(null);
  const [invalidField, setInvalidField] = React.useState<'subject' | 'body' | null>(null);
  const [conflict, setConflict] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const draftState = React.useRef({ key: server ? 'server' : instanceId, dirty: false });
  React.useEffect(() => {
    if (!open) return;
    const key = server ? 'server' : instanceId;
    if (draftState.current.key !== key) draftState.current = { key, dirty: false };
    let active = true;
    setLoading(true);
    setView(null);
    setMessage(null);
    setInvalidField(null);
    setConflict(false);
    void load()
      .then(({ data }) => {
        if (active) {
          setView(data);
          if (!draftState.current.dirty) setDraft(data.template);
        }
      })
      .catch(() => {
        if (active) setMessage(t('admin.instances.emailVerification.loadFailed'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [instanceId, open, server]);
  const save = async (template: EmailVerificationTemplate | null) => {
    if (!view || disabled || savingRef.current) return;
    try {
      validateEmailVerificationTemplate(template ?? DEFAULT_EMAIL_VERIFICATION_TEMPLATE);
    } catch (error) {
      const field = error instanceof EmailVerificationTemplateError ? error.field : 'body';
      setInvalidField(field);
      document.getElementById(`verification-${field}`)?.focus();
      setMessage(t('admin.instances.emailVerification.invalid'));
      return;
    }
    setInvalidField(null);
    savingRef.current = true;
    setSaving(true);
    setMessage(null);
    try {
      let data: VerificationView;
      if (props.mode === 'server' && !('stored' in view))
        data = (
          await updateServerEmailVerificationTemplate({ template, expectedRevision: view.revision })
        ).data;
      else if (props.mode !== 'server' && 'stored' in view)
        data = (
          await updateInstanceMailTemplate(props.instanceId, 'verification', {
            template,
            operation: 'save',
            expectedRevision: view.stored.revision,
          })
        ).data;
      else return;
      setView(data);
      setDraft(data.template);
      draftState.current.dirty = false;
      setConflict(false);
      const synchronized =
        'stored' in data ? data.status === 'synced' : !data.unsynchronizedInstances?.length;
      const savedKey = server
        ? 'admin.instances.emailVerification.serverSaved'
        : 'admin.instances.emailVerification.saved';
      setMessage(t(synchronized ? savedKey : 'admin.instances.mailSync.savedPending'));
    } catch (error) {
      if (error instanceof IamHttpError && error.code === 'mail_template_conflict') {
        // Refresh the comparison baseline while retaining the unsaved draft.
        try {
          const { data } = await load();
          setView(data);
          setConflict(true);
        } catch {
          setMessage(t('admin.instances.emailVerification.loadFailed'));
          return;
        }
        setMessage(t('admin.instances.emailVerification.conflict'));
      } else
        setMessage(
          t(
            error instanceof IamHttpError && error.code === 'reauth_required'
              ? 'admin.instances.emailVerification.reauthRequired'
              : 'admin.instances.emailVerification.saveFailed'
          )
        );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const preview = draft.body
    .replaceAll(
      '{{tenantName}}',
      view && 'stored' in view ? view.tenantName : t('admin.instances.invitation.sampleTenantName')
    )
    .replaceAll('{{verificationLink}}', t('admin.instances.emailVerification.previewLink'))
    .replaceAll('{{linkExpiresIn}}', t('admin.instances.invitation.previewExpiry'));
  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-sm font-medium">
        {t(
          server
            ? 'admin.instances.emailVerification.serverTitle'
            : 'admin.instances.emailVerification.title'
        )}
      </h2>
      <p className="text-xs text-muted-foreground">
        {t(
          server
            ? 'admin.instances.emailVerification.serverDescription'
            : 'admin.instances.emailVerification.description'
        )}
      </p>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!savingRef.current) setOpen(next);
        }}
      >
        <DialogTrigger asChild>
          <Button type="button" variant="secondary" disabled={disabled}>
            {t('admin.instances.emailVerification.open')}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t(
                server
                  ? 'admin.instances.emailVerification.serverTitle'
                  : 'admin.instances.emailVerification.title'
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                server
                  ? 'admin.instances.emailVerification.serverDescription'
                  : 'admin.instances.emailVerification.description'
              )}
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <StudioLoadingState>{t('admin.instances.invitation.loading')}</StudioLoadingState>
          ) : view ? (
            <div className="space-y-4 py-4">
              <p className="text-sm">
                {t('admin.instances.invitation.source', {
                  source: t(`admin.instances.invitation.sources.${view.source}`),
                })}
              </p>
              {'stored' in view ? (
                <p className="text-sm">
                  {t('admin.instances.emailVerification.realm', { realm: view.realm })}
                </p>
              ) : null}
              {!('stored' in view) && view.unsynchronizedInstances?.length ? (
                <p role="status">
                  {t('admin.instances.mailSync.savedPending')}{' '}
                  {view.unsynchronizedInstances.join(', ')}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {t('admin.instances.emailVerification.tokens')}
              </p>
              <StudioField
                {...getStudioFormFieldProps({
                  id: 'verification-subject',
                  error:
                    invalidField === 'subject'
                      ? {
                          type: 'validate',
                          message: t('admin.instances.emailVerification.invalid'),
                        }
                      : undefined,
                })}
                label={t('admin.instances.invitation.subject')}
              >
                <Input
                  value={draft.subject}
                  maxLength={200}
                  disabled={saving || disabled}
                  onChange={(e) => {
                    draftState.current.dirty = true;
                    setDraft({ ...draft, subject: e.target.value });
                  }}
                />
              </StudioField>
              <StudioField
                {...getStudioFormFieldProps({
                  id: 'verification-body',
                  error:
                    invalidField === 'body'
                      ? {
                          type: 'validate',
                          message: t('admin.instances.emailVerification.invalid'),
                        }
                      : undefined,
                })}
                label={t('admin.instances.invitation.body')}
              >
                <Textarea
                  value={draft.body}
                  maxLength={5000}
                  rows={10}
                  disabled={saving || disabled}
                  onChange={(e) => {
                    draftState.current.dirty = true;
                    setDraft({ ...draft, body: e.target.value });
                  }}
                />
              </StudioField>
              {conflict ? (
                <details open>
                  <summary>{t('admin.instances.emailVerification.currentTexts')}</summary>
                  <pre className="whitespace-pre-wrap text-xs">
                    {view.template.subject}
                    {'\n\n'}
                    {view.template.body}
                  </pre>
                </details>
              ) : null}
              {'stored' in view ? (
                <MailTemplateSyncPanel
                  view={view}
                  disabled={saving || disabled}
                  onReconcile={async (operation) => {
                    if (savingRef.current || props.mode === 'server') return;
                    savingRef.current = true;
                    setSaving(true);
                    try {
                      const { data } = await updateInstanceMailTemplate(
                        props.instanceId,
                        'verification',
                        {
                          operation,
                          expectedRevision: view.stored.revision,
                          expectedStudioTexts: view.studioTexts,
                          expectedKeycloakTexts: view.keycloakTexts ?? undefined,
                        }
                      );
                      setView(data);
                      setDraft(data.template);
                      draftState.current.dirty = false;
                      setMessage(null);
                    } catch {
                      setMessage(t('admin.instances.mailSync.conflict'));
                    } finally {
                      savingRef.current = false;
                      setSaving(false);
                    }
                  }}
                />
              ) : null}
              <h3 className="text-sm font-medium">{t('admin.instances.invitation.preview')}</h3>
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs">
                {draft.subject}
                {'\n\n'}
                {preview}
              </pre>
            </div>
          ) : null}
          {message ? (
            <p role="status" aria-live="polite">
              {message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={!view || loading || saving || disabled}
              onClick={() => {
                if (
                  window.confirm(
                    t(
                      server
                        ? 'admin.instances.emailVerification.resetServerConfirm'
                        : 'admin.instances.emailVerification.resetConfirm'
                    )
                  )
                )
                  void save(null);
              }}
            >
              {t(
                server
                  ? 'admin.instances.emailVerification.reset'
                  : 'admin.instances.emailVerification.resetInstance'
              )}
            </Button>
            <Button
              type="button"
              disabled={!view || loading || saving || disabled}
              onClick={() => void save(draft)}
            >
              {t(saving ? 'account.actions.saving' : 'admin.instances.invitation.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
