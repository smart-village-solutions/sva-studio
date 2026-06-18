import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { assertRuntimeEnv, buildProfileEnv, parseVarsFile } from './profile-env.ts';

const createRuntimeProfileTempDir = () => {
  const tempDir = mkdtempSync(resolve(tmpdir(), 'runtime-profile-env-'));
  const runtimeDir = resolve(tempDir, 'config/runtime');
  mkdirSync(runtimeDir, { recursive: true });
  return { runtimeDir, tempDir };
};

describe('parseVarsFile', () => {
  it('parses key-value pairs with quotes and ignores comments', () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), 'runtime-profile-env-'));
    const varsFile = resolve(tempDir, 'example.vars');

    try {
      writeFileSync(
        varsFile,
        ['# comment', 'PLAIN=value', 'DOUBLE="quoted value"', "SINGLE='other value'", 'IGNORED', ''].join('\n'),
        'utf8',
      );

      expect(parseVarsFile(varsFile)).toEqual({
        DOUBLE: 'quoted value',
        PLAIN: 'value',
        SINGLE: 'other value',
      });
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});

describe('buildProfileEnv', () => {
  it('merges profile env layers, removes remote-only base keys, and derives runtime aliases', () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), 'runtime-profile-env-'));
    const runtimeDir = resolve(tempDir, 'config/runtime');
    const homeDir = resolve(tempDir, 'home');

    mkdirSync(runtimeDir, { recursive: true });
    mkdirSync(resolve(homeDir, '.config/quantum'), { recursive: true });

    writeFileSync(
      resolve(runtimeDir, 'base.vars'),
      [
        'SVA_STACK_NAME=base-stack',
        'SVA_MAINSERVER_GRAPHQL_URL=https://base.example/graphql',
        'SVA_MAINSERVER_OAUTH_TOKEN_URL=https://base.example/oauth/token',
        'SVA_MAINSERVER_CLIENT_ID=base-client',
        'SVA_MAINSERVER_CLIENT_SECRET=base-secret',
      ].join('\n'),
      'utf8',
    );
    writeFileSync(resolve(runtimeDir, 'studio.vars'), 'SVA_PUBLIC_BASE_URL=https://studio.example.org\n', 'utf8');
    writeFileSync(resolve(runtimeDir, 'studio.local.vars'), 'SVA_STACK_NAME=local-stack\nLOCAL_ONLY=1\n', 'utf8');
    writeFileSync(resolve(homeDir, '.config/quantum/env'), 'QUANTUM_ENDPOINT=acceptance\n', 'utf8');

    try {
      expect(
        buildProfileEnv('studio', {
          processEnv: {
            HOME: homeDir,
            SVA_STACK_NAME: 'process-stack',
          },
          rootDir: tempDir,
        }),
      ).toMatchObject({
        LOCAL_ONLY: '1',
        QUANTUM_ENDPOINT: 'acceptance',
        SVA_MAINSERVER_DEV_API_KEY: 'base-client',
        SVA_MAINSERVER_DEV_API_SECRET: 'base-secret',
        SVA_MAINSERVER_DEV_GRAPHQL_URL: 'https://base.example/graphql',
        SVA_MAINSERVER_DEV_OAUTH_TOKEN_URL: 'https://base.example/oauth/token',
        SVA_PUBLIC_BASE_URL: 'https://studio.example.org',
        SVA_RUNTIME_PROFILE: 'studio',
        SVA_STACK_NAME: 'process-stack',
        VITE_SVA_RUNTIME_PROFILE: 'studio',
      });
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it('enables mock auth flags for mock-auth profiles', () => {
    const { tempDir, runtimeDir } = createRuntimeProfileTempDir();
    writeFileSync(resolve(runtimeDir, 'base.vars'), '', 'utf8');
    writeFileSync(resolve(runtimeDir, 'local-builder.vars'), '', 'utf8');

    try {
      expect(buildProfileEnv('local-builder', { rootDir: tempDir })).toMatchObject({
        BUILDER_DEV_AUTH: 'true',
        SVA_MOCK_AUTH: 'true',
        SVA_RUNTIME_PROFILE: 'local-builder',
        VITE_MOCK_AUTH: 'true',
      });
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it('does not materialize derived alias keys with undefined values', () => {
    const { tempDir, runtimeDir } = createRuntimeProfileTempDir();
    writeFileSync(resolve(runtimeDir, 'base.vars'), '', 'utf8');
    writeFileSync(resolve(runtimeDir, 'studio.vars'), 'SVA_PUBLIC_BASE_URL=https://studio.example.org\n', 'utf8');

    try {
      const env = buildProfileEnv('studio', { rootDir: tempDir });

      expect(env).not.toHaveProperty('SVA_MAINSERVER_DEV_GRAPHQL_URL');
      expect(env).not.toHaveProperty('SVA_MAINSERVER_DEV_OAUTH_TOKEN_URL');
      expect(env).not.toHaveProperty('SVA_MAINSERVER_DEV_API_KEY');
      expect(env).not.toHaveProperty('SVA_MAINSERVER_DEV_API_SECRET');
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});

describe('assertRuntimeEnv', () => {
  it('reports missing required variables with the local override hint', () => {
    expect(() => assertRuntimeEnv('studio', { SVA_RUNTIME_PROFILE: 'studio' })).toThrowError(
      /Optionaler Override: config\/runtime\/studio\.local\.vars/u,
    );
  });
});
