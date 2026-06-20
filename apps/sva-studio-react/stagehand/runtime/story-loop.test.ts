import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { toPortableArtifactPath } from '../reporting/path-utils.ts';
import type { StagehandAdminConfig } from './types.ts';
import { classifyStoryEvidence, runStagehandStoryLoop } from './story-loop.ts';

const temporaryDirectories: string[] = [];

function createTempCatalogFile(): string {
  const directory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-'));
  temporaryDirectories.push(directory);
  const filePath = join(directory, 'user-stories.json');

  writeFileSync(
    filePath,
    JSON.stringify(
      {
        version: '2.7',
        scope: 'IAM',
        updatedAt: '2026-03-19',
        description: 'fixture',
        packages: [
          {
            id: 'IAM-P2',
            title: 'Onboarding und Einladung',
            stories: [
              {
                id: 18,
                role: 'Organisations-Admin',
                story: 'Als Organisations-Admin möchte ich neue Nutzer anlegen können, damit ich mein Team verwalten kann.',
                packageId: 'IAM-P2',
                relatedPackageIds: [],
                legacy: true,
                trigger: 'fixture',
                preconditions: [],
                acceptanceCriteria: ['Ein neuer Nutzerzugang kann im Studio angelegt werden.'],
                evidence: ['Admin-UI'],
                studioCheck: {
                  status: 'offen',
                  coverage: 'nicht_geprueft',
                  notes: '',
                },
                legacyId: 11,
                priority: 1,
              },
            ],
          },
          {
            id: 'IAM-P5',
            title: 'Mandantenkontext und Isolation',
            stories: [
              {
                id: 37,
                role: 'Systembetreiber',
                story: 'Als Systembetreiber möchte ich Mandanten trennen können, damit Daten isoliert bleiben.',
                packageId: 'IAM-P5',
                relatedPackageIds: [],
                legacy: true,
                trigger: 'fixture',
                preconditions: [],
                acceptanceCriteria: ['Mandanten sind fachlich und technisch voneinander getrennt sichtbar.'],
                evidence: ['Negativtest'],
                studioCheck: {
                  status: 'offen',
                  coverage: 'nicht_geprueft',
                  notes: '',
                },
                legacyId: 25,
                priority: 3,
              },
            ],
          },
        ],
      },
      null,
      2
    ),
    'utf8'
  );

  return filePath;
}

function createConfig(): StagehandAdminConfig {
  return {
    admin: {
      username: 'admin-user',
      password: 'super-secret',
    },
    baseUrl: 'https://studio.example.test',
    localBrowser: {
      headless: true,
    },
    mission: 'admin-users-overview',
    openAiApiKey: 'test-openai-key',
    runMode: 'story-loop',
    storyFilters: {
      clusters: [],
      packageIds: [],
      resume: false,
      storyIds: [],
    },
    tenant: {
      admin: {
        username: 'tenant-admin',
        password: 'tenant-secret',
      },
      baseUrl: 'https://de-musterhausen.example.test',
      neighbor: null,
    },
  };
}

function createFakeLocator() {
  return {
    count: async () => 1,
    first: () => ({
      click: async () => undefined,
      fill: async (_value: string) => undefined,
      isVisible: async () => true,
    }),
  };
}

function createFakeChromiumForTenantIsolation() {
  const state: {
    createdDisplayName: string | null;
    createdEmail: string | null;
    createdUserId: string | null;
  } = {
    createdDisplayName: null,
    createdEmail: null,
    createdUserId: null,
  };

  function createPage(kind: 'primary' | 'neighbor') {
    let currentUrl = '';

    return {
      getByRole: () => createFakeLocator(),
      locator: () => createFakeLocator(),
      goto: async (url: string) => {
        currentUrl = url;
      },
      textContent: async () => {
        if (kind === 'primary' && currentUrl.endsWith(`/admin/users/${state.createdUserId ?? ''}`)) {
          return `${state.createdEmail ?? ''} ${state.createdDisplayName ?? ''}`;
        }

        if (kind === 'neighbor' && currentUrl.endsWith(`/admin/users/${state.createdUserId ?? ''}`)) {
          return 'Nicht gefunden';
        }

        return '';
      },
      waitForLoadState: async () => undefined,
      waitForURL: async () => undefined,
    };
  }

  function createContext(kind: 'primary' | 'neighbor') {
    return {
      close: async () => undefined,
      newPage: async () => createPage(kind),
      request: {
        get: async (url: string) => {
          if (kind === 'neighbor' && url.endsWith(`/api/v1/iam/users/${state.createdUserId ?? ''}`)) {
            return {
              json: async () => ({ error: { message: 'Not found' } }),
              status: () => 404,
            };
          }

          throw new Error(`Unexpected GET URL for ${kind}: ${url}`);
        },
        post: async (url: string, input: { data: { displayName: string; email: string } }) => {
          if (kind === 'primary' && url.endsWith('/api/v1/iam/users')) {
            state.createdDisplayName = input.data.displayName;
            state.createdEmail = input.data.email;
            state.createdUserId = 'user-123';

            return {
              json: async () => ({ data: { invitation: { status: 'not_requested' }, user: { id: 'user-123' } } }),
              status: () => 201,
            };
          }

          throw new Error(`Unexpected POST URL for ${kind}: ${url}`);
        },
      },
    };
  }

  const contexts = [createContext('primary'), createContext('neighbor')];

  return {
    launch: async () => ({
      close: async () => undefined,
      newContext: async () => {
        const next = contexts.shift();

        if (next === undefined) {
          throw new Error('Unexpected extra browser context request');
        }

        return next;
      },
    }),
  };
}

function createFakeChromiumForUserRoleAssignment() {
  const state: {
    activeRoleTab: 'assignments' | 'general';
    createdRoleDisplayName: string | null;
    createdRoleId: string | null;
    createdRoleName: string | null;
    createdUserDisplayName: string | null;
    createdUserEmail: string | null;
    createdUserId: string | null;
    assignedRoleIds: string[];
    currentUrl: string;
    formValues: Record<string, string>;
    loginClicked: boolean;
  } = {
    activeRoleTab: 'general',
    createdRoleDisplayName: null,
    createdRoleId: null,
    createdRoleName: null,
    createdUserDisplayName: null,
    createdUserEmail: null,
    createdUserId: null,
    assignedRoleIds: [],
    currentUrl: '',
    formValues: {},
    loginClicked: false,
  };

  function createLocator(query: { role?: string; selector?: string; roleName?: string | RegExp }) {
    const isVisible = () => {
      if (query.selector === '#role-assignment-search') {
        return state.currentUrl.includes('/admin/roles/') && state.activeRoleTab === 'assignments';
      }

      if (query.roleName instanceof RegExp) {
        const label = query.roleName.source.toLowerCase();
        if (label.includes('zuweisungen')) {
          return query.role === 'tab';
        }
        if (label.includes('zuweisen')) {
          return state.activeRoleTab === 'assignments' && state.formValues['#role-assignment-search'] === state.createdUserEmail;
        }
      }

      return true;
    };

    return {
      count: async () => (isVisible() ? 1 : 0),
      first: () => ({
        click: async () => {
          if (query.selector === '#kc-login' || (query.roleName instanceof RegExp && query.roleName.source.toLowerCase().includes('login'))) {
            state.loginClicked = true;
            state.currentUrl = 'https://de-musterhausen.example.test/dashboard';
            return;
          }

          if (query.roleName instanceof RegExp && query.roleName.source.toLowerCase().includes('rolle anlegen')) {
            state.createdRoleName = state.formValues['#create-role-key'] ?? null;
            state.createdRoleDisplayName = state.formValues['#create-role-name'] ?? null;
            state.createdRoleId = 'role-assign-123';
            state.currentUrl = `https://de-musterhausen.example.test/admin/roles/${state.createdRoleId}`;
            return;
          }

          if (query.roleName instanceof RegExp && query.roleName.source.toLowerCase().includes('nutzer anlegen')) {
            const firstName = state.formValues['#create-user-first-name'] ?? '';
            const lastName = state.formValues['#create-user-last-name'] ?? '';
            state.createdUserDisplayName = `${firstName} ${lastName}`.trim();
            state.createdUserEmail = state.formValues['#create-user-email'] ?? null;
            state.createdUserId = 'user-role-123';
            state.currentUrl = `https://de-musterhausen.example.test/admin/users/${state.createdUserId}`;
            return;
          }

          if (query.roleName instanceof RegExp && query.roleName.source.toLowerCase().includes('zuweisungen')) {
            if (query.role !== 'tab') {
              throw new Error('Assignments control must be selected as a tab');
            }
            state.activeRoleTab = 'assignments';
            return;
          }

          if (query.roleName instanceof RegExp && query.roleName.source.toLowerCase().includes('zuweisen')) {
            if (state.createdRoleId !== null) {
              state.assignedRoleIds = [state.createdRoleId];
            }
          }
        },
        fill: async (value: string) => {
          if (query.selector !== undefined) {
            state.formValues[query.selector] = value;
          }
        },
        isVisible: async () => isVisible(),
        selectOption: async (value: string) => {
          if (query.selector !== undefined) {
            state.formValues[query.selector] = value;
          }
        },
      }),
    };
  }

  function createPage() {
    return {
      getByRole: (role: string, options: { name: string | RegExp }) => createLocator({ role, roleName: options.name }),
      locator: (selector: string) => createLocator({ selector }),
      goto: async (url: string) => {
        state.currentUrl = url;
        if (url.includes('/admin/roles/')) {
          state.activeRoleTab = 'general';
        }
      },
      textContent: async () => '',
      url: () => state.currentUrl,
      waitForLoadState: async () => undefined,
      waitForURL: async () => undefined,
    };
  }

  const context = {
    close: async () => undefined,
    newPage: async () => createPage(),
    request: {
      get: async (url: string) => {
        if (url.endsWith(`/api/v1/iam/users/${state.createdUserId ?? ''}`)) {
          return {
            json: async () => ({
              data: {
                id: state.createdUserId,
                email: state.createdUserEmail,
                displayName: state.createdUserDisplayName,
                roles: state.assignedRoleIds.map((roleId) => ({
                  roleId,
                  roleName: state.createdRoleDisplayName,
                })),
              },
            }),
            status: () => 200,
          };
        }

        if (url.endsWith('/api/v1/iam/roles')) {
          return {
            json: async () => ({
              data: [
                {
                  id: state.createdRoleId,
                  displayName: state.createdRoleDisplayName,
                  roleName: state.createdRoleName,
                },
              ],
            }),
            status: () => 200,
          };
        }

        throw new Error(`Unexpected GET URL: ${url}`);
      },
      post: async (
        url: string
      ) => {
        throw new Error(`Unexpected POST URL: ${url}`);
      },
    },
  };

  return {
    launch: async () => ({
      close: async () => undefined,
      newContext: async () => context,
    }),
  };
}

function createFakeChromiumForTenantUserCreateFailure(options: {
  readonly createStatus?: number;
  readonly errorMessage?: string;
  readonly omitUserId?: boolean;
  readonly userVisible?: boolean;
}) {
  const state = {
    createdDisplayName: null as string | null,
    createdEmail: null as string | null,
    createdUserId: options.omitUserId ? null : 'user-failure-123',
  };

  return {
    launch: async () => ({
      close: async () => undefined,
      newContext: async () => ({
        close: async () => undefined,
        newPage: async () => {
          let currentUrl = '';

          return {
            getByRole: () => createFakeLocator(),
            locator: () => createFakeLocator(),
            goto: async (url: string) => {
              currentUrl = url;
            },
            textContent: async () => {
              if (options.userVisible === false && currentUrl.endsWith(`/admin/users/${state.createdUserId ?? ''}`)) {
                return 'Kein Nutzerbeleg sichtbar';
              }

              if (currentUrl.endsWith(`/admin/users/${state.createdUserId ?? ''}`)) {
                return `${state.createdEmail ?? ''} ${state.createdDisplayName ?? ''}`;
              }

              return '';
            },
            waitForLoadState: async () => undefined,
            waitForURL: async () => undefined,
          };
        },
        request: {
          post: async (url: string, input: { data: { displayName: string; email: string } }) => {
            if (url.endsWith('/api/v1/iam/users') === false) {
              throw new Error(`Unexpected POST URL: ${url}`);
            }

            state.createdDisplayName = input.data.displayName;
            state.createdEmail = input.data.email;

            return {
              json: async () => ({
                data: state.createdUserId === null ? {} : { user: { id: state.createdUserId } },
                error: options.errorMessage ? { message: options.errorMessage } : undefined,
              }),
              status: () => options.createStatus ?? 201,
            };
          },
        },
      }),
    }),
  };
}

function createFakeChromiumForRoleAssignmentFailure() {
  return {
    launch: async () => ({
      close: async () => undefined,
      newContext: async () => ({
        close: async () => undefined,
        newPage: async () => ({
          getByRole: () => createFakeLocator(),
          locator: (selector: string) => {
            if (selector === '#create-role-key') {
              return {
                count: async () => 0,
                first: () => ({
                  fill: async () => undefined,
                  isVisible: async () => false,
                }),
              };
            }

            return createFakeLocator();
          },
          goto: async () => undefined,
          textContent: async () => '',
          url: () => 'https://de-musterhausen.example.test/admin/roles/new',
          waitForLoadState: async () => undefined,
          waitForURL: async () => undefined,
        }),
        request: {
          get: async () => {
            throw new Error('GET should not be reached when UI setup fails early');
          },
        },
      }),
    }),
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('runStagehandStoryLoop', () => {
  it('classifies story evidence strictly from positive and negative verification', () => {
    expect(
      classifyStoryEvidence({
        storyId: 18,
        coverage: 'vorhanden',
        findings: ['Positiver UI-Effekt sichtbar.'],
        notes: 'Nur der Positivfall wurde gesehen.',
        verification: {
          environment: 'adequate',
          negative: 'missing',
          positive: 'verified',
        },
      }).status
    ).toBe('unklar');

    expect(
      classifyStoryEvidence({
        storyId: 18,
        coverage: 'vorhanden',
        findings: ['Positiv- und Negativfall belegt.'],
        notes: 'Mandantensicht und Isolation wurden gemeinsam verifiziert.',
        verification: {
          environment: 'adequate',
          negative: 'verified',
          positive: 'verified',
        },
      }).status
    ).toBe('erfuellt');

    expect(
      classifyStoryEvidence({
        storyId: 37,
        coverage: 'nachweis_fehlend',
        findings: ['Lokaler Negativnachweis ist in dieser Umgebung nicht ehrlich reproduzierbar.'],
        notes: 'Mail- oder Cross-Tenant-Nachweis fehlt lokal.',
        verification: {
          environment: 'insufficient',
          negative: 'missing',
          positive: 'missing',
        },
      }).status
    ).toBe('umgebung_unzureichend');
  });

  it('classifies filtered stories, writes reports, and emits an overlay instead of mutating the catalog source', async () => {
    const storySourcePath = createTempCatalogFile();
    const reportsDirectory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-reports-'));
    temporaryDirectories.push(reportsDirectory);

    const result = await runStagehandStoryLoop(createConfig(), {
      generatedAt: '2026-05-16T18:00:00.000Z',
      reportsRoot: join(reportsDirectory, 'reports'),
      storySourcePath,
      executeCluster: async ({ cluster, stories }) => {
        if (cluster.id === 'tenant-user-create') {
          return stories.map((story) => ({
            storyId: story.id,
            coverage: 'vorhanden',
            findings: ['Neuer Nutzer wurde angelegt und in der Verwaltungsansicht gefunden.'],
            notes: 'Artefakte unter story-loop/tenant-user-create.',
            verification: {
              environment: 'adequate',
              negative: 'verified',
              positive: 'verified',
            },
          }));
        }

        return stories.map((story) => ({
          storyId: story.id,
          coverage: 'nachweis_fehlend',
          findings: ['Kein sicherer lokaler Negativnachweis fuer tenant-uebergreifende Sichtpruefung verfuegbar.'],
          notes: 'Keine beobachtbare UI/API fuer tenant-uebergreifenden Negativtest.',
          verification: {
            environment: 'insufficient',
            negative: 'missing',
            positive: 'missing',
          },
        }));
      },
    });

    expect(result.summary).toEqual({
      clusters: 2,
      storiesClassified: 2,
      storiesFailedEvidence: 0,
      storiesPassed: 1,
      storiesSkipped: 0,
    });

    const original = JSON.parse(readFileSync(storySourcePath, 'utf8')) as {
      packages: Array<{ stories: Array<{ id: number; studioCheck: { status: string; coverage: string; notes: string } }> }>;
    };
    const overlay = JSON.parse(readFileSync(result.artifacts.overlayPath, 'utf8')) as {
      stories: Array<{ storyId: number; clusterId: string; studioCheck: { status: string; coverage: string; notes: string } }>;
      sourcePath: string;
    };

    expect(original.packages[0]?.stories[0]?.studioCheck).toEqual({
      status: 'offen',
      coverage: 'nicht_geprueft',
      notes: '',
    });
    expect(overlay.sourcePath).toBe(toPortableArtifactPath(storySourcePath));
    expect(overlay.stories.map((entry) => entry.storyId)).toEqual([18, 37]);
    expect(overlay.stories[1]?.studioCheck.status).toBe('umgebung_unzureichend');

    expect(JSON.parse(readFileSync(result.artifacts.statusPath, 'utf8'))).toMatchObject({
      overlayPath: toPortableArtifactPath(result.artifacts.overlayPath),
      summary: {
        storiesPassed: 1,
        storiesFailedEvidence: 0,
      },
    });
    expect(readFileSync(result.artifacts.reportPath, 'utf8')).toContain('## Story-Ergebnisse');
    expect(readFileSync(result.artifacts.reportPath, 'utf8')).toContain('Umgebung unzureichend');
  });

  it('supports resume mode by skipping stories that are already classified', async () => {
    const storySourcePath = createTempCatalogFile();
    const reportsDirectory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-resume-'));
    temporaryDirectories.push(reportsDirectory);

    writeFileSync(
      storySourcePath,
      JSON.stringify(
        {
          version: '2.7',
          scope: 'IAM',
          updatedAt: '2026-03-19',
          description: 'fixture',
          packages: [
            {
              id: 'IAM-P2',
              title: 'Onboarding und Einladung',
              stories: [
                {
                  id: 18,
                  role: 'Organisations-Admin',
                  story: 'Als Organisations-Admin möchte ich neue Nutzer anlegen können, damit ich mein Team verwalten kann.',
                  packageId: 'IAM-P2',
                  relatedPackageIds: [],
                  legacy: true,
                  trigger: 'fixture',
                  preconditions: [],
                  acceptanceCriteria: ['Ein neuer Nutzerzugang kann im Studio angelegt werden.'],
                  evidence: ['Admin-UI'],
                  studioCheck: {
                    status: 'erfuellt',
                    coverage: 'vorhanden',
                    notes: 'Bereits geprüft',
                  },
                  legacyId: 11,
                  priority: 1,
                },
              ],
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runStagehandStoryLoop(
      {
        ...createConfig(),
        storyFilters: {
          clusters: [],
          packageIds: [],
          resume: true,
          storyIds: [],
        },
      },
      {
        generatedAt: '2026-05-16T18:00:00.000Z',
        reportsRoot: join(reportsDirectory, 'reports'),
        storySourcePath,
        executeCluster: async () => {
          throw new Error('executeCluster should not be called for resumed stories');
        },
      }
    );

    expect(result.summary).toEqual({
      clusters: 0,
      storiesClassified: 0,
      storiesFailedEvidence: 0,
      storiesPassed: 0,
      storiesSkipped: 1,
    });
  });

  it('preserves artifacts when a cluster executor throws and downgrades the affected stories to insufficient evidence', async () => {
    const storySourcePath = createTempCatalogFile();
    const reportsDirectory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-cluster-throw-'));
    temporaryDirectories.push(reportsDirectory);

    const result = await runStagehandStoryLoop(createConfig(), {
      generatedAt: '2026-05-16T18:00:00.000Z',
      reportsRoot: join(reportsDirectory, 'reports'),
      storySourcePath,
      executeCluster: async ({ cluster, stories }) => {
        if (cluster.id === 'tenant-user-create') {
          throw new Error('tenant login timeout');
        }

        return stories.map((story) => ({
          storyId: story.id,
          coverage: 'nachweis_fehlend',
          findings: ['Kein sicherer lokaler Negativnachweis verfuegbar.'],
          notes: 'Keine beobachtbare UI/API fuer tenant-uebergreifenden Negativtest.',
          verification: {
            environment: 'insufficient',
            negative: 'missing',
            positive: 'missing',
          },
        }));
      },
    });

    expect(result.summary).toEqual({
      clusters: 2,
      storiesClassified: 2,
      storiesFailedEvidence: 0,
      storiesPassed: 0,
      storiesSkipped: 0,
    });
    expect(readFileSync(result.artifacts.reportPath, 'utf8')).toContain('tenant-user-create');
    expect(readFileSync(result.artifacts.reportPath, 'utf8')).toContain('tenant login timeout');
    expect(JSON.parse(readFileSync(result.artifacts.overlayPath, 'utf8'))).toMatchObject({
      stories: [
        {
          storyId: 18,
          studioCheck: {
            status: 'umgebung_unzureichend',
            coverage: 'nachweis_fehlend',
          },
          findings: expect.arrayContaining([expect.stringContaining('tenant login timeout')]),
        },
        {
          storyId: 37,
          studioCheck: {
            status: 'umgebung_unzureichend',
            coverage: 'nachweis_fehlend',
          },
        },
      ],
    });
  });

  it('rejects story id filters without catalog matches fail-closed', async () => {
    const storySourcePath = createTempCatalogFile();
    const reportsDirectory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-invalid-story-id-'));
    temporaryDirectories.push(reportsDirectory);

    await expect(() =>
      runStagehandStoryLoop(
        {
          ...createConfig(),
          storyFilters: {
            clusters: [],
            packageIds: [],
            resume: false,
            storyIds: [81],
          },
        },
        {
          generatedAt: '2026-05-16T18:00:00.000Z',
          reportsRoot: join(reportsDirectory, 'reports'),
          storySourcePath,
        }
      )
    ).rejects.toThrowError('Stagehand story id filter matched no catalog entries: 81');
  });

  it('rejects package filters without catalog matches fail-closed', async () => {
    const storySourcePath = createTempCatalogFile();
    const reportsDirectory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-invalid-package-id-'));
    temporaryDirectories.push(reportsDirectory);

    await expect(() =>
      runStagehandStoryLoop(
        {
          ...createConfig(),
          storyFilters: {
            clusters: [],
            packageIds: ['IAM-P9'],
            resume: false,
            storyIds: [],
          },
        },
        {
          generatedAt: '2026-05-16T18:00:00.000Z',
          reportsRoot: join(reportsDirectory, 'reports'),
          storySourcePath,
        }
      )
    ).rejects.toThrowError('Stagehand package filter matched no catalog entries: IAM-P9');
  });

  it('rejects cluster filters without eligible stories fail-closed', async () => {
    const storySourcePath = createTempCatalogFile();
    const reportsDirectory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-invalid-cluster-'));
    temporaryDirectories.push(reportsDirectory);

    await expect(() =>
      runStagehandStoryLoop(
        {
          ...createConfig(),
          storyFilters: {
            clusters: ['role-and-permission-management'],
            packageIds: [],
            resume: false,
            storyIds: [],
          },
        },
        {
          generatedAt: '2026-05-16T18:00:00.000Z',
          reportsRoot: join(reportsDirectory, 'reports'),
          storySourcePath,
        }
      )
    ).rejects.toThrowError('Stagehand cluster filter matched no eligible stories: role-and-permission-management');
  });

  it('marks unimplemented default clusters as environment insufficient instead of unclear', async () => {
    const storySourcePath = createTempCatalogFile();
    const reportsDirectory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-insufficient-'));
    temporaryDirectories.push(reportsDirectory);

    const result = await runStagehandStoryLoop(
      {
        ...createConfig(),
        storyFilters: {
          clusters: ['tenant-isolation'],
          packageIds: [],
          resume: false,
          storyIds: [],
        },
      },
      {
        generatedAt: '2026-05-16T18:00:00.000Z',
        reportsRoot: join(reportsDirectory, 'reports'),
        storySourcePath,
      }
    );

    expect(result.summary).toEqual({
      clusters: 1,
      storiesClassified: 1,
      storiesFailedEvidence: 0,
      storiesPassed: 0,
      storiesSkipped: 1,
    });

    expect(JSON.parse(readFileSync(result.artifacts.overlayPath, 'utf8'))).toMatchObject({
      stories: [
        {
          storyId: 37,
          studioCheck: {
            status: 'umgebung_unzureichend',
            coverage: 'nachweis_fehlend',
          },
        },
      ],
    });
  });

  it('verifies tenant isolation with a neighbor tenant negative proof on the default executor path', async () => {
    const storySourcePath = createTempCatalogFile();
    const reportsDirectory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-tenant-isolation-'));
    temporaryDirectories.push(reportsDirectory);

    const result = await runStagehandStoryLoop(
      {
        ...createConfig(),
        storyFilters: {
          clusters: ['tenant-isolation'],
          packageIds: [],
          resume: false,
          storyIds: [],
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
      },
      {
        generatedAt: '2026-05-16T18:00:00.000Z',
        loadChromium: async () => createFakeChromiumForTenantIsolation() as never,
        reportsRoot: join(reportsDirectory, 'reports'),
        storySourcePath,
      }
    );

    expect(result.summary).toEqual({
      clusters: 1,
      storiesClassified: 1,
      storiesFailedEvidence: 0,
      storiesPassed: 1,
      storiesSkipped: 1,
    });

    expect(JSON.parse(readFileSync(result.artifacts.overlayPath, 'utf8'))).toMatchObject({
      stories: [
        {
          storyId: 37,
          studioCheck: {
            status: 'erfuellt',
            coverage: 'vorhanden',
          },
          findings: expect.arrayContaining([
            expect.stringContaining('Nutzer'),
            expect.stringContaining('Nachbar-Mandanten'),
          ]),
        },
      ],
    });
  });

  it('downgrades tenant-user-create when tenant configuration is missing on the default executor path', async () => {
    const storySourcePath = createTempCatalogFile();
    const reportsDirectory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-tenant-user-create-missing-tenant-'));
    temporaryDirectories.push(reportsDirectory);

    const result = await runStagehandStoryLoop(
      {
        ...createConfig(),
        storyFilters: {
          clusters: ['tenant-user-create'],
          packageIds: [],
          resume: false,
          storyIds: [],
        },
        tenant: null,
      },
      {
        generatedAt: '2026-05-16T18:00:00.000Z',
        reportsRoot: join(reportsDirectory, 'reports'),
        storySourcePath,
      }
    );

    expect(result.summary).toEqual({
      clusters: 1,
      storiesClassified: 1,
      storiesFailedEvidence: 0,
      storiesPassed: 0,
      storiesSkipped: 1,
    });

    expect(JSON.parse(readFileSync(result.artifacts.overlayPath, 'utf8'))).toMatchObject({
      stories: [
        {
          storyId: 18,
          studioCheck: {
            status: 'umgebung_unzureichend',
            coverage: 'nachweis_fehlend',
            notes: 'Tenant-Konfiguration fehlt; Story kann lokal nicht automatisch geprüft werden.',
          },
        },
      ],
    });
  });

  it('downgrades tenant-user-create when the create API does not return a usable user id', async () => {
    const storySourcePath = createTempCatalogFile();
    const reportsDirectory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-tenant-user-create-api-fail-'));
    temporaryDirectories.push(reportsDirectory);

    const result = await runStagehandStoryLoop(
      {
        ...createConfig(),
        storyFilters: {
          clusters: ['tenant-user-create'],
          packageIds: [],
          resume: false,
          storyIds: [],
        },
      },
      {
        generatedAt: '2026-05-16T18:00:00.000Z',
        loadChromium: async () =>
          createFakeChromiumForTenantUserCreateFailure({
            createStatus: 409,
            errorMessage: 'Conflict while creating user',
            omitUserId: true,
          }) as never,
        reportsRoot: join(reportsDirectory, 'reports'),
        storySourcePath,
      }
    );

    expect(result.summary).toEqual({
      clusters: 1,
      storiesClassified: 1,
      storiesFailedEvidence: 1,
      storiesPassed: 0,
      storiesSkipped: 1,
    });

    expect(JSON.parse(readFileSync(result.artifacts.overlayPath, 'utf8'))).toMatchObject({
      stories: [
        {
          storyId: 18,
          studioCheck: {
            status: 'unklar',
            coverage: 'nachweis_fehlend',
            notes: 'Conflict while creating user',
          },
          findings: expect.arrayContaining(['Tenant-Create-Call fehlgeschlagen: HTTP 409.']),
        },
      ],
    });
  });

  it('downgrades tenant-user-create when the created user is not visible afterwards', async () => {
    const storySourcePath = createTempCatalogFile();
    const reportsDirectory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-tenant-user-create-not-visible-'));
    temporaryDirectories.push(reportsDirectory);

    const result = await runStagehandStoryLoop(
      {
        ...createConfig(),
        storyFilters: {
          clusters: ['tenant-user-create'],
          packageIds: [],
          resume: false,
          storyIds: [],
        },
      },
      {
        generatedAt: '2026-05-16T18:00:00.000Z',
        loadChromium: async () =>
          createFakeChromiumForTenantUserCreateFailure({
            userVisible: false,
          }) as never,
        reportsRoot: join(reportsDirectory, 'reports'),
        storySourcePath,
      }
    );

    expect(JSON.parse(readFileSync(result.artifacts.overlayPath, 'utf8'))).toMatchObject({
      stories: [
        {
          storyId: 18,
          studioCheck: {
            status: 'unklar',
            coverage: 'nachweis_fehlend',
            notes: 'Nutzer wurde erzeugt, konnte aber in der Detailansicht nicht eindeutig nachgewiesen werden.',
          },
        },
      ],
    });
  });

  it('downgrades role-and-permission-management when tenant configuration is missing on the default executor path', async () => {
    const storySourcePath = createTempCatalogFile();
    const reportsDirectory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-role-assignment-missing-tenant-'));
    temporaryDirectories.push(reportsDirectory);

    writeFileSync(
      storySourcePath,
      JSON.stringify(
        {
          version: '2.7',
          scope: 'IAM',
          updatedAt: '2026-03-19',
          description: 'fixture',
          packages: [
            {
              id: 'IAM-P4',
              title: 'Rollen und Rechte',
              stories: [
                {
                  id: 23,
                  role: 'Organisations-Admin',
                  story: 'Als Organisations-Admin möchte ich Rollen verwalten.',
                  packageId: 'IAM-P4',
                  relatedPackageIds: [],
                  legacy: true,
                  trigger: 'fixture',
                  preconditions: [],
                  acceptanceCriteria: ['Rollen können Nutzern zugeordnet werden.'],
                  evidence: ['Admin-UI'],
                  studioCheck: {
                    status: 'offen',
                    coverage: 'nicht_geprueft',
                    notes: '',
                  },
                  legacyId: 23,
                  priority: 1,
                },
              ],
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runStagehandStoryLoop(
      {
        ...createConfig(),
        storyFilters: {
          clusters: ['role-and-permission-management'],
          packageIds: [],
          resume: false,
          storyIds: [],
        },
        tenant: null,
      },
      {
        generatedAt: '2026-05-16T18:00:00.000Z',
        reportsRoot: join(reportsDirectory, 'reports'),
        storySourcePath,
      }
    );

    expect(JSON.parse(readFileSync(result.artifacts.overlayPath, 'utf8'))).toMatchObject({
      stories: [
        {
          storyId: 23,
          studioCheck: {
            status: 'umgebung_unzureichend',
            coverage: 'nachweis_fehlend',
            notes: 'Tenant-Konfiguration fehlt; Rollen- und Zuweisungslauf kann lokal nicht automatisch geprüft werden.',
          },
        },
      ],
    });
  });

  it('downgrades role-and-permission-management when the browser-driven UI flow breaks early', async () => {
    const storySourcePath = createTempCatalogFile();
    const reportsDirectory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-role-assignment-failure-'));
    temporaryDirectories.push(reportsDirectory);

    writeFileSync(
      storySourcePath,
      JSON.stringify(
        {
          version: '2.7',
          scope: 'IAM',
          updatedAt: '2026-03-19',
          description: 'fixture',
          packages: [
            {
              id: 'IAM-P4',
              title: 'Rollen und Rechte',
              stories: [
                {
                  id: 23,
                  role: 'Organisations-Admin',
                  story: 'Als Organisations-Admin möchte ich Rollen verwalten.',
                  packageId: 'IAM-P4',
                  relatedPackageIds: [],
                  legacy: true,
                  trigger: 'fixture',
                  preconditions: [],
                  acceptanceCriteria: ['Rollen können Nutzern zugeordnet werden.'],
                  evidence: ['Admin-UI'],
                  studioCheck: {
                    status: 'offen',
                    coverage: 'nicht_geprueft',
                    notes: '',
                  },
                  legacyId: 23,
                  priority: 1,
                },
              ],
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runStagehandStoryLoop(
      {
        ...createConfig(),
        storyFilters: {
          clusters: ['role-and-permission-management'],
          packageIds: [],
          resume: false,
          storyIds: [],
        },
      },
      {
        generatedAt: '2026-05-16T18:00:00.000Z',
        loadChromium: async () => createFakeChromiumForRoleAssignmentFailure() as never,
        reportsRoot: join(reportsDirectory, 'reports'),
        storySourcePath,
      }
    );

    expect(JSON.parse(readFileSync(result.artifacts.overlayPath, 'utf8'))).toMatchObject({
      stories: [
        {
          storyId: 23,
          studioCheck: {
            status: 'unklar',
            coverage: 'nachweis_fehlend',
            notes: 'Die Rollenanlage konnte in der UI nicht vollständig befüllt werden.',
          },
          findings: ['Der browsergeführte Rollen-/Nutzer-/Zuweisungsflow konnte nicht vollständig ausgeführt werden.'],
        },
      ],
    });
  });

  it('creates a user and role, assigns the role, and verifies the assignment on the default executor path', async () => {
    const storySourcePath = createTempCatalogFile();
    const reportsDirectory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-role-assignment-'));
    temporaryDirectories.push(reportsDirectory);

    const result = await runStagehandStoryLoop(
      {
        ...createConfig(),
        storyFilters: {
          clusters: ['role-and-permission-management'],
          packageIds: [],
          resume: false,
          storyIds: [],
        },
      },
      {
        generatedAt: '2026-05-16T18:00:00.000Z',
        loadChromium: async () => createFakeChromiumForUserRoleAssignment() as never,
        reportsRoot: join(reportsDirectory, 'reports'),
        storySourcePath: (() => {
          writeFileSync(
            storySourcePath,
            JSON.stringify(
              {
                version: '2.7',
                scope: 'IAM',
                updatedAt: '2026-03-19',
                description: 'fixture',
                packages: [
                  {
                    id: 'IAM-P4',
                    title: 'Rollen und Rechte',
                    stories: [
                      {
                        id: 23,
                        role: 'Organisations-Admin',
                        story: 'Als Organisations-Admin möchte ich Rollen verwalten.',
                        packageId: 'IAM-P4',
                        relatedPackageIds: [],
                        legacy: true,
                        trigger: 'fixture',
                        preconditions: [],
                        acceptanceCriteria: ['Rollen können Nutzern zugeordnet werden.'],
                        evidence: ['Admin-UI'],
                        studioCheck: {
                          status: 'offen',
                          coverage: 'nicht_geprueft',
                          notes: '',
                        },
                        legacyId: 23,
                        priority: 1,
                      },
                    ],
                  },
                ],
              },
              null,
              2
            ),
            'utf8'
          );

          return storySourcePath;
        })(),
      }
    );

    expect(result.summary).toEqual({
      clusters: 1,
      storiesClassified: 1,
      storiesFailedEvidence: 1,
      storiesPassed: 0,
      storiesSkipped: 0,
    });

    expect(JSON.parse(readFileSync(result.artifacts.overlayPath, 'utf8'))).toMatchObject({
      stories: [
        {
          storyId: 23,
          studioCheck: {
            status: 'unklar',
            coverage: 'vorhanden',
          },
          findings: expect.arrayContaining([
            expect.stringContaining('Rolle'),
            expect.stringContaining('Nutzer'),
          ]),
        },
      ],
    });
  });

  it('accepts role detail URLs with search params after browser-driven creation', async () => {
    const storySourcePath = createTempCatalogFile();
    const reportsDirectory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-role-create-query-'));
    temporaryDirectories.push(reportsDirectory);

    const roleWithQueryChromium = {
      launch: async () => ({
        close: async () => undefined,
        newContext: async () => ({
          close: async () => undefined,
          newPage: async () => {
            let currentUrl = 'https://de-musterhausen.example.test/dashboard';
            let activeRoleTab = 'general';
            const formValues: Record<string, string> = {};

            const createLocator = (query: { role?: string; selector?: string; roleName?: string | RegExp }) => ({
              count: async () => {
                if (query.selector === '#role-assignment-search') {
                  return currentUrl.includes('/admin/roles/') && activeRoleTab === 'assignments' ? 1 : 0;
                }

                if (query.roleName instanceof RegExp) {
                  const label = query.roleName.source.toLowerCase();
                  if (label.includes('zuweisungen')) {
                    return query.role === 'tab' ? 1 : 0;
                  }
                  if (label.includes('zuweisen')) {
                    return activeRoleTab === 'assignments' ? 1 : 0;
                  }
                }

                return 1;
              },
              first: () => ({
                click: async () => {
                  if (query.roleName instanceof RegExp && query.roleName.source.toLowerCase().includes('rolle anlegen')) {
                    currentUrl =
                      'https://de-musterhausen.example.test/admin/roles/64099c2a-a598-409f-9229-4d421d4f459d?tab=general';
                    return;
                  }

                  if (query.roleName instanceof RegExp && query.roleName.source.toLowerCase().includes('nutzer anlegen')) {
                    currentUrl = 'https://de-musterhausen.example.test/admin/users/user-role-123';
                    return;
                  }

                  if (query.roleName instanceof RegExp && query.roleName.source.toLowerCase().includes('zuweisungen')) {
                    if (query.role !== 'tab') {
                      throw new Error('Assignments control must be selected as a tab');
                    }
                    activeRoleTab = 'assignments';
                  }
                },
                fill: async (value: string) => {
                  if (query.selector) {
                    formValues[query.selector] = value;
                  }
                },
                isVisible: async () => {
                  if (query.selector === '#role-assignment-search') {
                    return currentUrl.includes('/admin/roles/') && activeRoleTab === 'assignments';
                  }

                  if (query.roleName instanceof RegExp && query.roleName.source.toLowerCase().includes('zuweisen')) {
                    return activeRoleTab === 'assignments';
                  }

                  return true;
                },
              }),
            });

            return {
              getByRole: (role: string, options: { name: string | RegExp }) => createLocator({ role, roleName: options.name }),
              locator: (selector: string) => createLocator({ selector }),
              goto: async (url: string) => {
                currentUrl = url;
                if (url.includes('/admin/roles/')) {
                  activeRoleTab = 'general';
                }
              },
              textContent: async () => '',
              url: () => currentUrl,
              waitForLoadState: async () => undefined,
              waitForURL: async (matcher: RegExp) => {
                if (matcher.test(currentUrl) === false) {
                  throw new Error(`URL did not match: ${currentUrl}`);
                }
              },
            };
          },
          request: {
            get: async (url: string) => {
              if (url.endsWith('/api/v1/iam/roles')) {
                return {
                  json: async () => ({
                    data: [
                      {
                        id: '64099c2a-a598-409f-9229-4d421d4f459d',
                        displayName: 'Stagehand Role 123456',
                        roleName: 'stagehand_role_123456',
                      },
                    ],
                  }),
                  status: () => 200,
                };
              }

              if (url.endsWith('/api/v1/iam/users/user-role-123')) {
                return {
                  json: async () => ({
                    data: {
                      roles: [
                        {
                          roleId: '64099c2a-a598-409f-9229-4d421d4f459d',
                          roleName: 'Stagehand Role 123456',
                        },
                      ],
                    },
                  }),
                  status: () => 200,
                };
              }

              throw new Error(`Unexpected GET URL: ${url}`);
            },
          },
        }),
      }),
    };

    const result = await runStagehandStoryLoop(
      {
        ...createConfig(),
        storyFilters: {
          clusters: ['role-and-permission-management'],
          packageIds: [],
          resume: false,
          storyIds: [],
        },
      },
      {
        generatedAt: '2026-05-16T18:00:00.000Z',
        loadChromium: async () => roleWithQueryChromium as never,
        reportsRoot: join(reportsDirectory, 'reports'),
        storySourcePath: (() => {
          writeFileSync(
            storySourcePath,
            JSON.stringify(
              {
                version: '2.7',
                scope: 'IAM',
                updatedAt: '2026-03-19',
                description: 'fixture',
                packages: [
                  {
                    id: 'IAM-P4',
                    title: 'Rollen und Rechte',
                    stories: [
                      {
                        id: 23,
                        role: 'Organisations-Admin',
                        story: 'Als Organisations-Admin möchte ich Rollen verwalten.',
                        packageId: 'IAM-P4',
                        relatedPackageIds: [],
                        legacy: true,
                        trigger: 'fixture',
                        preconditions: [],
                        acceptanceCriteria: ['Rollen können Nutzern zugeordnet werden.'],
                        evidence: ['Admin-UI'],
                        studioCheck: {
                          status: 'offen',
                          coverage: 'nicht_geprueft',
                          notes: '',
                        },
                        legacyId: 23,
                        priority: 1,
                      },
                    ],
                  },
                ],
              },
              null,
              2
            ),
            'utf8'
          );

          return storySourcePath;
        })(),
      }
    );

    expect(result.summary.storiesPassed).toBe(0);
  });
});
