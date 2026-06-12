import { pathToFileURL } from 'node:url';

import { executeStudioInstanceAudit } from './studio-instance-audit/run.ts';

type Logger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

export const runStudioInstanceAuditCli = async (
  argv: readonly string[],
  deps: {
    executeAudit?: typeof executeStudioInstanceAudit;
    logger?: Logger;
  } = {},
): Promise<number> => {
  const executeAudit = deps.executeAudit ?? executeStudioInstanceAudit;
  const logger = deps.logger ?? console;

  const audit = await executeAudit(argv);
  logger.info('Studio instance audit completed', {
    output_path: audit.outputPath,
    status: audit.result.status,
  });

  return audit.result.status === 'fail' ? 2 : 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runStudioInstanceAuditCli(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
