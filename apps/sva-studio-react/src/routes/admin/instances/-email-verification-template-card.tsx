import {
  Button,
  StudioField,
  StudioLoadingState,
  getStudioFormFieldProps,
} from '@sva/studio-ui-react';
import { MailTemplateSyncPanel } from './-mail-template-sync-panel';
import {
  useEmailVerificationTemplate,
  type VerificationCardProps,
} from './-use-email-verification-template';
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

const VerificationForm = ({
  editor,
  disabled,
}: {
  editor: ReturnType<typeof useEmailVerificationTemplate>;
  disabled: boolean;
}) => {
  const { view, draft, invalidField, conflict, changeDraft, reconcile } = editor;
  if (!view) return null;
  const preview = draft.body
    .replaceAll(
      '{{tenantName}}',
      view && 'stored' in view ? view.tenantName : t('admin.instances.invitation.sampleTenantName')
    )
    .replaceAll('{{verificationLink}}', t('admin.instances.emailVerification.previewLink'))
    .replaceAll('{{linkExpiresIn}}', t('admin.instances.invitation.previewExpiry'));
  return (
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
          {t('admin.instances.mailSync.savedPending')} {view.unsynchronizedInstances.join(', ')}
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
          disabled={disabled}
          onChange={(e) => {
            changeDraft({ ...draft, subject: e.target.value });
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
          disabled={disabled}
          onChange={(e) => {
            changeDraft({ ...draft, body: e.target.value });
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
        <MailTemplateSyncPanel view={view} disabled={disabled} onReconcile={reconcile} />
      ) : null}
      <h3 className="text-sm font-medium">{t('admin.instances.invitation.preview')}</h3>
      <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs">
        {draft.subject}
        {'\n\n'}
        {preview}
      </pre>
    </div>
  );
};

export const EmailVerificationTemplateCard = (props: VerificationCardProps) => {
  const { disabled = false } = props;
  const server = props.mode === 'server';
  const editor = useEmailVerificationTemplate(props);
  const { open, view, draft, message, loading, saving, save, changeOpen } = editor;
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
      <Dialog open={open} onOpenChange={changeOpen}>
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
          ) : (
            <VerificationForm editor={editor} disabled={saving || disabled} />
          )}

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
