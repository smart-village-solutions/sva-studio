import * as ts from 'typescript';

export type TypeScriptImportKind = 'runtime' | 'type' | 'reexport';

export type TypeScriptImportEdge = {
  readonly importSpecifier: string;
  readonly kind: TypeScriptImportKind;
};

const getImportTypeSpecifier = (node: ts.Node): string | null => {
  if (!ts.isImportTypeNode(node) || !ts.isLiteralTypeNode(node.argument)) {
    return null;
  }

  return ts.isStringLiteral(node.argument.literal) ? node.argument.literal.text : null;
};

export const collectTypeScriptImportEdges = (
  filePath: string,
  sourceText: string
): readonly TypeScriptImportEdge[] => {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const edges: TypeScriptImportEdge[] = [];

  const visit = (node: ts.Node): void => {
    const importTypeSpecifier = getImportTypeSpecifier(node);
    if (importTypeSpecifier) {
      edges.push({
        importSpecifier: importTypeSpecifier,
        kind: 'type',
      });
      ts.forEachChild(node, visit);
      return;
    }

    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      edges.push({
        importSpecifier: node.moduleReference.expression.text,
        kind: node.isTypeOnly ? 'type' : 'runtime',
      });
      ts.forEachChild(node, visit);
      return;
    }

    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      edges.push({
        importSpecifier: node.moduleSpecifier.text,
        kind: node.importClause?.isTypeOnly ? 'type' : 'runtime',
      });
      ts.forEachChild(node, visit);
      return;
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      edges.push({
        importSpecifier: node.moduleSpecifier.text,
        kind: node.isTypeOnly ? 'type' : 'reexport',
      });
      ts.forEachChild(node, visit);
      return;
    }

    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      edges.push({
        importSpecifier: node.arguments[0].text,
        kind: 'runtime',
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return edges;
};
