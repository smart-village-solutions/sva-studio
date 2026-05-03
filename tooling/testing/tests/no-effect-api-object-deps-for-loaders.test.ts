import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @nx/enforce-module-boundaries
import noEffectApiObjectDepsForLoadersRule from '../../../config/eslint/no-effect-api-object-deps-for-loaders.mjs';

const lint = async (code: string) => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.tsx'],
        plugins: {
          local: {
            rules: {
              'no-effect-api-object-deps-for-loaders': noEffectApiObjectDepsForLoadersRule,
            },
          },
        },
        languageOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
        rules: {
          'local/no-effect-api-object-deps-for-loaders': 'error',
        },
      },
    ],
  });

  return eslint.lintText(code, {
    filePath: 'apps/sva-studio-react/src/example.tsx',
  });
};

describe('no-effect-api-object-deps-for-loaders', () => {
  it('reports whole api objects in effect dependencies when the effect triggers a loader request on that api', async () => {
    const [result] = await lint(`
      import React from 'react';

      export const Example = ({ organizationId }) => {
        const organizationsApi = useOrganizations();

        React.useEffect(() => {
          void organizationsApi.loadOrganization(organizationId);
        }, [organizationId, organizationsApi]);
      };
    `);

    expect(result.errorCount).toBe(1);
    expect(result.messages[0]?.ruleId).toBe('local/no-effect-api-object-deps-for-loaders');
    expect(result.messages[0]?.message).toContain('organizationsApi');
  });

  it('allows depending on the specific loader callback instead of the whole api object', async () => {
    const [result] = await lint(`
      import React from 'react';

      export const Example = ({ organizationId }) => {
        const organizationsApi = useOrganizations();
        const { loadOrganization } = organizationsApi;

        React.useEffect(() => {
          void loadOrganization(organizationId);
        }, [loadOrganization, organizationId]);
      };
    `);

    expect(result.messages).toEqual([]);
  });

  it('allows property-level dependencies on the api object', async () => {
    const [result] = await lint(`
      import React from 'react';

      export const Example = ({ groupId, groupsApi }) => {
        React.useEffect(() => {
          void groupsApi.loadGroupDetail(groupId);
        }, [groupId, groupsApi.groups, groupsApi.loadGroupDetail]);
      };
    `);

    expect(result.messages).toEqual([]);
  });
});
