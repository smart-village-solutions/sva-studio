#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

import { writePromoteEvidenceFromEnvironment } from './promote-evidence.ts';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    writePromoteEvidenceFromEnvironment();
  } catch {
    process.stdout.write(
      '::error title=PROMOTE_INTERNAL_ERROR::Die redigierte Promote-Evidenz konnte nicht geschrieben werden. Runner-Logs mit eingeschränktem Zugriff prüfen.\n'
    );
    process.exitCode = 1;
  }
}
