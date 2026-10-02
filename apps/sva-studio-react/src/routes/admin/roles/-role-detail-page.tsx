import {
  Button,
  StudioDetailPageTemplate,
  StudioPersistentFormError,
  StudioSaveButton,
} from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';

import { IamRuntimeDiagnosticDetails } from '../-iam-runtime-diagnostic-details';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader } from '../../../components/ui/card';
import { t } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/translate';
import {
  areRoleGeneralDraftsEqual,
  areRolePermissionDraftsEqual,
  normalizeRoleGeneralDraft,
} from './-role-dirty-state';
import { roleErrorMessage, roleStatusLabel, roleTypeLabel } from './-roles-shared';

import { RoleAssignmentsPanel } from './-role-detail-assignments-panel';
import { RoleGeneralPanel } from './-role-detail-general-panel';
import { DetailMetaItem } from './-role-detail-meta-item';
import {
  buildPermissionScopeDraft,
  sortPermissionAssignmentsByCatalog,
} from './-role-detail-permission-model';
import { RolePermissionsPanel } from './-role-detail-permissions-panel';
import { useRoleDetailState } from './-role-detail-state';
import { RoleSyncPanel } from './-role-detail-sync-panel';
export { sortPermissionIdsByCatalog } from './-role-detail-permission-model';
export type RoleDetailTab = 'general' | 'permissions' | 'assignments' | 'sync';
export type RoleDetailPageProps = Readonly<{
  roleId: string;
  activeTab: RoleDetailTab;
}>;

const TABS: readonly RoleDetailTab[] = ['general', 'permissions', 'assignments', 'sync'];
const ROLE_TAB_LABELS: Record<RoleDetailTab, TranslationKey> = {
  general: 'admin.roles.detail.tabs.general',
  permissions: 'admin.roles.detail.tabs.permissions',
  assignments: 'admin.roles.detail.tabs.assignments',
  sync: 'admin.roles.detail.tabs.sync',
};

export const RoleDetailPage = ({ roleId, activeTab }: RoleDetailPageProps) => {
  const state = useRoleDetailState({ roleId, activeTab });
  const {
    rolesApi,
    permissionsApi,
    role,
    isReadOnly,
    editForm,
    permissionDraft,
    permissionScopeDraft,
    metaSaveFeedback,
    permissionsSaveFeedback,
    onTabIntent,
    onSavePermissions,
  } = state;
  if (rolesApi.error) {
    return (
      <section className="space-y-4">
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>
              {roleErrorMessage(rolesApi.error, 'admin.roles.messages.error', {
                includeKeycloakReconcileError: true,
                includeRecoveryRunningError: true,
              })}
            </span>
            <IamRuntimeDiagnosticDetails error={rolesApi.error} />
          </AlertDescription>
        </Alert>
        <Button type="button" variant="secondary" onClick={() => void rolesApi.refetch()}>
          {t('admin.roles.actions.retry')}
        </Button>
      </section>
    );
  }

  if (!role && rolesApi.isLoading) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('admin.roles.messages.loading')}</p>
      </section>
    );
  }

  if (!role) {
    return (
      <section className="space-y-4">
        <Button asChild type="button" variant="secondary">
          <Link to="/admin/roles">{t('admin.roles.detail.backToList')}</Link>
        </Button>
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{t('admin.roles.detail.notFound')}</AlertDescription>
        </Alert>
      </section>
    );
  }

  const generalDraft = normalizeRoleGeneralDraft(editForm);
  const storedGeneralDraft = normalizeRoleGeneralDraft({
    displayName: role.roleName,
    description: role.description,
  });
  const isGeneralDirty = !areRoleGeneralDraftsEqual(generalDraft, storedGeneralDraft);
  const currentPermissionAssignments = sortPermissionAssignmentsByCatalog(
    permissionDraft,
    permissionScopeDraft,
    permissionsApi.permissions
  );
  const storedPermissionAssignments = sortPermissionAssignmentsByCatalog(
    role.permissions.map((permission) => permission.id),
    buildPermissionScopeDraft(role, permissionsApi.permissions),
    permissionsApi.permissions
  );
  const arePermissionsDirty = !areRolePermissionDraftsEqual(
    currentPermissionAssignments,
    storedPermissionAssignments
  );

  const savePermissionsAction = (
    <StudioSaveButton
      type="button"
      status={permissionsSaveFeedback.status}
      disabled={
        isReadOnly ||
        !arePermissionsDirty ||
        permissionsApi.isLoading ||
        Boolean(permissionsApi.error) ||
        permissionsSaveFeedback.status === 'saving'
      }
      onClick={() => void onSavePermissions()}
      labels={{
        idle: t('admin.roles.workspace.savePermissions'),
        saving: t('admin.roles.workspace.savingPermissions'),
        saved: t('account.actions.saved'),
      }}
    />
  );

  return (
    <StudioDetailPageTemplate
      title={role.roleName}
      description={t('admin.roles.detail.subtitle')}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild type="button" variant="secondary" size="sm">
            <Link to="/admin/roles">{t('admin.roles.detail.backToList')}</Link>
          </Button>
          <Button asChild type="button" variant="secondary">
            <Link to="/admin/iam" search={{ tab: 'rights' }}>
              {t('admin.roles.workspace.openIamCta')}
            </Link>
          </Button>
        </div>
      }
      className="aria-busy:opacity-100"
    >
      <section
        className="space-y-5"
        aria-busy={
          rolesApi.isLoading ||
          metaSaveFeedback.status === 'saving' ||
          permissionsSaveFeedback.status === 'saving'
        }
      >
        {rolesApi.mutationError ? (
          <StudioPersistentFormError
            message={roleErrorMessage(rolesApi.mutationError, 'admin.roles.messages.error', {
              includeKeycloakReconcileError: true,
              includeRecoveryRunningError: true,
            })}
            details={<IamRuntimeDiagnosticDetails error={rolesApi.mutationError} />}
          />
        ) : null}

        {isReadOnly ? (
          <Alert className="border-secondary/40 bg-secondary/10 text-secondary">
            <AlertDescription>
              {role.isSystemRole
                ? t('admin.roles.workspace.readOnlySystemHint')
                : t('admin.roles.workspace.readOnlyExternalHint')}
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-lg font-semibold leading-none tracking-tight text-foreground">
                  {role.roleName}
                </p>
                <CardDescription>
                  {role.description?.trim() || t('admin.roles.detail.subtitle')}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{roleTypeLabel(role)}</Badge>
                <Badge variant="outline">{roleStatusLabel(role.syncState)}</Badge>
                <Badge variant="outline">
                  {t('admin.roles.detail.badges.permissionCount', {
                    count: String(role.permissions.length),
                  })}
                </Badge>
                <Badge variant="outline">
                  {t('admin.roles.detail.badges.assignmentCount', {
                    count: String(role.memberCount),
                  })}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 md:grid-cols-2">
              <DetailMetaItem label={t('admin.roles.detail.sync.source')} value={role.managedBy} />
              <DetailMetaItem
                label={t('admin.roles.detail.tabs.sync')}
                value={roleStatusLabel(role.syncState)}
              />
            </dl>
          </CardContent>
        </Card>

        <Card
          role="tablist"
          aria-label={t('admin.roles.detail.tabsAriaLabel')}
          className="flex overflow-x-auto p-1"
        >
          {TABS.map((tab, index) => {
            const selected = tab === activeTab;
            return (
              <Button
                key={tab}
                id={`role-detail-tab-${tab}`}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls={`role-detail-panel-${tab}`}
                className={`text-sm transition ${
                  selected
                    ? 'bg-primary font-semibold text-primary-foreground hover:bg-primary/90'
                    : 'text-muted-foreground'
                }`}
                onClick={() => onTabIntent(tab)}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
                    return;
                  }

                  event.preventDefault();
                  const direction = event.key === 'ArrowRight' ? 1 : -1;
                  const nextIndex = (index + direction + TABS.length) % TABS.length;
                  const nextTab = TABS[nextIndex] ?? 'general';
                  onTabIntent(nextTab);
                }}
                variant={selected ? 'primary' : 'tertiary'}
              >
                {t(ROLE_TAB_LABELS[tab])}
              </Button>
            );
          })}
        </Card>

        <RoleGeneralPanel
          state={state}
          role={role}
          activeTab={activeTab}
          isGeneralDirty={isGeneralDirty}
        />

        <RolePermissionsPanel
          state={state}
          role={role}
          activeTab={activeTab}
          arePermissionsDirty={arePermissionsDirty}
          savePermissionsAction={savePermissionsAction}
        />

        <RoleAssignmentsPanel state={state} role={role} activeTab={activeTab} />

        <RoleSyncPanel state={state} role={role} activeTab={activeTab} />
      </section>
    </StudioDetailPageTemplate>
  );
};
