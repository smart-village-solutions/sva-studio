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
              sourceTag: 'scope:sdk',
              onlyDependOnLibsWithTags: ['scope:core', 'scope:data', 'scope:sdk', 'scope:monitoring'],
            },
            {
              sourceTag: 'scope:plugin',
              onlyDependOnLibsWithTags: ['scope:core', 'scope:plugin'],
            },
            {
              sourceTag: 'scope:app',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:data',
                'scope:sdk',
                'scope:plugin',
                'scope:routing',
              ],
            },
          ],
        },
      ],
    },
  },
]
