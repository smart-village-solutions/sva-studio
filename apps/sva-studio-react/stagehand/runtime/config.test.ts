import { describe, expect, it } from 'vitest';

import { parseStagehandAdminConfig } from './config.ts';

describe('parseStagehandAdminConfig', () => {
  it('parses explicit stagehand env values and normalizes the base URL', () => {
    const config = parseStagehandAdminConfig({
      STAGEHAND_ADMIN_BASE_URL: 'https://studio.example.test/admin/',
      STAGEHAND_ADMIN_USERNAME: 'admin-user',
      STAGEHAND_ADMIN_PASSWORD: 'super-secret',
      STAGEHAND_ADMIN_MISSION: 'admin-role-management-navigation',
      OPENAI_API_KEY: 'test-openai-key',
    });

    expect(config).toEqual({
      admin: {
        username: 'admin-user',
        password: 'super-secret',
      },
      baseUrl: 'https://studio.example.test/admin',
      mission: 'admin-role-management-navigation',
      openAiApiKey: 'test-openai-key',
    });
  });

  it('falls back to IAM acceptance env values and defaults the mission', () => {
    const config = parseStagehandAdminConfig({
      IAM_ACCEPTANCE_BASE_URL: 'https://iam.example.test/',
      IAM_ACCEPTANCE_ADMIN_USERNAME: 'fallback-admin',
      IAM_ACCEPTANCE_ADMIN_PASSWORD: 'fallback-password',
      OPENAI_API_KEY: 'fallback-openai-key',
    });

    expect(config).toEqual({
      admin: {
        username: 'fallback-admin',
        password: 'fallback-password',
      },
      baseUrl: 'https://iam.example.test',
      mission: 'admin-users-overview',
      openAiApiKey: 'fallback-openai-key',
    });
  });

  it('defaults whitespace-only mission values to admin-users-overview', () => {
    const config = parseStagehandAdminConfig({
      STAGEHAND_ADMIN_BASE_URL: 'https://studio.example.test',
      STAGEHAND_ADMIN_USERNAME: 'admin-user',
      STAGEHAND_ADMIN_PASSWORD: 'super-secret',
      STAGEHAND_ADMIN_MISSION: '   ',
      OPENAI_API_KEY: 'test-openai-key',
    });

    expect(config.mission).toBe('admin-users-overview');
  });

  it('throws a deterministic error listing missing required env keys', () => {
    expect(() => parseStagehandAdminConfig({})).toThrowError(
      'Missing Stagehand admin config env vars: STAGEHAND_ADMIN_BASE_URL|IAM_ACCEPTANCE_BASE_URL, STAGEHAND_ADMIN_USERNAME|IAM_ACCEPTANCE_ADMIN_USERNAME, STAGEHAND_ADMIN_PASSWORD|IAM_ACCEPTANCE_ADMIN_PASSWORD, OPENAI_API_KEY'
    );
  });

  it('treats whitespace-only required env values as missing', () => {
    expect(() =>
      parseStagehandAdminConfig({
        STAGEHAND_ADMIN_BASE_URL: '   ',
        STAGEHAND_ADMIN_USERNAME: '\t',
        STAGEHAND_ADMIN_PASSWORD: '\n',
        OPENAI_API_KEY: ' ',
      })
    ).toThrowError(
      'Missing Stagehand admin config env vars: STAGEHAND_ADMIN_BASE_URL|IAM_ACCEPTANCE_BASE_URL, STAGEHAND_ADMIN_USERNAME|IAM_ACCEPTANCE_ADMIN_USERNAME, STAGEHAND_ADMIN_PASSWORD|IAM_ACCEPTANCE_ADMIN_PASSWORD, OPENAI_API_KEY'
    );
  });

  it('rejects unusable base URLs after normalization', () => {
    expect(() =>
      parseStagehandAdminConfig({
        STAGEHAND_ADMIN_BASE_URL: '/',
        STAGEHAND_ADMIN_USERNAME: 'admin-user',
        STAGEHAND_ADMIN_PASSWORD: 'super-secret',
        OPENAI_API_KEY: 'test-openai-key',
      })
    ).toThrowError('Invalid Stagehand admin base URL: /. Expected an absolute http(s) URL.');
  });

  it('rejects invalid mission values deterministically', () => {
    expect(() =>
      parseStagehandAdminConfig({
        STAGEHAND_ADMIN_BASE_URL: 'https://studio.example.test',
        STAGEHAND_ADMIN_USERNAME: 'admin-user',
        STAGEHAND_ADMIN_PASSWORD: 'super-secret',
        STAGEHAND_ADMIN_MISSION: 'admin-does-not-exist',
        OPENAI_API_KEY: 'test-openai-key',
      })
    ).toThrowError(
      'Invalid Stagehand admin mission: admin-does-not-exist. Expected one of: admin-users-overview, admin-user-permissions-inspection, admin-role-management-navigation'
    );
  });
});
