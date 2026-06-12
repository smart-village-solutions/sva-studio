import { runQuantumExec } from '../runtime/process.ts';
import type { StudioAuditRuntime } from './runtime.ts';

type QueryJsonRow = Record<string, unknown>;

const shellEscape = (value: string) => `'${value.replaceAll("'", `'\"'\"'`)}'`;
export const sqlLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;

const stripTrailingSemicolon = (sql: string) => sql.trim().replace(/;+\s*$/u, '');

const getConfiguredStackName = (env: NodeJS.ProcessEnv) => {
  const stackName = env.SVA_STACK_NAME?.trim();
  if (!stackName) {
    throw new Error('SVA_STACK_NAME fehlt für das Remote-Instanz-Audit.');
  }

  return stackName;
};

const getConfiguredQuantumEndpoint = (env: NodeJS.ProcessEnv) => {
  const endpoint = env.QUANTUM_ENDPOINT?.trim() || env.PORTAINER_ENDPOINT?.trim();
  if (!endpoint) {
    throw new Error('QUANTUM_ENDPOINT fehlt für das Remote-Instanz-Audit.');
  }

  return endpoint;
};

const wrapJsonRowsSql = (sql: string) => {
  const normalizedSql = stripTrailingSemicolon(sql);
  return `
SELECT COALESCE(json_agg(row_to_json(audit_row)), '[]'::json)::text
FROM (
${normalizedSql}
) AS audit_row;
`;
};

const runRemoteSql = (runtime: StudioAuditRuntime, sql: string) => {
  const postgresUser = runtime.env.POSTGRES_USER?.trim() || 'sva';
  const postgresDb = runtime.env.POSTGRES_DB?.trim() || 'sva_studio';
  const quantumService = runtime.env.SVA_ACCEPTANCE_POSTGRES_SERVICE?.trim() || 'postgres';
  const quantumSlot = runtime.env.SVA_ACCEPTANCE_POSTGRES_SLOT?.trim() || '1';
  const remoteScript = `psql -X -P pager=off -v ON_ERROR_STOP=1 -U ${shellEscape(postgresUser)} -d ${shellEscape(postgresDb)} -At -c ${shellEscape(sql)}`;

  return runQuantumExec(
    runtime.rootDir,
    [
      'exec',
      '--endpoint',
      getConfiguredQuantumEndpoint(runtime.env),
      '--stack',
      getConfiguredStackName(runtime.env),
      '--service',
      quantumService,
      '--slot',
      quantumSlot,
      '-c',
      `sh -lc ${shellEscape(remoteScript)}`,
    ],
    runtime.env,
    { failureMessage: 'Remote-SQL-Abfrage für das Studio-Instanz-Audit fehlgeschlagen.' },
  );
};

export const createStudioRemoteSqlClient = (runtime: StudioAuditRuntime) => {
  const queryRows = async <T extends QueryJsonRow>(sql: string): Promise<readonly T[]> => {
    const output = runRemoteSql(runtime, wrapJsonRowsSql(sql)).trim();
    if (output.length === 0) {
      throw new Error(
        'Remote-SQL lieferte keine Nutzdaten. quantum-cli exec hat aus dem nicht-interaktiven Audit-Prozess keinen lesbaren stdout-Payload geliefert.'
      );
    }

    try {
      return JSON.parse(output) as readonly T[];
    } catch (error) {
      throw new Error(
        `Remote-SQL lieferte keinen JSON-Payload. Erste Zeichen: ${output.slice(0, 160)}${output.length > 160 ? '...' : ''}`,
        { cause: error },
      );
    }
  };

  const queryOne = async <T extends QueryJsonRow>(sql: string): Promise<T | null> => {
    const rows = await queryRows<T>(sql);
    return rows[0] ?? null;
  };

  return { queryOne, queryRows };
};
