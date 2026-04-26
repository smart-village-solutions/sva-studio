import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

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

const DUPLICATE_BASIS_CONTROL_EXPORT_NAMES = new Set([
  'AlertDialog',
  'Alert',
  'Badge',
  'Button',
  'Checkbox',
  'DataTable',
  'Dialog',
  'Input',
  'Select',
  'Table',
  'Tabs',
  'Textarea',
]);

const APP_INTERNAL_IMPORT_PREFIX = 'apps/sva-studio-react/src/';

type PackageInfo = {
  readonly packageDir: string;
  readonly packageName: string;
};

type SourceFileBoundaryResult = {
  readonly hasAppInternalImport: boolean;
  readonly duplicateBasisControlExportName: string | null;
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

const readPluginPackages = async (projectRoot: string): Promise<PackageInfo[]> => {
  const packagesDir = path.join(projectRoot, 'packages');
  const entries = await readdir(packagesDir, { withFileTypes: true });
  const pluginPackages: PackageInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageDir = path.join(packagesDir, entry.name);
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

const hasExportModifier = (node: { readonly modifiers?: ts.NodeArray<ts.ModifierLike> }): boolean =>
  node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;

const isAppInternalModuleSpecifier = (moduleSpecifier: string): boolean => {
  const normalizedModuleSpecifier = moduleSpecifier.replaceAll('\\', '/');
  if (normalizedModuleSpecifier.startsWith(APP_INTERNAL_IMPORT_PREFIX)) {
    return true;
  }

  return normalizedModuleSpecifier.replace(/^(?:\.\.\/)+/, '').startsWith(APP_INTERNAL_IMPORT_PREFIX);
};

const getDuplicateExportName = (sourceFile: ts.SourceFile): string | null => {
  for (const statement of sourceFile.statements) {
    if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      hasExportModifier(statement) &&
      statement.name &&
      DUPLICATE_BASIS_CONTROL_EXPORT_NAMES.has(statement.name.text)
    ) {
      return statement.name.text;
    }

    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && DUPLICATE_BASIS_CONTROL_EXPORT_NAMES.has(declaration.name.text)) {
          return declaration.name.text;
        }
      }
    }

    if (ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression)) {
      const exportName = statement.expression.text;
      if (DUPLICATE_BASIS_CONTROL_EXPORT_NAMES.has(exportName)) {
        return exportName;
      }
    }

    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const exportSpecifier of statement.exportClause.elements) {
        const exportedName = exportSpecifier.name.text;
        const localName = exportSpecifier.propertyName?.text;
        const duplicateName = [exportedName, localName].find(
          (name): name is string => name !== undefined && DUPLICATE_BASIS_CONTROL_EXPORT_NAMES.has(name)
        );
        if (duplicateName) {
          return duplicateName;
        }
      }
    }
  }

  return null;
};

const hasAppInternalImport = (sourceFile: ts.SourceFile): boolean => {
  let found = false;

  const visit = (node: ts.Node): void => {
    if (found) {
      return;
    }

    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      found = isAppInternalModuleSpecifier(node.moduleSpecifier.text);
      return;
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      found = isAppInternalModuleSpecifier(node.arguments[0].text);
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
};

export const checkPluginUiBoundarySource = (filePath: string, sourceCode: string): SourceFileBoundaryResult => {
  const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return {
    hasAppInternalImport: hasAppInternalImport(sourceFile),
    duplicateBasisControlExportName: getDuplicateExportName(sourceFile),
  };
};

export const checkPluginUiBoundary = async (projectRoot = PROJECT_ROOT): Promise<readonly string[]> => {
  const pluginPackages = await readPluginPackages(projectRoot);
  const violations: string[] = [];

  for (const pluginPackage of pluginPackages) {
    const sourceDir = path.join(pluginPackage.packageDir, 'src');
    if (!(await pathExists(sourceDir))) {
      continue;
    }

    const sourceFiles = await collectSourceFiles(sourceDir);
    for (const filePath of sourceFiles) {
      const relativePath = path.relative(projectRoot, filePath);
      const sourceCode = await readFile(filePath, 'utf8');
      const fileBaseName = path.basename(filePath, path.extname(filePath)).toLowerCase();
      const boundaryResult = checkPluginUiBoundarySource(filePath, sourceCode);

      if (boundaryResult.hasAppInternalImport) {
        violations.push(`${relativePath}: importiert App-interne UI statt @sva/studio-ui-react`);
      }

      if (DUPLICATE_BASIS_CONTROL_FILE_NAMES.has(fileBaseName)) {
        violations.push(`${relativePath}: dupliziert einen Studio-Basiscontrol-Dateinamen`);
      }

      if (boundaryResult.duplicateBasisControlExportName) {
        violations.push(
          `${relativePath}: exportiert ${boundaryResult.duplicateBasisControlExportName} als lokalen Basiscontrol`
        );
      }
    }
  }

  return violations;
};

const run = async (): Promise<void> => {
  const violations = await checkPluginUiBoundary();

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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void run().catch((error: unknown) => {
    console.error('Plugin-UI-Boundary-Check fehlgeschlagen (unerwarteter Fehler).');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
