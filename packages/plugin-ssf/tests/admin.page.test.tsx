// @vitest-environment jsdom
/** Route wrappers preserve tenant read-only authority and bind the intended page owner. */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  SsfTenantAppearancePage,
  SsfTenantConfigurationPage,
  SsfSystemConfigurationPage,
} from '../src/admin.page.js';
const state = vi.hoisted(() => ({ permissionActions: ['ssf.configuration.tenant.read'] }));
vi.mock('@sva/plugin-sdk', () => ({
  readSessionAccessSnapshot: () => state,
  subscribeSessionAccessSnapshot: () => () => undefined,
}));
vi.mock('../src/admin.content-v2-tenant-page.js', () => ({
  SsfTenantContentV2Page: ({ page, canManage }: { page: string; canManage: boolean }) => (
    <div>{`${page}:${canManage}`}</div>
  ),
}));
vi.mock('../src/admin.content-v2-page.js', () => ({
  SsfSystemContentV2Page: ({ page }: { page: string }) => <div>{page}</div>,
}));
afterEach(cleanup);
it('keeps readers read-only without granting manage permission', () => {
  render(<SsfTenantAppearancePage />);
  expect(screen.getByText('appearance:false')).toBeTruthy();
});
it('offers the tenant overview without a legacy editor', () => {
  render(<SsfTenantConfigurationPage />);
  expect(screen.getByText('overview:false')).toBeTruthy();
});
it('offers the root installation overview', () => {
  render(<SsfSystemConfigurationPage />);
  expect(screen.getByText('installation-overview')).toBeTruthy();
});
