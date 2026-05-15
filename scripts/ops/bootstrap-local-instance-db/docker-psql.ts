import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type ShellRunner = (commandName: string, args: readonly string[], input?: string) => string;

export type DockerPsql = (container: string, dbUser: string, dbName: string, sql: string) => string;

export type DockerPsqlQuiet = (container: string, dbUser: string, dbName: string, sql: string) => string;

const rootDir = resolve(fileURLToPath(new URL('../../..', import.meta.url)));

export const sqlLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`;
export const sqlIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

export const run: ShellRunner = (commandName, args, input) => {
  const result = spawnSync(commandName, args, {
    cwd: rootDir,
    encoding: 'utf8',
    input,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `${commandName} ${args.join(' ')} failed`);
  }

  return result.stdout;
};

export const dockerPsql: DockerPsql = (container, dbUser, dbName, sql) =>
  run('docker', ['exec', '-i', container, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', dbUser, '-d', dbName, '-c', sql]);

export const dockerPsqlQuiet: DockerPsqlQuiet = (container, dbUser, dbName, sql) =>
  run(
    'docker',
    ['exec', '-i', container, 'psql', '-v', 'ON_ERROR_STOP=1', '-At', '-F', '\t', '-U', dbUser, '-d', dbName, '-c', sql]
  ).trim();
