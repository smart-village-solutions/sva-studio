/** Shared editor card for server-wide and instance-specific account invitations. */
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import * as React from 'react';
import {
  validateAccountInvitationTemplate,
  AccountInvitationTemplateValidationError,
  type AccountInvitationTemplate,
  type AccountInvitationTemplateSource,
  type IamInstanceDetail,
} from '@sva/core';
import {
  Button,
  StudioField,
  StudioFormSummaryErrors,
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

export type AccountInvitationTemplateDraft = Omit<AccountInvitationTemplate, 'revision'>;
export type AccountInvitationTemplateSaveResult = boolean | 'conflict';

type PreviewContext = Readonly<{ tenantName: string; tenantHomepageUrl: string }>;

const renderPreview = (template: AccountInvitationTemplateDraft, preview: PreviewContext): string =>
  template.body
    .replaceAll('{{tenantName}}', preview.tenantName)
    .replaceAll('{{passwordSetupLink}}', `[${template.passwordSetupLinkLabel}]`)
    .replaceAll(
      '{{tenantHomepageLink}}',
      `[${template.tenantHomepageLinkLabel}: ${preview.tenantHomepageUrl}]`
    )
    .replaceAll('{{linkExpiresIn}}', t('admin.instances.invitation.previewExpiry'));

const toDraft = (template: AccountInvitationTemplateDraft): AccountInvitationTemplateDraft => ({
  subject: template.subject,
  body: template.body,
  passwordSetupLinkLabel: template.passwordSetupLinkLabel,
  tenantHomepageLinkLabel: template.tenantHomepageLinkLabel,
});
const templateSchema = () =>
  z
    .object({
      subject: z.string(),
      body: z.string(),
      passwordSetupLinkLabel: z.string(),
      tenantHomepageLinkLabel: z.string(),
    })
    .superRefine((value, ctx) => {
      try {
        validateAccountInvitationTemplate(value);
      } catch (error) {
        ctx.addIssue({
          code: 'custom',
          path: [error instanceof AccountInvitationTemplateValidationError ? error.field : 'body'],
          message: t('admin.instances.invitation.invalid'),
        });
      }
    });

export const AccountInvitationTemplateEditorCard = ({
  effectiveTemplate,
  source,
  preview,
  mode,
  disabled = false,
  onSave,
}: {
  readonly effectiveTemplate: AccountInvitationTemplate;
  readonly source: AccountInvitationTemplateSource;
  readonly preview: PreviewContext;
  readonly mode: 'instance' | 'server';
  readonly disabled?: boolean;
  readonly onSave: (
    template: AccountInvitationTemplateDraft | null
  ) => Promise<AccountInvitationTemplateSaveResult>;
}) => {
  const [open, setOpen] = React.useState(false);
  const form = useForm<AccountInvitationTemplateDraft>({
    resolver: zodResolver(templateSchema()),
    defaultValues: toDraft(effectiveTemplate),
  });
  const draft = useWatch({ control: form.control }) as AccountInvitationTemplateDraft;
  const savingRef = React.useRef(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!form.formState.isDirty) form.reset(toDraft(effectiveTemplate));
  }, [effectiveTemplate, form.reset, form.formState.isDirty]);

  const save = async (template: AccountInvitationTemplateDraft | null) => {
    if (disabled || savingRef.current) return;
    savingRef.current = true;
    if (template && !(await form.trigger())) {
      savingRef.current = false;
      globalThis.setTimeout(() => document.getElementById('invitation-errors')?.focus(), 0);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const result = await onSave(template ? toDraft(template) : null);
      if (result === true) form.reset(toDraft(template ?? effectiveTemplate));
      setMessage(
        t(
          result === true
            ? 'admin.instances.invitation.saved'
            : result === 'conflict'
              ? 'admin.instances.invitation.saveConflict'
              : 'admin.instances.invitation.saveFailed'
        )
      );
    } catch {
      setMessage(t('admin.instances.invitation.saveFailed'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const templateFields = [
    ['subject', 'subject', 200],
    ['body', 'body', 5000],
    ['passwordSetupLinkLabel', 'passwordLinkLabel', 120],
    ['tenantHomepageLinkLabel', 'homepageLinkLabel', 120],
  ] as const;

  const descriptionKey =
    mode === 'server'
      ? 'admin.instances.invitation.serverDescription'
      : 'admin.instances.invitation.description';
  const resetKey =
    mode === 'server'
      ? 'admin.instances.invitation.resetServer'
      : 'admin.instances.invitation.resetInstance';
  const resetConfirmKey =
    mode === 'server'
      ? 'admin.instances.invitation.resetServerConfirm'
      : 'admin.instances.invitation.resetInstanceConfirm';

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">
            {t('admin.instances.invitation.title')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('admin.instances.invitation.source', {
              source: t(`admin.instances.invitation.sources.${source}`),
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
              <DialogDescription>{t(descriptionKey)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                {t('admin.instances.invitation.tokens')}
              </p>
              <div id="invitation-errors" tabIndex={-1}>
                <StudioFormSummaryErrors
                  errors={templateFields.flatMap(([name]) => {
                    const message = form.formState.errors[name]?.message;
                    return message ? [{ field: `invitation-${name}`, message }] : [];
                  })}
                />
              </div>
              {templateFields.map(([name, label, maxLength]) => (
                <StudioField
                  key={name}
                  {...getStudioFormFieldProps({
                    id: `invitation-${name}`,
                    error: form.formState.errors[name],
                  })}
                  label={t(`admin.instances.invitation.${label}`)}
                >
                  {name === 'body' ? (
                    <Textarea
                      {...form.register(name)}
                      maxLength={maxLength}
                      rows={12}
                      disabled={saving || disabled}
                    />
                  ) : (
                    <Input
                      {...form.register(name)}
                      maxLength={maxLength}
                      disabled={saving || disabled}
                    />
                  )}
                </StudioField>
              ))}
              <div className="space-y-1">
                <h3 className="text-sm font-medium">{t('admin.instances.invitation.preview')}</h3>
                <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs">
                  {renderPreview(draft, preview)}
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
                disabled={saving || disabled}
                onClick={() => {
                  if (window.confirm(t(resetConfirmKey))) void save(null);
                }}
              >
                {t(resetKey)}
              </Button>
              <Button type="button" disabled={saving || disabled} onClick={() => void save(draft)}>
                {saving ? t('account.actions.saving') : t('admin.instances.invitation.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
};

export const AccountInvitationTemplateCard = ({
  instance,
  onSave,
  disabled,
}: {
  readonly disabled?: boolean;
  readonly instance: IamInstanceDetail;
  readonly onSave: (
    template: AccountInvitationTemplateDraft | null
  ) => Promise<AccountInvitationTemplateSaveResult>;
}) => (
  <AccountInvitationTemplateEditorCard
    effectiveTemplate={instance.effectiveAccountInvitationTemplate}
    source={instance.accountInvitationTemplateSource}
    preview={{
      tenantName: instance.displayName,
      tenantHomepageUrl: `https://${instance.primaryHostname}/`,
    }}
    mode="instance"
    disabled={disabled}
    onSave={onSave}
  />
);
