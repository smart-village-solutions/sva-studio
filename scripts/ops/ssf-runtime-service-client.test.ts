import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(fileURLToPath(new URL('.', import.meta.url)), 'ssf-runtime-service-client.sh'),
  'utf8'
);

describe('SSF runtime service client operator', () => {
  it('pins the least-privilege V1 identity contract', () => {
    expect(source).toContain("readonly CLIENT_ID='ssf-runtime'");
    expect(source).toContain("readonly AUDIENCE='sva-studio-ssf-runtime'");
    expect(source).toContain("readonly ACTION='ssf.runtime-configuration.read'");
    expect(source).toContain('serviceAccountsEnabled:true');
    expect(source).toContain('standardFlowEnabled:false');
    expect(source).toContain('directAccessGrantsEnabled:false');
    expect(source).toContain('fullScopeAllowed:false');
    expect(source).toContain('.clientAuthenticatorType == "client-secret"');
    expect(source).toContain("jq -e '.composite == false'");
  });

  it('never prints the generated secret and writes it with restrictive permissions', () => {
    expect(source).toContain("jq -er '.value' >\"$secret_file\"");
    expect(source).toContain('chmod 600 "$secret_file"');
    expect(source).toContain('chmod 600 "$output"');
    expect(source).toContain('must not be a symlink or directory');
    expect(source).not.toContain('printf \'%s\\n\' "$secret"');
  });

  it('supports idempotent reconciliation, verification, and explicit rotation', () => {
    expect(source).toContain('<reconcile|verify|rotate-secret>');
    expect(source).toContain('ensure_client_contract "$client_uuid"');
    expect(source).toContain('ensure_action_role "$client_uuid"');
    expect(source).toContain('ensure_audience_mapper "$client_uuid"');
    expect(source).toContain('ensure_service_account_role "$client_uuid"');
    expect(source).toContain('ensure_action_scope "$client_uuid"');
    expect(source).toContain('verify_contract "$client_uuid"');
    expect(source).toContain("'length == 1 and .[0].id == $role_id'");
  });
});
