import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { FileComplexityMetrics } from './complexity-policy.ts';

export function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function computeLineCount(sourceFile: ts.SourceFile): number {
  const lineAndCharacter = sourceFile.getLineAndCharacterOfPosition(sourceFile.getEnd());
  return lineAndCharacter.line + 1;
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node)
    ? (ts
        .getModifiers(node)
        ?.some(
          (modifier) =>
            modifier.kind === ts.SyntaxKind.ExportKeyword ||
            modifier.kind === ts.SyntaxKind.DefaultKeyword
        ) ?? false)
    : false;
}

function countPublicExports(sourceFile: ts.SourceFile): number {
  let exportCount = 0;

  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      exportCount += 1;
      continue;
    }

    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause) {
        exportCount += 1;
        continue;
      }

      if (ts.isNamedExports(statement.exportClause)) {
        exportCount += statement.exportClause.elements.length;
      }
      continue;
    }

    if (!hasExportModifier(statement)) {
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      exportCount += statement.declarationList.declarations.length;
      continue;
    }

    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      exportCount += 1;
    }
  }

  return exportCount;
}

function findFunctionName(node: ts.FunctionLikeDeclarationBase): string {
  if ('name' in node && node.name && ts.isIdentifier(node.name)) {
    return node.name.text;
  }

  if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
    return node.name.getText();
  }

  if (ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
    return node.name.getText();
  }

  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }

  if (parent && ts.isPropertyAssignment(parent)) {
    return parent.name.getText();
  }

  return '<anonymous>';
}

function computeFunctionLines(
  sourceFile: ts.SourceFile,
  node: ts.FunctionLikeDeclarationBase
): number {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
  return end - start + 1;
}

function hasFunctionBody(
  node: ts.Node
): node is ts.FunctionLikeDeclarationBase & { body: ts.FunctionBody } {
  return 'body' in node && node.body !== undefined;
}

function computeCyclomaticComplexity(
  node: ts.FunctionLikeDeclarationBase & { body: ts.FunctionBody }
): number {
  let complexity = 1;

  const visit = (current: ts.Node): void => {
    switch (current.kind) {
      case ts.SyntaxKind.IfStatement:
      case ts.SyntaxKind.ConditionalExpression:
      case ts.SyntaxKind.CaseClause:
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.CatchClause:
        complexity += 1;
        break;
      case ts.SyntaxKind.BinaryExpression: {
        const expression = current as ts.BinaryExpression;
        if (
          expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          expression.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
        ) {
          complexity += 1;
        }
        break;
      }
      default:
        break;
    }

    ts.forEachChild(current, visit);
  };

  if (node.body) {
    visit(node.body);
  }

  return complexity;
}

export function analyzeFile(absolutePath: string, relativePath: string): FileComplexityMetrics {
  const sourceText = fs.readFileSync(absolutePath, 'utf8');
  const sourceFile = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true);

  let maxFunctionLines = 0;
  let maxFunctionName = '<none>';
  let maxCyclomaticComplexity = 0;
  let maxComplexityFunctionName = '<none>';

  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node) && hasFunctionBody(node)) {
      const functionLines = computeFunctionLines(sourceFile, node);
      const functionName = findFunctionName(node);
      if (functionLines > maxFunctionLines) {
        maxFunctionLines = functionLines;
        maxFunctionName = functionName;
      }

      const cyclomaticComplexity = computeCyclomaticComplexity(node);
      if (cyclomaticComplexity > maxCyclomaticComplexity) {
        maxCyclomaticComplexity = cyclomaticComplexity;
        maxComplexityFunctionName = functionName;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return {
    filePath: normalizePath(relativePath),
    fileLines: computeLineCount(sourceFile),
    maxFunctionLines,
    maxFunctionName,
    maxCyclomaticComplexity,
    maxComplexityFunctionName,
    publicExports: countPublicExports(sourceFile),
  };
}
