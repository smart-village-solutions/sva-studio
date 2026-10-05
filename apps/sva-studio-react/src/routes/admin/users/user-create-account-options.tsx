import { Checkbox } from '../../../components/ui/checkbox';
import { t } from '../../../i18n';

export const UserCreateAccountOptions = ({
  sendPasswordSetupEmail,
  invitationPurpose,
  isTechnicalAccount,
  onSendPasswordSetupEmailChange,
  onInvitationPurposeChange,
  onTechnicalAccountChange,
}: {
  readonly sendPasswordSetupEmail: boolean;
  readonly invitationPurpose: 'default' | 'studio' | 'ssf';
  readonly isTechnicalAccount: boolean;
  readonly onSendPasswordSetupEmailChange: (checked: boolean) => void;
  readonly onInvitationPurposeChange: (purpose: 'default' | 'studio' | 'ssf') => void;
  readonly onTechnicalAccountChange: (checked: boolean) => void;
}) => (
  <>
    <div className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-3 text-sm text-foreground">
      <Checkbox
        id="create-user-send-password-setup-email"
        checked={sendPasswordSetupEmail}
        onChange={(event) => onSendPasswordSetupEmailChange(event.target.checked)}
      />
      <label
        htmlFor="create-user-send-password-setup-email"
        className="cursor-pointer text-sm font-medium"
      >
        {t('admin.users.createDialog.sendPasswordSetupEmail')}
      </label>
    </div>
    <div className="space-y-2 rounded-md border border-border/60 px-3 py-3">
      <label htmlFor="create-user-invitation-purpose" className="block text-sm font-medium">
        {t('admin.users.createDialog.invitationPurpose')}
      </label>
      <select
        id="create-user-invitation-purpose"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={invitationPurpose}
        onChange={(event) =>
          onInvitationPurposeChange(event.target.value as 'default' | 'studio' | 'ssf')
        }
      >
        <option value="default">{t('admin.users.createDialog.invitationPurposeDefault')}</option>
        <option value="studio">{t('admin.users.createDialog.invitationPurposeStudio')}</option>
        <option value="ssf">{t('admin.users.createDialog.invitationPurposeSsf')}</option>
      </select>
      <p className="text-xs text-muted-foreground">
        {t('admin.users.createDialog.invitationPurposeHint')}
      </p>
    </div>
    <div className="flex items-start gap-3 rounded-md border border-border/60 px-3 py-3 text-sm text-foreground">
      <Checkbox
        id="create-user-is-technical-account"
        checked={isTechnicalAccount}
        onChange={(event) => onTechnicalAccountChange(event.target.checked)}
      />
      <label htmlFor="create-user-is-technical-account" className="cursor-pointer">
        <span className="block font-medium">
          {t('admin.users.createDialog.isTechnicalAccount')}
        </span>
        <span className="block text-xs text-muted-foreground">
          {t('admin.users.createDialog.isTechnicalAccountHint')}
        </span>
      </label>
    </div>
  </>
);
