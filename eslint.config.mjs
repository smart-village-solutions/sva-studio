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
              onlyDependOnLibsWithTags: ['scope:core', 'scope:data'],
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
              onlyDependOnLibsWithTags: ['scope:core', 'scope:data', 'scope:sdk', 'scope:monitoring'],
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
              onlyDependOnLibsWithTags: ['scope:core', 'scope:server-runtime', 'scope:iam-core', 'scope:auth-runtime'],
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
              onlyDependOnLibsWithTags: ['scope:core', 'scope:data', 'scope:sdk', 'scope:monitoring', 'scope:auth'],
            },
            {
              sourceTag: 'scope:integration',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:data',
                'scope:sdk',
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
              onlyDependOnLibsWithTags: ['scope:sdk', 'scope:plugin'],
            },
            {
              sourceTag: 'scope:routing',
              onlyDependOnLibsWithTags: ['scope:core', 'scope:data', 'scope:sdk', 'scope:auth', 'scope:monitoring', 'scope:routing'],
            },
            {
              sourceTag: 'scope:app',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:data',
                'scope:sdk',
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
    files: ['packages/plugin-*/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@sva/core',
              message: 'Plugins müssen über @sva/sdk auf Host-APIs zugreifen.',
            },
          ],
          patterns: [
            {
              group: ['@sva/core/*'],
              message: 'Plugins müssen über @sva/sdk auf Host-APIs zugreifen.',
            },
          ],
        },
      ],
    },
  },
]
