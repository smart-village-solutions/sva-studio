import { withInstanceScopedDb } from '../iam-account-management/shared.js';

type InstanceScopedClient = Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0];

export const lockMainserverDataProviderBindingScope = async (
  client: InstanceScopedClient,
  input: Readonly<{
    instanceId: string;
    principalType: string;
    principalId: string;
    credentialFingerprint: string;
    dataProviderId: string;
  }>
): Promise<void> => {
  await client.query(
    `
WITH credential_lock AS MATERIALIZED (
  SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))
)
SELECT pg_advisory_xact_lock(hashtext($1), hashtext($3))
FROM credential_lock;
`,
    [
      input.instanceId,
      `mainserver-principal-credential:${input.principalType}:${input.principalId}:${input.credentialFingerprint}`,
      `mainserver-data-provider:${input.dataProviderId}`,
    ]
  );
};
