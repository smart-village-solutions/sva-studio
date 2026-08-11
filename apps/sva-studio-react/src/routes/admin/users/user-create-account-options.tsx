import { Checkbox } from '../../../components/ui/checkbox';
import { t } from '../../../i18n';

export const UserCreateAccountOptions = ({
  sendPasswordSetupEmail,
  isTechnicalAccount,
  onSendPasswordSetupEmailChange,
  onTechnicalAccountChange,
}: {
  readonly sendPasswordSetupEmail: boolean;
  readonly isTechnicalAccount: boolean;
  readonly onSendPasswordSetupEmailChange: (checked: boolean) => void;
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
