#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  buildQuantumDeployComposeDocument,
  type ComposeDocument,
} from '../ops/runtime/deploy-project.ts';

export const renderQuantumStack = (source: string): string => {
  const composeDocument = JSON.parse(source) as ComposeDocument;
  const normalized = buildQuantumDeployComposeDocument(composeDocument);
  return `${JSON.stringify({ version: '3.8', ...normalized }, null, 2)}\n`;
};

export const runRenderQuantumStack = (args: readonly string[]): number => {
  const inputIndex = args.indexOf('--input');
  const outputIndex = args.indexOf('--output');
  const inputPath = inputIndex >= 0 ? args[inputIndex + 1] : undefined;
  const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : undefined;

  if (!inputPath || !outputPath) {
    process.stderr.write('Für --input und --output ist jeweils ein Wert erforderlich.\n');
    return 2;
  }

  try {
    const rendered = renderQuantumStack(readFileSync(inputPath, 'utf8'));
    writeFileSync(outputPath, rendered, 'utf8');
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runRenderQuantumStack(process.argv.slice(2)));
}
