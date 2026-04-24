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
          allow: ['../../../scripts/ci/coverage-gate.ts'],
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
                'scope:sdk',
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
                'scope:data',
                'scope:data-repositories',
                'scope:sdk',
                'scope:monitoring',
                'scope:iam-core',
                'scope:server-runtime',
                'scope:auth',
              ],
            },
            {
              sourceTag: 'scope:integration',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:data',
                'scope:data-repositories',
                'scope:sdk',
                'scope:server-runtime',
                'scope:monitoring',
                'scope:auth',
                'scope:integration',
              ],
            },
            {
              sourceTag: 'scope:monitoring',
              onlyDependOnLibsWithTags: ['scope:monitoring', 'scope:sdk', 'scope:core'],
            },
            {
              sourceTag: 'scope:plugin',
              onlyDependOnLibsWithTags: ['scope:plugin-sdk', 'scope:plugin'],
            },
            {
              sourceTag: 'scope:routing',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:data',
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
                'scope:data',
                'scope:sdk',
                'scope:plugin-sdk',
                'scope:server-runtime',
                'scope:plugin',
                'scope:routing',
                'scope:auth',
                'scope:integration',
              ],
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
    files: ['apps/sva-studio-react/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
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
