#!/usr/bin/env node

import {
  DEFAULT_CLIENT_IDS,
  parseArgs,
  loadEnvFiles,
  loadKeyringEnvFiles,
  readList,
  requireValue,
  trimTrailingSlash,
} from './keycloak-client-secret-inventory.args.mjs';

import { getAdminToken, inspectClient } from './keycloak-client-secret-inventory.http.mjs';

import {
  usage,
  printInventory,
  printSyncSummary,
} from './keycloak-client-secret-inventory.output.mjs';

import { syncClientSecrets } from './keycloak-client-secret-inventory.sync.mjs';

const validateOutputOptions = (args) => {
  const reveal = args.reveal === true;
  if (reveal && process.env.SVA_ALLOW_SECRET_OUTPUT !== '1') {
    throw new Error('--reveal verweigert: SVA_ALLOW_SECRET_OUTPUT=1 muss bewusst gesetzt sein.');
  }
  if (args.markdown && !reveal) {
    throw new Error('--markdown gibt Secret-Werte aus und erfordert deshalb zusaetzlich --reveal.');
  }
  if (args['sync-db'] && reveal) {
    throw new Error('--sync-db darf nicht mit --reveal kombiniert werden.');
  }

  return reveal;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  loadEnvFiles(args['load-env-file'] ?? args['env-file']);
  loadKeyringEnvFiles(args['keyring-env-file']);

  const reveal = validateOutputOptions(args);

  const baseUrl = trimTrailingSlash(
    requireValue(args['base-url'] ?? process.env.KEYCLOAK_ADMIN_BASE_URL, 'KEYCLOAK_ADMIN_BASE_URL')
  );
  const adminRealm = requireValue(
    args['admin-realm'] ?? process.env.KEYCLOAK_ADMIN_REALM,
    'KEYCLOAK_ADMIN_REALM'
  );
  const adminClientId = requireValue(
    args['admin-client-id'] ?? process.env.KEYCLOAK_ADMIN_CLIENT_ID,
    'KEYCLOAK_ADMIN_CLIENT_ID'
  );
  const adminClientSecret = requireValue(
    args['admin-client-secret'] ?? process.env.KEYCLOAK_ADMIN_CLIENT_SECRET,
    'KEYCLOAK_ADMIN_CLIENT_SECRET'
  );
  const realms = readList(args.realms ?? process.env.SVA_ALLOWED_INSTANCE_IDS);
  const clientIds = readList(args.clients).length > 0 ? readList(args.clients) : DEFAULT_CLIENT_IDS;

  if (realms.length === 0) {
    throw new Error(
      '--realms oder SVA_ALLOWED_INSTANCE_IDS muss mindestens einen Realm enthalten.'
    );
  }

  const token = await getAdminToken({ adminClientId, adminClientSecret, adminRealm, baseUrl });
  const rows = [];
  for (const realm of realms) {
    for (const clientId of clientIds) {
      rows.push(
        await inspectClient({
          baseUrl,
          clientId,
          realm,
          reveal: reveal || Boolean(args['sync-db']),
          token,
        })
      );
    }
  }

  if (args['sync-db']) {
    printSyncSummary(syncClientSecrets(rows, args['realm-instance-map']));
    return;
  }

  printInventory(rows, args, reveal);
};

main().catch((error) => {
  console.error(
    `[keycloak-client-secret-inventory] ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
