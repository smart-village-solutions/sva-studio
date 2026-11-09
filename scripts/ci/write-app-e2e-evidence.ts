#!/usr/bin/env node

import {
  writeAppE2EEvidenceFromEnvironment,
  writeAppE2EShardEvidenceFromEnvironment,
} from './app-e2e-evidence.ts';

try {
  if (process.env.APP_E2E_SHARD_INDEX) {
    writeAppE2EShardEvidenceFromEnvironment();
  } else {
    writeAppE2EEvidenceFromEnvironment();
    if (process.env.APP_E2E_RESULT !== 'success') process.exitCode = 1;
  }
} catch {
  process.stdout.write(
    '::error title=APP_E2E_EVIDENCE_INVALID::Die redigierte App-E2E-Evidenz konnte nicht geschrieben werden.\n'
  );
  process.exitCode = 1;
}
