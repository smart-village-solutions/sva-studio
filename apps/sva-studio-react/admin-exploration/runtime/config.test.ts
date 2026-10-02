import { describe, expect, it } from 'vitest';

import { parseAdminExplorationConfig } from './config.ts';

describe('parseAdminExplorationConfig', () => {
  it('parses explicit adminExploration env values and normalizes the base URL', () => {
    const config = parseAdminExplorationConfig({
      IAM_EXPLORE_ADMIN_BASE_URL: 'https://studio.example.test/admin/',
      IAM_EXPLORE_ADMIN_USERNAME: 'admin-user',
      IAM_EXPLORE_ADMIN_PASSWORD: 'super-secret',
      IAM_EXPLORE_ADMIN_MISSION: 'admin-users-overview',
    });

    expect(config).toEqual({
      admin: {
        username: 'admin-user',
        password: 'super-secret',
      },
      baseUrl: 'https://studio.example.test/admin',
      localBrowser: {
        headless: true,
      },
      mission: 'admin-users-overview',
      runMode: 'mission',
      storyFilters: {
        clusters: [],
        packageIds: [],
        resume: false,
        storyIds: [],
      },
      tenant: null,
    });
  });

  it('falls back to IAM acceptance env values and defaults the mission', () => {
    const config = parseAdminExplorationConfig({
      IAM_ACCEPTANCE_BASE_URL: 'https://iam.example.test/',
      IAM_ACCEPTANCE_ADMIN_USERNAME: 'fallback-admin',
      IAM_ACCEPTANCE_ADMIN_PASSWORD: 'fallback-password',
    });

    expect(config).toEqual({
      admin: {
        username: 'fallback-admin',
        password: 'fallback-password',
      },
      baseUrl: 'https://iam.example.test',
      localBrowser: {
        headless: true,
      },
      mission: 'admin-users-overview',
      runMode: 'mission',
      storyFilters: {
        clusters: [],
        packageIds: [],
        resume: false,
        storyIds: [],
      },
      tenant: null,
    });
  });

  it('parses story-loop mode, tenant credentials and filter env values', () => {
    const config = parseAdminExplorationConfig({
      IAM_EXPLORE_ADMIN_BASE_URL: 'https://studio.example.test',
      IAM_EXPLORE_ADMIN_USERNAME: 'admin-user',
      IAM_EXPLORE_ADMIN_PASSWORD: 'super-secret',
      IAM_EXPLORE_HEADLESS: 'false',
      IAM_EXPLORE_RUN_MODE: 'story-loop',
      IAM_EXPLORE_STORY_IDS: '18, 19, 37',
      IAM_EXPLORE_STORY_PACKAGE_IDS: 'IAM-P2, IAM-P5',
      IAM_EXPLORE_STORY_CLUSTERS: 'tenant-user-create, tenant-isolation',
      IAM_EXPLORE_STORY_RESUME: 'true',
      IAM_EXPLORE_TENANT_BASE_URL: 'https://de-musterhausen.example.test/',
      IAM_EXPLORE_TENANT_USERNAME: 'tenant-admin',
      IAM_EXPLORE_TENANT_PASSWORD: 'tenant-secret',
      IAM_EXPLORE_NEIGHBOR_TENANT_BASE_URL: 'https://de-nachbarstadt.example.test/',
      IAM_EXPLORE_NEIGHBOR_TENANT_USERNAME: 'neighbor-admin',
      IAM_EXPLORE_NEIGHBOR_TENANT_PASSWORD: 'neighbor-secret',
    });

    expect(config).toEqual({
      admin: {
        username: 'admin-user',
        password: 'super-secret',
      },
      baseUrl: 'https://studio.example.test',
      localBrowser: {
        headless: false,
      },
      mission: 'admin-users-overview',
      runMode: 'story-loop',
      storyFilters: {
        clusters: ['tenant-user-create', 'tenant-isolation'],
        packageIds: ['IAM-P2', 'IAM-P5'],
        resume: true,
        storyIds: [18, 19, 37],
      },
      tenant: {
        admin: {
          username: 'tenant-admin',
          password: 'tenant-secret',
        },
        baseUrl: 'https://de-musterhausen.example.test',
        neighbor: {
          admin: {
            username: 'neighbor-admin',
            password: 'neighbor-secret',
          },
          baseUrl: 'https://de-nachbarstadt.example.test',
        },
      },
    });
  });

  it('rejects partial neighbor tenant config deterministically', () => {
    expect(() =>
      parseAdminExplorationConfig({
        IAM_EXPLORE_ADMIN_BASE_URL: 'https://studio.example.test',
        IAM_EXPLORE_ADMIN_USERNAME: 'admin-user',
        IAM_EXPLORE_ADMIN_PASSWORD: 'super-secret',
        IAM_EXPLORE_TENANT_BASE_URL: 'https://de-musterhausen.example.test/',
        IAM_EXPLORE_TENANT_USERNAME: 'tenant-admin',
        IAM_EXPLORE_TENANT_PASSWORD: 'tenant-secret',
        IAM_EXPLORE_NEIGHBOR_TENANT_BASE_URL: 'https://de-nachbarstadt.example.test/',
      })
    ).toThrowError(
      'Missing AdminExploration neighbor tenant config env vars: IAM_EXPLORE_NEIGHBOR_TENANT_BASE_URL, IAM_EXPLORE_NEIGHBOR_TENANT_USERNAME, IAM_EXPLORE_NEIGHBOR_TENANT_PASSWORD'
    );
  });

  it('defaults whitespace-only mission values to admin-users-overview', () => {
    const config = parseAdminExplorationConfig({
      IAM_EXPLORE_ADMIN_BASE_URL: 'https://studio.example.test',
      IAM_EXPLORE_ADMIN_USERNAME: 'admin-user',
      IAM_EXPLORE_ADMIN_PASSWORD: 'super-secret',
      IAM_EXPLORE_ADMIN_MISSION: '   ',
    });

    expect(config.mission).toBe('admin-users-overview');
  });

  it('rejects invalid headless values deterministically', () => {
    expect(() =>
      parseAdminExplorationConfig({
        IAM_EXPLORE_ADMIN_BASE_URL: 'https://studio.example.test',
        IAM_EXPLORE_ADMIN_USERNAME: 'admin-user',
        IAM_EXPLORE_ADMIN_PASSWORD: 'super-secret',
        IAM_EXPLORE_HEADLESS: 'visible',
      })
    ).toThrowError('Invalid AdminExploration headless flag: visible. Expected one of: true, false, 1, 0, yes, no');
  });

  it('throws a deterministic error listing missing required env keys', () => {
    expect(() => parseAdminExplorationConfig({})).toThrowError(
      'Missing AdminExploration admin config env vars: IAM_EXPLORE_ADMIN_BASE_URL|IAM_ACCEPTANCE_BASE_URL, IAM_EXPLORE_ADMIN_USERNAME|IAM_ACCEPTANCE_ADMIN_USERNAME, IAM_EXPLORE_ADMIN_PASSWORD|IAM_ACCEPTANCE_ADMIN_PASSWORD'
    );
  });

  it('treats whitespace-only required env values as missing', () => {
    expect(() =>
      parseAdminExplorationConfig({
        IAM_EXPLORE_ADMIN_BASE_URL: '   ',
        IAM_EXPLORE_ADMIN_USERNAME: '\t',
        IAM_EXPLORE_ADMIN_PASSWORD: '\n',
      })
    ).toThrowError(
      'Missing AdminExploration admin config env vars: IAM_EXPLORE_ADMIN_BASE_URL|IAM_ACCEPTANCE_BASE_URL, IAM_EXPLORE_ADMIN_USERNAME|IAM_ACCEPTANCE_ADMIN_USERNAME, IAM_EXPLORE_ADMIN_PASSWORD|IAM_ACCEPTANCE_ADMIN_PASSWORD'
    );
  });

  it('rejects unusable base URLs after normalization', () => {
    expect(() =>
      parseAdminExplorationConfig({
        IAM_EXPLORE_ADMIN_BASE_URL: '/',
        IAM_EXPLORE_ADMIN_USERNAME: 'admin-user',
        IAM_EXPLORE_ADMIN_PASSWORD: 'super-secret',
      })
    ).toThrowError('Invalid AdminExploration admin base URL: /. Expected an absolute http(s) URL.');
  });

  it('rejects invalid mission values deterministically', () => {
    expect(() =>
      parseAdminExplorationConfig({
        IAM_EXPLORE_ADMIN_BASE_URL: 'https://studio.example.test',
        IAM_EXPLORE_ADMIN_USERNAME: 'admin-user',
        IAM_EXPLORE_ADMIN_PASSWORD: 'super-secret',
        IAM_EXPLORE_ADMIN_MISSION: 'admin-does-not-exist',
      })
    ).toThrowError(
      'Invalid AdminExploration admin mission: admin-does-not-exist. Expected one of: admin-users-overview, admin-user-permissions-inspection, admin-role-management-navigation'
    );
  });

  it('rejects unsupported pilot missions in mission mode', () => {
    expect(() =>
      parseAdminExplorationConfig({
        IAM_EXPLORE_ADMIN_BASE_URL: 'https://studio.example.test',
        IAM_EXPLORE_ADMIN_USERNAME: 'admin-user',
        IAM_EXPLORE_ADMIN_PASSWORD: 'super-secret',
        IAM_EXPLORE_ADMIN_MISSION: 'admin-role-management-navigation',
      })
    ).toThrowError(
      'Invalid AdminExploration admin mission for mission mode: admin-role-management-navigation. Expected one of: admin-users-overview'
    );
  });

  it('allows extended story mission mappings in story-loop mode', () => {
    const config = parseAdminExplorationConfig({
      IAM_EXPLORE_ADMIN_BASE_URL: 'https://studio.example.test',
      IAM_EXPLORE_ADMIN_USERNAME: 'admin-user',
      IAM_EXPLORE_ADMIN_PASSWORD: 'super-secret',
      IAM_EXPLORE_ADMIN_MISSION: 'admin-role-management-navigation',
      IAM_EXPLORE_RUN_MODE: 'story-loop',
    });

    expect(config.mission).toBe('admin-role-management-navigation');
    expect(config.runMode).toBe('story-loop');
  });

  it('rejects malformed story id filters fail-closed', () => {
    expect(() =>
      parseAdminExplorationConfig({
        IAM_EXPLORE_ADMIN_BASE_URL: 'https://studio.example.test',
        IAM_EXPLORE_ADMIN_USERNAME: 'admin-user',
        IAM_EXPLORE_ADMIN_PASSWORD: 'super-secret',
        IAM_EXPLORE_RUN_MODE: 'story-loop',
        IAM_EXPLORE_STORY_IDS: '18x, 19',
      })
    ).toThrowError(
      'Invalid AdminExploration story id filter: 18x, 19. Expected a comma-separated list of numeric story ids.'
    );
  });

  it('rejects unknown cluster filters fail-closed', () => {
    expect(() =>
      parseAdminExplorationConfig({
        IAM_EXPLORE_ADMIN_BASE_URL: 'https://studio.example.test',
        IAM_EXPLORE_ADMIN_USERNAME: 'admin-user',
        IAM_EXPLORE_ADMIN_PASSWORD: 'super-secret',
        IAM_EXPLORE_RUN_MODE: 'story-loop',
        IAM_EXPLORE_STORY_CLUSTERS: 'tenant-user-creat',
      })
    ).toThrowError(
      'Invalid AdminExploration story cluster filter: tenant-user-creat. Expected one of: tenant-user-create, tenant-isolation, tenant-login-context, tenant-user-lifecycle, tenant-user-assignments, role-and-permission-management, legal-text-governance, audit-and-monitoring'
    );
  });
});
