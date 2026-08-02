import { readFile } from 'node:fs/promises';

export type WasteDatabaseInventory = Readonly<{
  schema: string;
  objects: Readonly<Record<string, number>>;
  rowCounts: Readonly<Record<string, number>>;
}>;

export const parseWasteDatabaseInventory = (input: string): WasteDatabaseInventory => {
  const parsed: unknown = JSON.parse(input.trim());
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('inventory_invalid');
  }
  const candidate = parsed as Partial<WasteDatabaseInventory>;
  if (typeof candidate.schema !== 'string' || !candidate.objects || !candidate.rowCounts) {
    throw new Error('inventory_invalid');
  }
  return candidate as WasteDatabaseInventory;
};

export const compareWasteDatabaseInventories = (
  source: WasteDatabaseInventory,
  target: WasteDatabaseInventory
): readonly string[] => {
  const differences: string[] = [];
  if (source.schema !== target.schema) differences.push('schema');
  for (const key of Object.keys(source.rowCounts)) {
    if (source.rowCounts[key] !== target.rowCounts[key]) differences.push(`rowCounts.${key}`);
  }
  return differences.sort();
};

const main = async () => {
  const [sourcePath, targetPath] = process.argv.slice(2);
  if (!sourcePath || !targetPath)
    throw new Error('usage: verify-waste-postgresql-migration <source> <target>');
  const source = parseWasteDatabaseInventory(await readFile(sourcePath, 'utf8'));
  const target = parseWasteDatabaseInventory(await readFile(targetPath, 'utf8'));
  const differences = compareWasteDatabaseInventories(source, target);
  if (differences.length > 0)
    throw new Error(`waste_migration_verification_failed:${differences.join(',')}`);
  const additionalTargetTables = Object.keys(target.rowCounts)
    .filter((tableName) => !(tableName in source.rowCounts))
    .sort();
  process.stdout.write(
    `${JSON.stringify({
      status: 'ok',
      comparedTables: Object.keys(source.rowCounts).length,
      additionalTargetTables,
    })}\n`
  );
};

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
