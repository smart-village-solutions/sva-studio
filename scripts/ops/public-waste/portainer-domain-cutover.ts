import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { cutoverPublicWasteStackDomain } from './portainer-release.ts';

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  cutoverPublicWasteStackDomain()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exit(1);
    });
}
