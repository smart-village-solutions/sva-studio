#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { setPublicWasteStackMaintenance } from './portainer-release.ts';

const main = async () => {
  const mode = process.env.PUBLIC_WASTE_MAINTENANCE_MODE;
  if (mode !== 'start' && mode !== 'stop')
    throw new Error('PUBLIC_WASTE_MAINTENANCE_MODE muss start oder stop sein.');
  const result = await setPublicWasteStackMaintenance({
    mode,
    ...(mode === 'start' ? { databaseUrl: process.env.PUBLIC_WASTE_POSTGRESQL_DATABASE_URL } : {}),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
