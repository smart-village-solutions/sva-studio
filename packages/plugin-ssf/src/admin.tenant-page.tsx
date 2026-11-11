/** Tenant pages share the existing aggregate editor and existing configuration authority. */
import { readSessionAccessSnapshot, subscribeSessionAccessSnapshot } from '@sva/plugin-sdk';
import { useSyncExternalStore } from 'react';
import { SsfTenantContentV2Page } from './admin.content-v2-tenant-page.js';
import type { SsfTenantEditorPage } from './content-v2-admin-contracts.js';

const TenantPage = ({ page }: { page: SsfTenantEditorPage | 'overview' }) => {
  const access = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  return (
    <SsfTenantContentV2Page
      page={page}
      canManage={access.permissionActions.includes('ssf.configuration.tenant.manage')}
    />
  );
};
export const SsfTenantConfigurationPage = () => <TenantPage page="overview" />;
export const SsfTenantAppearancePage = () => <TenantPage page="appearance" />;
export const SsfTenantLanguagesPage = () => <TenantPage page="languages" />;
export const SsfTenantRecordingsPage = () => <TenantPage page="recordings" />;
export const SsfTenantFeedbackPage = () => <TenantPage page="feedback" />;
