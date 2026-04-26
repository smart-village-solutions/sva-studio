import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '../..');
const PACKAGES_DIR = path.join(PROJECT_ROOT, 'packages');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

const DUPLICATE_BASIS_CONTROL_FILE_NAMES = new Set([
  'alert-dialog',
  'alert',
  'badge',
  'button',
  'checkbox',
  'data-table',
  'dialog',
  'input',
  'select',
  'table',
  'tabs',
  'textarea',
]);

const DUPLICATE_BASIS_CONTROL_EXPORT_PATTERN =
  /\bexport\s+(?:const|function|class)\s+(AlertDialog|Alert|Badge|Button|Checkbox|DataTable|Dialog|Input|Select|Table|Tabs|Textarea)\b/;

const APP_INTERNAL_IMPORT_PATTERN =
  /(?:from\s+['"](?:\.\.\/){1,}apps\/sva-studio-react\/src\/|from\s+['"]apps\/sva-studio-react\/src\/|import\s+['"](?:\.\.\/){1,}apps\/sva-studio-react\/src\/|import\s+['"]apps\/sva-studio-react\/src\/)/;

type PackageInfo = {
  readonly packageDir: string;
  readonly packageName: string;
};

const pathExists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const collectSourceFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
      continue;
    }

    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    files.push(entryPath);
  }

  return files;
};

const readPluginPackages = async (): Promise<PackageInfo[]> => {
  const entries = await readdir(PACKAGES_DIR, { withFileTypes: true });
  const pluginPackages: PackageInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageDir = path.join(PACKAGES_DIR, entry.name);
    const packageJsonPath = path.join(packageDir, 'package.json');
    if (!(await pathExists(packageJsonPath))) {
      continue;
    }

    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { name?: string };
    const packageName = packageJson.name ?? '';
    if (!packageName.startsWith('@sva/plugin-') || packageName === '@sva/plugin-sdk') {
      continue;
    }

    pluginPackages.push({ packageDir, packageName });
  }

  return pluginPackages;
};

const run = async (): Promise<void> => {
  const pluginPackages = await readPluginPackages();
  const violations: string[] = [];

  for (const pluginPackage of pluginPackages) {
    const sourceDir = path.join(pluginPackage.packageDir, 'src');
    if (!(await pathExists(sourceDir))) {
      continue;
    }

    const sourceFiles = await collectSourceFiles(sourceDir);
    for (const filePath of sourceFiles) {
      const relativePath = path.relative(PROJECT_ROOT, filePath);
      const sourceCode = await readFile(filePath, 'utf8');
      const fileBaseName = path.basename(filePath, path.extname(filePath)).toLowerCase();

      if (APP_INTERNAL_IMPORT_PATTERN.test(sourceCode)) {
        violations.push(`${relativePath}: importiert App-interne UI statt @sva/studio-ui-react`);
      }

      if (DUPLICATE_BASIS_CONTROL_FILE_NAMES.has(fileBaseName)) {
        violations.push(`${relativePath}: dupliziert einen Studio-Basiscontrol-Dateinamen`);
      }

      const duplicateExport = DUPLICATE_BASIS_CONTROL_EXPORT_PATTERN.exec(sourceCode);
      if (duplicateExport) {
        violations.push(`${relativePath}: exportiert ${duplicateExport[1]} als lokalen Basiscontrol`);
      }
    }
  }

  if (violations.length > 0) {
    console.error('Plugin-UI-Boundary-Check fehlgeschlagen.');
    console.error('\nPlugins muessen gemeinsame Basiscontrols aus @sva/studio-ui-react komponieren.');
    console.error('Fachspezifische Wrapper sind erlaubt, duerfen aber keine Button/Input/Table/Dialog-Basis neu definieren.\n');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.info('Plugin-UI-Boundary-Check erfolgreich (keine App-UI-Imports oder Basiscontrol-Duplikate erkannt).');
};

void run().catch((error: unknown) => {
  console.error('Plugin-UI-Boundary-Check fehlgeschlagen (unerwarteter Fehler).');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
