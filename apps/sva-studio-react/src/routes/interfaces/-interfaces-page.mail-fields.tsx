import { t } from '../../i18n';
import type { InstanceInterfaceDraft } from '../../lib/instance-interfaces';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export const MailTransportFields = ({
  draft,
  onChange,
}: {
  draft: Extract<InstanceInterfaceDraft, { type: 'mailTransport' }>;
  onChange: (next: InstanceInterfaceDraft) => void;
}) => {
  const updateConfig = (
    patch: Partial<Extract<InstanceInterfaceDraft, { type: 'mailTransport' }>['config']>
  ) => {
    onChange({
      ...draft,
      config: {
        ...draft.config,
        ...patch,
      },
    });
  };

  return (
    <>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="mail-transport-id">
            {t('interfaces.forms.mailTransport.transportId')}
          </Label>
          <Input
            id="mail-transport-id"
            value={draft.config.transportId}
            onChange={(event) => updateConfig({ transportId: event.currentTarget.value })}
          />
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="mail-host">{t('interfaces.forms.mailTransport.host')}</Label>
          <Input
            id="mail-host"
            value={draft.config.host}
            onChange={(event) => updateConfig({ host: event.currentTarget.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mail-port">{t('interfaces.forms.mailTransport.port')}</Label>
          <Input
            id="mail-port"
            inputMode="numeric"
            value={draft.config.port}
            onChange={(event) => updateConfig({ port: event.currentTarget.value })}
          />
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="mail-security-mode">
            {t('interfaces.forms.mailTransport.securityMode')}
          </Label>
          <select
            id="mail-security-mode"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={draft.config.securityMode}
            onChange={(event) =>
              updateConfig({
                securityMode: event.currentTarget.value as typeof draft.config.securityMode,
              })
            }
          >
            <option value="none">
              {t('interfaces.forms.mailTransport.securityModeOptions.none')}
            </option>
            <option value="starttls">
              {t('interfaces.forms.mailTransport.securityModeOptions.starttls')}
            </option>
            <option value="tls">
              {t('interfaces.forms.mailTransport.securityModeOptions.tls')}
            </option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mail-auth-mode">{t('interfaces.forms.mailTransport.authMode')}</Label>
          <select
            id="mail-auth-mode"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={draft.config.authMode}
            onChange={(event) =>
              updateConfig({
                authMode: event.currentTarget.value as typeof draft.config.authMode,
              })
            }
          >
            <option value="none">{t('interfaces.forms.mailTransport.authModeOptions.none')}</option>
            <option value="basic">
              {t('interfaces.forms.mailTransport.authModeOptions.basic')}
            </option>
          </select>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="mail-username">{t('interfaces.forms.mailTransport.username')}</Label>
          <Input
            id="mail-username"
            value={draft.config.username}
            onChange={(event) => updateConfig({ username: event.currentTarget.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mail-password">{t('interfaces.forms.mailTransport.password')}</Label>
          <Input
            id="mail-password"
            type="password"
            value={draft.config.password}
            onChange={(event) => updateConfig({ password: event.currentTarget.value })}
          />
        </div>
      </div>

      <MailDeliveryFields draft={draft} updateConfig={updateConfig} />
    </>
  );
};

type MailDraft = Extract<InstanceInterfaceDraft, { type: 'mailTransport' }>;
type UpdateMailConfig = (patch: Partial<MailDraft['config']>) => void;

const MailDeliveryFields = ({
  draft,
  updateConfig,
}: {
  draft: MailDraft;
  updateConfig: UpdateMailConfig;
}) => (
  <>
    <div className="grid gap-2 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="mail-default-from-email">
          {t('interfaces.forms.mailTransport.defaultFromEmail')}
        </Label>
        <Input
          id="mail-default-from-email"
          type="email"
          value={draft.config.defaultFromEmail}
          onChange={(event) => updateConfig({ defaultFromEmail: event.currentTarget.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="mail-default-from-name">
          {t('interfaces.forms.mailTransport.defaultFromName')}
        </Label>
        <Input
          id="mail-default-from-name"
          value={draft.config.defaultFromName}
          onChange={(event) => updateConfig({ defaultFromName: event.currentTarget.value })}
        />
      </div>
    </div>

    <div className="grid gap-2 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="mail-default-reply-to">
          {t('interfaces.forms.mailTransport.defaultReplyToEmail')}
        </Label>
        <Input
          id="mail-default-reply-to"
          type="email"
          value={draft.config.defaultReplyToEmail}
          onChange={(event) => updateConfig({ defaultReplyToEmail: event.currentTarget.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="mail-rate-limit">
          {t('interfaces.forms.mailTransport.rateLimitPerMinute')}
        </Label>
        <Input
          id="mail-rate-limit"
          inputMode="numeric"
          value={draft.config.rateLimitPerMinute}
          onChange={(event) => updateConfig({ rateLimitPerMinute: event.currentTarget.value })}
        />
      </div>
    </div>

    <div className="grid gap-2">
      <Label htmlFor="mail-max-batch-size">
        {t('interfaces.forms.mailTransport.maxBatchSize')}
      </Label>
      <Input
        id="mail-max-batch-size"
        inputMode="numeric"
        value={draft.config.maxBatchSize}
        onChange={(event) => updateConfig({ maxBatchSize: event.currentTarget.value })}
      />
    </div>
  </>
);
