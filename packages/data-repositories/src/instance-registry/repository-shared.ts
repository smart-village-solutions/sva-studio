import type { SqlExecutionResult, SqlExecutor, SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';

export const compareAlphabetically = (left: string, right: string): number => left.localeCompare(right, 'de');

export const statement = (text: string, values: readonly SqlPrimitive[]): SqlStatement => ({ text, values });

export const queryRows = async <TRow>(executor: SqlExecutor, sql: SqlStatement): Promise<readonly TRow[]> => {
  const result: SqlExecutionResult<TRow> = await executor.execute<TRow>(sql);
  return result.rows;
};

export const quoteSqlLiteral = (value: string): string => `'${value.split("'").join("''")}'`;

export const createTextList = (values: readonly string[]): string => values.map(quoteSqlLiteral).join(', ');
