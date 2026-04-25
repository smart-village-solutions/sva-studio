import nxPlugin from '@nx/eslint-plugin'

export default [
  ...nxPlugin.configs['flat/base'],
  ...nxPlugin.configs['flat/typescript'],
  ...nxPlugin.configs['flat/javascript'],
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.output/**', '**/.tanstack/**'],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [
            '../../../scripts/ci/check-file-placement.ts',
            '../../../scripts/ci/check-openapi-iam.ts',
            '../../../scripts/ci/check-server-package-runtime.ts',
            '../../../scripts/ci/clean-source-artifacts.ts',
            '../../../scripts/ci/complexity-gate.ts',
            '../../../scripts/ci/coverage-gate.ts',
            '../../../scripts/ops/deploy-feedback-loop.ts',
            '../../../scripts/ops/runtime/bootstrap-job.ts',
            '../../../scripts/ops/runtime/deploy-project.ts',
            '../../../scripts/ops/runtime/image-platform.ts',
            '../../../scripts/ops/runtime/migration-job.ts',
            '../../../scripts/ops/runtime/remote-service-spec.ts',
            '../../../scripts/ops/runtime/remote-stack-state.ts',
            '../../../scripts/ops/runtime-env.shared.ts',
            '../../../scripts/ops/studio-release-local.ts',
          ],
          depConstraints: [
            {
              sourceTag: 'scope:core',
              onlyDependOnLibsWithTags: ['scope:core'],
            },
            {
              sourceTag: 'scope:data',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:data-client',
                'scope:data-repositories',
                'scope:data',
              ],
            },
            {
              sourceTag: 'scope:data-client',
              onlyDependOnLibsWithTags: ['scope:core', 'scope:data-client'],
            },
            {
              sourceTag: 'scope:data-repositories',
              onlyDependOnLibsWithTags: ['scope:core', 'scope:server-runtime', 'scope:data-repositories'],
            },
            {
              sourceTag: 'scope:sdk',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:data',
                'scope:sdk',
                'scope:monitoring',
                'scope:server-runtime',
                'scope:plugin-sdk',
              ],
            },
            {
              sourceTag: 'scope:plugin-sdk',
              onlyDependOnLibsWithTags: ['scope:core', 'scope:plugin-sdk'],
            },
            {
              sourceTag: 'scope:server-runtime',
              onlyDependOnLibsWithTags: ['scope:core', 'scope:monitoring', 'scope:server-runtime'],
            },
            {
              sourceTag: 'scope:iam-core',
              onlyDependOnLibsWithTags: ['scope:core', 'scope:server-runtime', 'scope:iam-core'],
            },
            {
              sourceTag: 'scope:auth-runtime',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:server-runtime',
                'scope:iam-core',
                'scope:auth',
                'scope:auth-runtime',
              ],
            },
            {
              sourceTag: 'scope:iam-admin',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:server-runtime',
                'scope:data-repositories',
                'scope:iam-core',
                'scope:iam-admin',
              ],
            },
            {
              sourceTag: 'scope:iam-governance',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:server-runtime',
                'scope:data-repositories',
                'scope:iam-core',
                'scope:iam-governance',
              ],
            },
            {
              sourceTag: 'scope:instance-registry',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:server-runtime',
                'scope:data-repositories',
                'scope:iam-core',
                'scope:instance-registry',
              ],
            },
            {
              sourceTag: 'scope:auth',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:data-repositories',
                'scope:iam-admin',
                'scope:iam-core',
                'scope:instance-registry',
                'scope:server-runtime',
                'scope:auth',
              ],
            },
            {
              sourceTag: 'scope:integration',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:data-repositories',
                'scope:server-runtime',
                'scope:auth-runtime',
                'scope:integration',
              ],
            },
            {
              sourceTag: 'scope:monitoring',
              onlyDependOnLibsWithTags: ['scope:monitoring', 'scope:core'],
            },
            {
              sourceTag: 'scope:plugin',
              onlyDependOnLibsWithTags: ['scope:plugin-sdk', 'scope:plugin'],
            },
            {
              sourceTag: 'scope:routing',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:plugin-sdk',
                'scope:server-runtime',
                'scope:auth-runtime',
                'scope:monitoring',
                'scope:routing',
              ],
            },
            {
              sourceTag: 'scope:app',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:plugin-sdk',
                'scope:server-runtime',
                'scope:plugin',
                'scope:routing',
                'scope:auth-runtime',
                'scope:integration',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/sva-studio-react/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@sva/auth',
              message: 'Die App nutzt Auth nur über @sva/auth-runtime.',
            },
            {
              name: '@sva/auth/server',
              message: 'Die App nutzt Auth-Server-Funktionen nur über @sva/auth-runtime/server.',
            },
            {
              name: '@sva/data',
              message: 'Die App nutzt Datenzugriffe über Zielpackages statt @sva/data.',
            },
            {
              name: '@sva/sdk',
              message: 'Die App nutzt Core, Monitoring, Plugin-SDK oder Server-Runtime statt @sva/sdk.',
            },
          ],
          patterns: [
            {
              group: ['@sva/sdk/*'],
              message: 'Die App nutzt Zielpackages statt @sva/sdk-Subpaths.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/auth/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@sva/data',
              message: 'Auth nutzt Datenzugriffe über @sva/data-repositories oder @sva/data-client.',
            },
            {
              name: '@sva/sdk',
              message: 'Auth nutzt Core oder Server-Runtime statt @sva/sdk.',
            },
          ],
          patterns: [
            {
              group: ['@sva/sdk/*'],
              message: 'Auth nutzt Zielpackages statt @sva/sdk-Subpaths.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/routing/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@sva/auth',
              message: 'Routing darf Auth nur über @sva/auth-runtime anbinden.',
            },
            {
              name: '@sva/auth/server',
              message: 'Routing darf Auth nur über @sva/auth-runtime anbinden.',
            },
            {
              name: '@sva/auth/runtime-routes',
              message: 'Routing darf Runtime-Routen nur über @sva/auth-runtime/runtime-routes anbinden.',
            },
            {
              name: '@sva/auth/runtime-health',
              message: 'Routing darf Runtime-Health nur über @sva/auth-runtime/runtime-health anbinden.',
            },
            {
              name: '@sva/sdk',
              message: 'Routing verwendet Plugin-Verträge über @sva/plugin-sdk.',
            },
            {
              name: '@sva/sdk/admin-resources',
              message: 'Routing verwendet Admin-Resource-Verträge über @sva/plugin-sdk.',
            },
            {
              name: '@sva/sdk/server',
              message: 'Routing verwendet Server-Helfer über @sva/server-runtime.',
            },
          ],
          patterns: [
            {
              group: ['@sva/auth/*'],
              message: 'Routing darf Auth nur über @sva/auth-runtime anbinden.',
            },
            {
              group: ['@sva/sdk/*'],
              message: 'Routing verwendet Zielpackages statt @sva/sdk-Subpaths.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/server-runtime/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@sva/sdk',
              message: 'server-runtime ist die Zielgrenze und darf nicht zurück auf @sva/sdk importieren.',
            },
            {
              name: '@sva/sdk/server',
              message: 'server-runtime ist die Zielgrenze und darf nicht zurück auf @sva/sdk/server importieren.',
            },
          ],
          patterns: [
            {
              group: ['@sva/sdk/*'],
              message: 'server-runtime ist die Zielgrenze und darf nicht zurück auf @sva/sdk-Subpaths importieren.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/plugin-sdk/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@sva/sdk',
              message: 'plugin-sdk ist die Zielgrenze und darf nicht zurück auf @sva/sdk importieren.',
            },
          ],
          patterns: [
            {
              group: ['@sva/sdk/*'],
              message: 'plugin-sdk ist die Zielgrenze und darf nicht zurück auf @sva/sdk-Subpaths importieren.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/data-client/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@sva/data',
              message: 'data-client ist die Zielgrenze und darf nicht zurück auf @sva/data importieren.',
            },
            {
              name: '@sva/data/server',
              message: 'data-client darf keine Server-Repositories anbinden.',
            },
          ],
          patterns: [
            {
              group: ['@sva/data/*'],
              message: 'data-client ist die Zielgrenze und darf nicht zurück auf @sva/data-Subpaths importieren.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/data-repositories/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@sva/data',
              message: 'data-repositories ist die Zielgrenze und darf nicht zurück auf @sva/data importieren.',
            },
            {
              name: '@sva/data/server',
              message: 'data-repositories ist die Zielgrenze und darf nicht zurück auf @sva/data/server importieren.',
            },
            {
              name: '@sva/sdk/server',
              message: 'data-repositories verwendet Server-Helfer über @sva/server-runtime.',
            },
          ],
          patterns: [
            {
              group: ['@sva/data/*'],
              message: 'data-repositories ist die Zielgrenze und darf nicht zurück auf @sva/data-Subpaths importieren.',
            },
            {
              group: ['@sva/sdk/*'],
              message: 'data-repositories verwendet Zielpackages statt @sva/sdk-Subpaths.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/sva-mainserver/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@sva/auth/server',
              message: 'sva-mainserver verwendet Auth-Server-Verträge über @sva/auth-runtime/server.',
            },
            {
              name: '@sva/data/server',
              message: 'sva-mainserver verwendet Repository-Zugriffe über @sva/data-repositories/server.',
            },
            {
              name: '@sva/sdk/server',
              message: 'sva-mainserver verwendet Server-Helfer über @sva/server-runtime.',
            },
          ],
          patterns: [
            {
              group: ['@sva/data/*'],
              message: 'sva-mainserver verwendet Zielpackages statt @sva/data-Subpaths.',
            },
            {
              group: ['@sva/sdk/*'],
              message: 'sva-mainserver verwendet Zielpackages statt @sva/sdk-Subpaths.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/auth/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@sva/data/server',
              message: 'Auth verwendet Repository-Zugriffe über @sva/data-repositories/server.',
            },
            {
              name: '@sva/sdk/server',
              message: 'Auth verwendet Server-Helfer über @sva/server-runtime.',
            },
          ],
          patterns: [
            {
              group: ['@sva/data/*'],
              message: 'Auth verwendet Zielpackages statt @sva/data-Subpaths.',
            },
            {
              group: ['@sva/sdk/server/*'],
              message: 'Auth verwendet Zielpackages statt @sva/sdk/server-Subpaths.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/data/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@sva/sdk/server',
              message: 'data verwendet Server-Helfer über @sva/server-runtime.',
            },
          ],
          patterns: [
            {
              group: ['@sva/sdk/server/*'],
              message: 'data verwendet Zielpackages statt @sva/sdk/server-Subpaths.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/sva-studio-react/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@sva/auth/server',
              message: 'Die App verwendet Auth-Server-Verträge über @sva/auth-runtime/server.',
            },
            {
              name: '@sva/sdk/admin-resources',
              message: 'Die App verwendet Admin-Resource-Verträge über @sva/plugin-sdk.',
            },
            {
              name: '@sva/sdk/server',
              message: 'Die App verwendet Server-Helfer über @sva/server-runtime.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/plugin-news/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@sva/core',
              message: 'Plugins müssen über @sva/plugin-sdk auf Host-APIs zugreifen.',
            },
            {
              name: '@sva/sdk',
              message: 'Plugins müssen über @sva/plugin-sdk auf Host-APIs zugreifen.',
            },
          ],
          patterns: [
            {
              group: ['@sva/core/*'],
              message: 'Plugins müssen über @sva/plugin-sdk auf Host-APIs zugreifen.',
            },
            {
              group: ['@sva/sdk/*'],
              message: 'Plugins müssen über @sva/plugin-sdk auf Host-APIs zugreifen.',
            },
          ],
        },
      ],
    },
  },
]
