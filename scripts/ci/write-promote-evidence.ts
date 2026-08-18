#!/usr/bin/env node

import { writePromoteEvidenceFromEnvironment } from './promote-evidence.ts';

try {
  writePromoteEvidenceFromEnvironment();
} catch {
  process.stdout.write(
    '::error title=PROMOTE_INTERNAL_ERROR::Die redigierte Promote-Evidenz konnte nicht geschrieben werden. Runner-Logs mit eingeschränktem Zugriff prüfen.\n'
  );
  process.exitCode = 1;
}
