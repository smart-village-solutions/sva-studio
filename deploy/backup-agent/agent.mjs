import { pathToFileURL } from 'node:url';
import { createBackupAgentServer } from './http-server.mjs';
import { runCapture } from './runtime-io.mjs';

export { executeBackupForIntegration } from './backup-execution.mjs';
export { executeRestoreForIntegration } from './restore-execution.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const versions = await Promise.all([
    runCapture('aws', ['--version']),
    runCapture('pg_dump', ['--version']),
    runCapture('pg_restore', ['--version']),
  ]);
  process.env.BACKUP_AGENT_TOOL_VERSIONS = JSON.stringify({
    aws: versions[0],
    pgDump: versions[1],
    pgRestore: versions[2],
  });
  createBackupAgentServer().listen(Number(process.env.BACKUP_AGENT_PORT || '3080'), '0.0.0.0');
}
