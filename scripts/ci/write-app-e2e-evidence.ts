#!/usr/bin/env node

import { writeAppE2EEvidenceFromEnvironment } from './app-e2e-evidence.ts';

try {
  writeAppE2EEvidenceFromEnvironment();
} catch {
  process.stdout.write(
    '::error title=APP_E2E_EVIDENCE_INVALID::Die redigierte App-E2E-Evidenz konnte nicht geschrieben werden.\n'
  );
  process.exitCode = 1;
}
