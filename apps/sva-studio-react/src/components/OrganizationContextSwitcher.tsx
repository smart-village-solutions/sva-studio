import { t } from '../i18n';
import { useOrganizationContext } from '../hooks/use-organization-context';

export const OrganizationContextSwitcher = () => {
  const organizationContext = useOrganizationContext();
  const options = organizationContext.context?.organizations.filter((organization) => organization.isActive) ?? [];

  if (organizationContext.isLoading || options.length <= 1) {
    return null;
  }

  return (
    <label className="flex items-center gap-2 text-xs text-slate-300">
      <span>{t('shell.header.organizationContext')}</span>
      <select
        aria-label={t('shell.header.organizationContext')}
        value={organizationContext.context?.activeOrganizationId ?? ''}
        onChange={(event) => {
          if (!event.target.value) {
            return;
          }
          void organizationContext.switchOrganization(event.target.value);
        }}
        className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
        disabled={organizationContext.isUpdating}
      >
        {options.map((organization) => (
          <option key={organization.organizationId} value={organization.organizationId}>
            {organization.displayName}
          </option>
        ))}
      </select>
    </label>
  );
};
