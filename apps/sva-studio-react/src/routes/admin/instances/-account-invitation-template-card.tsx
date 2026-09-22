import * as React from 'react';
import {
  DEFAULT_ACCOUNT_INVITATION_TEMPLATE,
  validateAccountInvitationTemplate,
  type AccountInvitationTemplate,
  type IamInstanceDetail,
} from '@sva/core';
import { Button } from '@sva/studio-ui-react';

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

type TemplateDraft = Omit<AccountInvitationTemplate, 'revision'>;

const renderPreview = (template: TemplateDraft, instance: IamInstanceDetail): string =>
  template.body
    .replaceAll('{{tenantName}}', instance.displayName)
    .replaceAll('{{passwordSetupLink}}', `[${template.passwordSetupLinkLabel}]`)
    .replaceAll(
      '{{tenantHomepageLink}}',
      `[${template.tenantHomepageLinkLabel}: https://${instance.primaryHostname}/]`
    )
    .replaceAll('{{linkExpiresIn}}', t('admin.instances.invitation.previewExpiry'));

export const AccountInvitationTemplateCard = ({
  instance,
  onSave,
}: {
  readonly instance: IamInstanceDetail;
  readonly onSave: (template: TemplateDraft | null) => Promise<boolean>;
}) => {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<TemplateDraft>(
    instance.accountInvitationTemplate ?? DEFAULT_ACCOUNT_INVITATION_TEMPLATE
  );
  const [message, setMessage] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setDraft(instance.accountInvitationTemplate ?? DEFAULT_ACCOUNT_INVITATION_TEMPLATE);
  }, [instance.accountInvitationTemplate]);

  const save = async (template: TemplateDraft | null) => {
    if (template) {
      try {
        validateAccountInvitationTemplate(template);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : t('admin.instances.invitation.invalid')
        );
        return;
      }
    }
    setSaving(true);
    setMessage(null);
    const success = await onSave(template);
    setSaving(false);
    setMessage(
      success ? t('admin.instances.invitation.saved') : t('admin.instances.invitation.saveFailed')
    );
  };

  const status = instance.accountInvitationProjection?.status ?? 'default';
  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">
            {t('admin.instances.invitation.title')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('admin.instances.invitation.status', {
              status: t(`admin.instances.invitation.projection.${status}`),
            })}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="secondary">
              {t('admin.instances.invitation.open')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('admin.instances.invitation.dialogTitle')}</DialogTitle>
              <DialogDescription>{t('admin.instances.invitation.description')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                {t('admin.instances.invitation.tokens')}
              </p>
              <label className="block space-y-1 text-sm">
                <span>{t('admin.instances.invitation.subject')}</span>
                <Input
                  value={draft.subject}
                  maxLength={200}
                  onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span>{t('admin.instances.invitation.body')}</span>
                <Textarea
                  value={draft.body}
                  maxLength={5_000}
                  rows={12}
                  onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span>{t('admin.instances.invitation.passwordLinkLabel')}</span>
                  <Input
                    value={draft.passwordSetupLinkLabel}
                    maxLength={120}
                    onChange={(event) =>
                      setDraft({ ...draft, passwordSetupLinkLabel: event.target.value })
                    }
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span>{t('admin.instances.invitation.homepageLinkLabel')}</span>
                  <Input
                    value={draft.tenantHomepageLinkLabel}
                    maxLength={120}
                    onChange={(event) =>
                      setDraft({ ...draft, tenantHomepageLinkLabel: event.target.value })
                    }
                  />
                </label>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium">{t('admin.instances.invitation.preview')}</h3>
                <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs">
                  {renderPreview(draft, instance)}
                </pre>
              </div>
              {message ? (
                <p role="status" aria-live="polite" className="text-sm text-foreground">
                  {message}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  if (window.confirm(t('admin.instances.invitation.resetConfirm'))) {
                    void save(null);
                  }
                }}
              >
                {t('admin.instances.invitation.reset')}
              </Button>
              <Button type="button" disabled={saving} onClick={() => void save(draft)}>
                {saving ? t('account.actions.saving') : t('admin.instances.invitation.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
};
