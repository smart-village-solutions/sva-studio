import { defineRouteDocumentation } from '@sva/plugin-sdk/route-documentation';
import type { RouteDocumentation } from '@sva/plugin-sdk/route-documentation';

import type { AppRouteBindings } from './app-route-bindings.js';
import type { AccountUiRouteGuardKey } from './account-ui.routes.js';
import { uiRoutePaths } from './route-paths.js';

export type AppRouteBindingKey = keyof AppRouteBindings;
export type UiRouteDefinition = {
  readonly binding: AppRouteBindingKey;
  readonly documentation: RouteDocumentation;
  readonly guard?: AccountUiRouteGuardKey;
  readonly path: string;
  readonly validateSearch?: (search: Record<string, unknown>) => unknown;
  readonly requiredModuleId?: string;
  readonly requiredPermissions?: readonly string[];
};

export const page = (
  id: string,
  pageType: Extract<RouteDocumentation, { kind: 'page' }>['pageType']
): RouteDocumentation => defineRouteDocumentation({ kind: 'page', id, pageType });

export const excluded = (
  reason: Extract<RouteDocumentation, { kind: 'excluded' }>['reason']
): RouteDocumentation => defineRouteDocumentation({ kind: 'excluded', reason });

export const standardUiRouteDefinitions: readonly UiRouteDefinition[] = [
  { binding: 'home', path: uiRoutePaths.home, documentation: page('home.overview', 'overview') },
  {
    binding: 'account',
    path: uiRoutePaths.account,
    guard: 'account',
    documentation: page('account.profile', 'overview'),
  },
  {
    binding: 'accountPrivacy',
    path: uiRoutePaths.accountPrivacy,
    guard: 'accountPrivacy',
    documentation: page('account.privacy', 'overview'),
  },
  {
    binding: 'accountPrivacyDetail',
    path: uiRoutePaths.accountPrivacyDetail,
    guard: 'accountPrivacyDetail',
    documentation: page('account.privacy-detail', 'detail'),
  },
  {
    binding: 'accountRules',
    path: uiRoutePaths.accountRules,
    guard: 'accountRules',
    documentation: page('account.rules', 'overview'),
  },
  {
    binding: 'mediaUsage',
    path: uiRoutePaths.mediaUsage,
    guard: 'media',
    requiredModuleId: 'media',
    requiredPermissions: ['media.read'],
    documentation: page('media.usage', 'usage'),
  },
  {
    binding: 'media',
    path: uiRoutePaths.media,
    guard: 'media',
    requiredModuleId: 'media',
    requiredPermissions: ['media.read'],
    documentation: page('media.overview', 'overview'),
  },
  {
    binding: 'categories',
    path: uiRoutePaths.categories,
    guard: 'content',
    requiredModuleId: 'categories',
    requiredPermissions: ['categories.read'],
    documentation: page('categories.overview', 'overview'),
  },
  {
    binding: 'app',
    path: uiRoutePaths.app,
    guard: 'account',
    documentation: page('app.overview', 'overview'),
  },
  {
    binding: 'interfaces',
    path: uiRoutePaths.interfaces,
    guard: 'interfaces',
    requiredPermissions: ['integration.manage'],
    documentation: page('interfaces.overview', 'overview'),
  },
  { binding: 'help', path: uiRoutePaths.help, documentation: excluded('help-page') },
  { binding: 'support', path: uiRoutePaths.support, documentation: excluded('help-page') },
  { binding: 'license', path: uiRoutePaths.license, documentation: excluded('help-page') },
] as const;

export const additionalUiRouteDefinitions: readonly UiRouteDefinition[] = [
  {
    binding: 'modules',
    path: uiRoutePaths.modules,
    guard: 'modules',
    documentation: page('modules.overview', 'overview'),
  },
  {
    binding: 'monitoring',
    path: uiRoutePaths.monitoring,
    guard: 'monitoring',
    documentation: page('monitoring.overview', 'overview'),
  },
  {
    binding: 'monitoringJobs',
    path: uiRoutePaths.monitoringJobs,
    guard: 'monitoringJobs',
    documentation: page('monitoring.jobs-list', 'list'),
  },
  {
    binding: 'monitoringJobDetail',
    path: uiRoutePaths.monitoringJobDetail,
    guard: 'monitoringJobDetail',
    documentation: page('monitoring.job-detail', 'detail'),
  },
  {
    binding: 'adminApiPhase1Test',
    path: uiRoutePaths.adminApiPhase1Test,
    documentation: excluded('technical'),
  },
] as const;
