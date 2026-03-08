import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '../..');
const APP_ROOT = path.join(PROJECT_ROOT, 'apps/sva-studio-react');
const APP_SOURCE_DIR = path.join(APP_ROOT, 'src');
const APP_PACKAGE_JSON = path.join(APP_ROOT, 'package.json');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

const DISALLOWED_UI_PACKAGES = [
  '@sva/ui',
  '@sva/design-system',
  '@sva/ui-kit',
  'antd',
  '@mui/material',
  '@chakra-ui/react',
  'primereact',
  'semantic-ui-react',
  '@blueprintjs/core',
  '@mantine/core',
] as const;

const DISALLOWED_LOCAL_PATHS = [
  path.join(APP_SOURCE_DIR, 'ui-kit'),
  path.join(APP_SOURCE_DIR, 'components', 'ui-kit'),
  path.join(APP_SOURCE_DIR, 'components', 'design-system'),
] as const;

const collectSourceFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    files.push(entryPath);
  }

  return files;
};

const run = async (): Promise<void> => {
  const packageJson = JSON.parse(await readFile(APP_PACKAGE_JSON, 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const declaredDependencies = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ]);

  const blockedDependencies = DISALLOWED_UI_PACKAGES.filter((name) => declaredDependencies.has(name));

  const sourceFiles = await collectSourceFiles(APP_SOURCE_DIR);
  const blockedImports: string[] = [];

  for (const filePath of sourceFiles) {
    const sourceCode = await readFile(filePath, 'utf8');

    for (const packageName of DISALLOWED_UI_PACKAGES) {
      const directImportPattern = new RegExp(
        String.raw`(?:from\s+['\"]${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['\"]|import\s+['\"]${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['\"])`
      );

      if (directImportPattern.test(sourceCode)) {
        blockedImports.push(`${path.relative(PROJECT_ROOT, filePath)} -> ${packageName}`);
      }
    }
  }

  const blockedLocalPaths: string[] = [];
  for (const folderPath of DISALLOWED_LOCAL_PATHS) {
    try {
      const fileStat = await stat(folderPath);
      if (fileStat.isDirectory()) {
        blockedLocalPaths.push(path.relative(PROJECT_ROOT, folderPath));
      }
    } catch {
      // directory does not exist, which is the expected state
    }
  }

  if (blockedDependencies.length > 0 || blockedImports.length > 0 || blockedLocalPaths.length > 0) {
    console.error('Account-UI-Foundation-Check fehlgeschlagen.');

    if (blockedDependencies.length > 0) {
      console.error('\nNicht erlaubte UI-Abhaengigkeiten in package.json:');
      for (const dependency of blockedDependencies) {
        console.error(`- ${dependency}`);
      }
    }

    if (blockedImports.length > 0) {
      console.error('\nNicht erlaubte UI-Importe im Quellcode:');
      for (const blockedImport of blockedImports) {
        console.error(`- ${blockedImport}`);
      }
    }

    if (blockedLocalPaths.length > 0) {
      console.error('\nNicht erlaubte lokale UI-Bibliotheksordner:');
      for (const folder of blockedLocalPaths) {
        console.error(`- ${folder}`);
      }
    }

    process.exit(1);
  }

  console.info('Account-UI-Foundation-Check erfolgreich (keine parallele UI-Bibliothek erkannt).');
};

void run().catch((error: unknown) => {
  console.error('Account-UI-Foundation-Check fehlgeschlagen (unerwarteter Fehler).');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
