import { Button } from '@sva/studio-ui-react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { t } from '../../../i18n';
import { roleStatusLabel } from './-roles-shared';

import { DetailMetaItem } from './-role-detail-meta-item';
import type { RoleDetailTab } from './-role-detail-page';
import type { RoleDetailState } from './-role-detail-state';

export const RoleSyncPanel = ({
  state,
  role,
  activeTab,
}: Readonly<{
  state: RoleDetailState;
  role: NonNullable<RoleDetailState['role']>;
  activeTab: RoleDetailTab;
}>) => {
  const { rolesApi } = state;
  return (
    <section
      id="role-detail-panel-sync"
      role="tabpanel"
      aria-labelledby="role-detail-tab-sync"
      hidden={activeTab !== 'sync'}
      className="grid gap-4 md:grid-cols-2"
    >
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.roles.detail.sync.title')}</CardTitle>
          <CardDescription>{t('admin.roles.detail.sync.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-secondary/40 bg-secondary/5 text-secondary">
            <AlertDescription>
              {role.managedBy === 'studio'
                ? t('admin.roles.detail.sync.metadataOnlyHint')
                : t('admin.roles.detail.sync.externalHint')}
            </AlertDescription>
          </Alert>
          <dl className="grid gap-4">
            <DetailMetaItem
              label={t('admin.roles.detail.sync.metadataStatus')}
              value={roleStatusLabel(role.syncState)}
            />
            <DetailMetaItem
              label={t('admin.roles.detail.sync.lastSyncedAt')}
              value={role.lastSyncedAt ?? t('admin.roles.detail.sync.notAvailable')}
            />
            <DetailMetaItem label={t('admin.roles.detail.sync.source')} value={role.managedBy} />
            {role.syncError?.code ? (
              <DetailMetaItem
                label={t('admin.roles.detail.sync.errorCode')}
                value={role.syncError.code}
              />
            ) : null}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.roles.detail.sync.localChangesTitle')}</CardTitle>
          <CardDescription>{t('admin.roles.detail.sync.localChangesBody')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t('admin.roles.detail.sync.localChangeItems.permissions')}</li>
            <li>{t('admin.roles.detail.sync.localChangeItems.assignments')}</li>
          </ul>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t('admin.roles.detail.sync.actionsTitle')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('admin.roles.detail.sync.actionsBody')}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={role.managedBy !== 'studio'}
              onClick={() => void rolesApi.retryRoleSync(role.id)}
            >
              {t('admin.roles.actions.retrySync')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void rolesApi.refetch()}>
              {t('admin.roles.actions.retry')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};
