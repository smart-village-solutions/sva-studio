import { Button, StudioSaveButton } from '@sva/studio-ui-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { t } from '../../../i18n';
import { roleStatusLabel } from './-roles-shared';

import { DetailMetaItem } from './-role-detail-meta-item';
import type { RoleDetailTab } from './-role-detail-page';
import type { RoleDetailState } from './-role-detail-state';

export const RoleGeneralPanel = ({
  state,
  role,
  activeTab,
  isGeneralDirty,
}: Readonly<{
  state: RoleDetailState;
  role: NonNullable<RoleDetailState['role']>;
  activeTab: RoleDetailTab;
  isGeneralDirty: boolean;
}>) => {
  const {
    isReadOnly,
    onSaveGeneral,
    editForm,
    updateEditForm,
    metaSaveFeedback,
    setEditForm,
    showTechnicalDetails,
    setShowTechnicalDetails,
  } = state;
  return (
    <section
      id="role-detail-panel-general"
      role="tabpanel"
      aria-labelledby="role-detail-tab-general"
      hidden={activeTab !== 'general'}
      className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"
    >
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.roles.detail.tabs.general')}</CardTitle>
          <CardDescription>{t('admin.roles.detail.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2"
            aria-readonly={isReadOnly}
            onSubmit={onSaveGeneral}
          >
            <div className="grid gap-2 text-sm text-foreground">
              <Label htmlFor="role-detail-name">{t('admin.roles.editDialog.nameLabel')}</Label>
              <Input
                id="role-detail-name"
                value={editForm.displayName}
                disabled={isReadOnly}
                onChange={(event) =>
                  updateEditForm((current) => ({ ...current, displayName: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2 text-sm text-foreground md:col-span-2">
              <Label htmlFor="role-detail-description">
                {t('admin.roles.editDialog.descriptionLabel')}
              </Label>
              <Textarea
                id="role-detail-description"
                value={editForm.description}
                disabled={isReadOnly}
                onChange={(event) =>
                  updateEditForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-3 md:col-span-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isReadOnly}
                onClick={() => {
                  metaSaveFeedback.markDirty();
                  setEditForm({
                    displayName: role.roleName,
                    description: role.description ?? '',
                  });
                }}
              >
                {t('admin.roles.detail.general.reset')}
              </Button>
              <StudioSaveButton
                type="submit"
                status={metaSaveFeedback.status}
                disabled={isReadOnly || !isGeneralDirty}
                labels={{
                  idle: t('admin.roles.detail.general.save'),
                  saving: t('admin.roles.detail.general.saving'),
                  saved: t('account.actions.saved'),
                }}
              />
            </div>
            <div className="md:col-span-2">
              <Button
                type="button"
                variant="tertiary"
                aria-expanded={showTechnicalDetails}
                onClick={() => setShowTechnicalDetails((current) => !current)}
              >
                {showTechnicalDetails
                  ? t('admin.roles.detail.permissions.hideTechnicalDetails')
                  : t('admin.roles.detail.permissions.showTechnicalDetails')}
              </Button>
              {showTechnicalDetails ? (
                <dl className="mt-3 grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2">
                  <DetailMetaItem
                    label={t('admin.roles.editDialog.keyLabel')}
                    value={<code>{role.roleKey}</code>}
                  />
                  <DetailMetaItem
                    label={t('admin.roles.detail.general.externalRoleName')}
                    value={<code>{role.externalRoleName}</code>}
                  />
                </dl>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.roles.detail.tabs.sync')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4">
            <DetailMetaItem
              label={t('admin.roles.detail.tabs.sync')}
              value={roleStatusLabel(role.syncState)}
            />
            <DetailMetaItem
              label={t('admin.roles.detail.assignments.managedBy')}
              value={role.managedBy}
            />
            <DetailMetaItem
              label={t('admin.roles.detail.sync.lastSyncedAt')}
              value={role.lastSyncedAt ?? t('admin.roles.detail.sync.notAvailable')}
            />
          </dl>
        </CardContent>
      </Card>
    </section>
  );
};
