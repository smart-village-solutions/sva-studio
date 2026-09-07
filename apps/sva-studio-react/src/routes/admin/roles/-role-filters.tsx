import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { t } from '../../../i18n';

export type RoleTypeFilter = 'studio' | 'external' | 'builtin';

export const matchesRoleTypeFilter = (
  role: { readonly isSystemRole: boolean; readonly managedBy: string },
  filter: RoleTypeFilter
): boolean => {
  if (filter === 'builtin') return role.managedBy === 'keycloak_builtin';
  if (filter === 'external') return role.managedBy === 'external';
  return role.managedBy === 'studio';
};

export const RoleFilters = ({
  search,
  roleType,
  showRoleType = true,
  onSearchChange,
  onRoleTypeChange,
}: {
  search: string;
  roleType: RoleTypeFilter;
  showRoleType?: boolean;
  onSearchChange: (value: string) => void;
  onRoleTypeChange: (value: RoleTypeFilter) => void;
}) => (
  <div className="flex flex-wrap items-end gap-3">
    <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
      <Label htmlFor="roles-search">{t('admin.roles.filters.searchLabel')}</Label>
      <Input
        id="roles-search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={t('admin.roles.filters.searchPlaceholder')}
      />
    </div>
    {showRoleType ? (
      <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <Label htmlFor="roles-type-filter">{t('admin.roles.filters.typeLabel')}</Label>
        <select
          id="roles-type-filter"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm normal-case tracking-normal text-foreground"
          value={roleType}
          onChange={(event) => onRoleTypeChange(event.target.value as RoleTypeFilter)}
        >
          <option value="studio">{t('admin.roles.filters.typeStudio')}</option>
          <option value="external">{t('admin.roles.filters.typeExternal')}</option>
          <option value="builtin">{t('admin.roles.filters.typeBuiltin')}</option>
        </select>
      </div>
    ) : null}
  </div>
);
