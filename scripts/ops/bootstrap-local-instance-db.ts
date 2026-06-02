import { pathToFileURL } from 'node:url';

import {
  bootstrapAppUser,
  importSchema,
  recreateDatabase,
} from './bootstrap-local-instance-db/database-bootstrap.js';
import { dockerPsql, dockerPsqlQuiet, run } from './bootstrap-local-instance-db/docker-psql.js';
import { syncCatalog } from './bootstrap-local-instance-db/catalog-sync.js';
import { syncKeycloakUsers } from './bootstrap-local-instance-db/keycloak-sync.js';
import { logStep } from './bootstrap-local-instance-db/logging.js';
import {
  BootstrapLocalInstanceDbCliError,
  parseBootstrapLocalInstanceDbArgs,
  renderUsage,
  type CliOptions,
} from './bootstrap-local-instance-db/parse-options.js';
import { summarizeTargetState } from './bootstrap-local-instance-db/summary.js';

type RunBootstrapLocalInstanceDbDeps = {
  readonly dockerPsqlImpl?: typeof dockerPsql;
  readonly dockerPsqlQuietImpl?: typeof dockerPsqlQuiet;
  readonly fetchImpl?: typeof fetch;
  readonly logStepImpl?: typeof logStep;
  readonly runImpl?: typeof run;
  readonly write?: (chunk: string) => void;
};

export const buildBootstrapLocalInstanceDbApprovalToken = (targetInstanceId: string) =>
  `bootstrap-local-instance-db:${targetInstanceId}`;

export const assertBootstrapLocalInstanceDbApproved = (
  options: Pick<CliOptions, 'approvalToken' | 'targetInstanceId'>,
): void => {
  const expectedApprovalToken = buildBootstrapLocalInstanceDbApprovalToken(options.targetInstanceId);
  if (options.approvalToken?.trim() === expectedApprovalToken) {
    return;
  }

  throw new Error(
    `Lokaler Instanz-DB-Bootstrap bleibt als gefaehrlicher Pfad gesperrt. Erneut mit --approve-dangerous=${expectedApprovalToken} ausfuehren.`,
  );
};

export const runBootstrapLocalInstanceDb = async (
  argv: readonly string[],
  deps: RunBootstrapLocalInstanceDbDeps = {}
): Promise<number> => {
  let options: CliOptions;
  try {
    options = parseBootstrapLocalInstanceDbArgs(argv);
  } catch (error) {
    if (error instanceof BootstrapLocalInstanceDbCliError && error.code === 'MISSING_REQUIRED_OPTION') {
      process.stderr.write(`${error.message}\n`);
      process.stderr.write(renderUsage());
      return 2;
    }

    throw error;
  }

  const runImpl = deps.runImpl ?? run;
  const dockerPsqlImpl = deps.dockerPsqlImpl ?? dockerPsql;
  const dockerPsqlQuietImpl = deps.dockerPsqlQuietImpl ?? dockerPsqlQuiet;
  const logStepImpl = deps.logStepImpl ?? logStep;
  const write = deps.write ?? ((chunk: string) => process.stdout.write(chunk));

  assertBootstrapLocalInstanceDbApproved(options);

  if (options.createDb) {
    recreateDatabase(options, runImpl, logStepImpl);
  }

  if (options.importSchema) {
    importSchema(options, runImpl, logStepImpl);
  }

  if (!options.skipAppUserBootstrap) {
    bootstrapAppUser(options, dockerPsqlImpl, logStepImpl);
  }

  if (!options.skipCatalogSync) {
    syncCatalog(options, {
      dockerPsqlQuiet: dockerPsqlQuietImpl,
      logStep: logStepImpl,
      run: runImpl,
    });
  }

  if (!options.skipKeycloakUserSync) {
    await syncKeycloakUsers(options, {
      fetchImpl: deps.fetchImpl,
      logStep: logStepImpl,
      run: runImpl,
    });
  }

  summarizeTargetState(options, dockerPsqlQuietImpl, write);
  write('\nFertig. Nächste Schritte: Runtime-Datei setzen, App neu starten und `pnpm env:doctor:<profil>` ausführen.\n');
  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runBootstrapLocalInstanceDb(process.argv.slice(2));
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
