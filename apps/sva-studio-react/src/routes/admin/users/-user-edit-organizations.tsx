import { Button } from '@sva/studio-ui-react';
import * as React from 'react';

import { Checkbox } from '../../../components/ui/checkbox';
import { Label } from '../../../components/ui/label';
import { SearchableSelect } from '../../../components/ui/searchable-select';
import { t } from '../../../i18n';
import type { useUserEditController } from './use-user-edit-controller';
import { formatDateTime } from './user-edit-model';

type UserEditController = ReturnType<typeof useUserEditController>;
type UserEditUser = NonNullable<UserEditController['userApi']['user']>;

const OrganizationMembershipList = ({
  controller,
  user,
}: {
  controller: UserEditController;
  user: UserEditUser;
}) => {
  const {
    organizationMembershipDrafts,
    removeOrganizationMembership,
    saveOrganizationMembership,
    updateOrganizationMembershipDraft,
  } = controller;
  return (
    <>
      {user.organizationMemberships?.length ? (
        <ul className="grid gap-3">
          {user.organizationMemberships.map((membership) => {
            const draft = organizationMembershipDrafts[membership.organizationId] ?? {
              isDefaultContext: membership.isDefaultContext,
            };

            return (
              <li
                key={membership.organizationId}
                className="grid gap-3 rounded-lg border border-border bg-background p-3"
              >
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{membership.displayName}</p>
                  <p className="text-xs text-muted-foreground">{membership.organizationKey}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.users.edit.organizations.createdAt', {
                      value: formatDateTime(membership.createdAt),
                    })}
                  </p>
                </div>
                <Label
                  htmlFor={`organization-default-${membership.organizationId}`}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <Checkbox
                    id={`organization-default-${membership.organizationId}`}
                    checked={draft.isDefaultContext}
                    onChange={(event) =>
                      updateOrganizationMembershipDraft(membership.organizationId, {
                        isDefaultContext: event.target.checked,
                      })
                    }
                  />
                  <span>{t('admin.users.edit.organizations.defaultContextLabel')}</span>
                </Label>
                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void saveOrganizationMembership(membership.organizationId)}
                  >
                    {t('admin.users.edit.organizations.updateAction', {
                      name: membership.displayName,
                    })}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void removeOrganizationMembership(membership.organizationId)}
                  >
                    {t('admin.users.edit.organizations.removeAction', {
                      name: membership.displayName,
                    })}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t('admin.users.edit.organizations.empty')}</p>
      )}
    </>
  );
};

export const UserOrganizationsPanel = ({
  controller,
  user,
}: {
  controller: UserEditController;
  user: UserEditUser;
}) => {
  const {
    activeTab,
    organizationAssignment,
    organizationSearchValue,
    availableOrganizations,
    assignOrganizationMembership,
    selectOrganizationAssignment,
    setOrganizationAssignment,
    setOrganizationSearchValue,
    selectedAssignableOrganization,
  } = controller;
  const organizationOptions = React.useMemo(
    () =>
      availableOrganizations.map((organization) => ({
        value: organization.id,
        label: `${organization.displayName} (${organization.organizationKey})`,
        keywords: [organization.displayName, organization.organizationKey],
      })),
    [availableOrganizations]
  );
  const selectedOrganizationOption = React.useMemo(() => {
    if (selectedAssignableOrganization) {
      return {
        value: selectedAssignableOrganization.id,
        label: `${selectedAssignableOrganization.displayName} (${selectedAssignableOrganization.organizationKey})`,
        keywords: [
          selectedAssignableOrganization.displayName,
          selectedAssignableOrganization.organizationKey,
        ],
      };
    }

    if (!organizationAssignment.organizationId || !organizationAssignment.organizationLabel) {
      return null;
    }

    return {
      value: organizationAssignment.organizationId,
      label: organizationAssignment.organizationLabel,
      keywords: [organizationAssignment.organizationLabel],
    };
  }, [
    organizationAssignment.organizationId,
    organizationAssignment.organizationLabel,
    selectedAssignableOrganization,
  ]);
  return (
    <section
      id="user-edit-panel-organizations"
      role="tabpanel"
      aria-labelledby="user-edit-tab-organizations"
      hidden={activeTab !== 'organizations'}
      className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-shell"
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">
          {t('admin.users.edit.organizations.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('admin.users.edit.organizations.description')}
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-background p-3">
        <div>
          <SearchableSelect
            id="user-organization-select"
            label={t('admin.users.edit.organizations.selectLabel')}
            value={organizationAssignment.organizationId}
            placeholder={t('admin.users.edit.organizations.selectPlaceholder')}
            searchPlaceholder={t('admin.users.edit.organizations.searchPlaceholder')}
            emptyText={t('admin.users.edit.organizations.empty')}
            options={organizationOptions}
            selectedOption={selectedOrganizationOption}
            searchValue={organizationSearchValue}
            onSearchValueChange={setOrganizationSearchValue}
            onValueChange={selectOrganizationAssignment}
          />
        </div>
        <Label
          htmlFor="user-organization-default"
          className="flex items-center gap-2 text-sm text-foreground"
        >
          <Checkbox
            id="user-organization-default"
            checked={organizationAssignment.isDefaultContext}
            onChange={(event) =>
              setOrganizationAssignment((current) => ({
                ...current,
                isDefaultContext: event.target.checked,
              }))
            }
          />
          <span>{t('admin.users.edit.organizations.assignDefaultLabel')}</span>
        </Label>
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => void assignOrganizationMembership()}
            disabled={!organizationAssignment.organizationId}
          >
            {t('admin.users.edit.organizations.assignAction')}
          </Button>
        </div>
      </div>

      <OrganizationMembershipList controller={controller} user={user} />
    </section>
  );
};
