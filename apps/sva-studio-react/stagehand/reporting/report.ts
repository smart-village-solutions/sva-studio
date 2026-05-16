import type { StagehandMissionName } from '../runtime/types.js';

export type StagehandMissionStatus = 'passed' | 'failed' | 'blocked';

export interface StagehandMissionReport {
  generatedAt: string;
  mission: StagehandMissionName;
  status: StagehandMissionStatus;
  findings: readonly string[];
  screenshots: readonly string[];
  transcriptPath: string;
}

function escapeMarkdownText(value: string): string {
  return value.replaceAll('`', '\\`');
}

function renderMarkdownListItem(value: string): string {
  const [firstLine, ...remainingLines] = escapeMarkdownText(value).split('\n');

  if (firstLine === undefined) {
    return '-';
  }

  if (firstLine === '' && remainingLines.length > 0) {
    return ['-', ...remainingLines.map((line) => `  ${line}`)].join('\n');
  }

  if (firstLine === '') {
    return '-';
  }

  if (remainingLines.length === 0) {
    return `- ${firstLine}`;
  }

  return [`- ${firstLine}`, ...remainingLines.map((line) => `  ${line}`)].join('\n');
}

function createCodeFence(value: string): string {
  const backtickRuns = value.match(/`+/gu) ?? [];
  const longestRun = backtickRuns.reduce((maxLength, run) => Math.max(maxLength, run.length), 0);

  return '`'.repeat(Math.max(3, longestRun + 1));
}

function renderTextCodeBlock(value: string): string {
  const fence = createCodeFence(value);

  return [fence + 'text', value, fence].join('\n');
}

function indentBlock(value: string, indent: string): string {
  return value
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n');
}

export function renderStagehandMarkdownReport(report: StagehandMissionReport): string {
  const findings =
    report.findings.length > 0 ? report.findings.map(renderMarkdownListItem).join('\n') : '- Keine';
  const screenshots =
    report.screenshots.length > 0
      ? report.screenshots
          .map((screenshot) => ['- Screenshot', indentBlock(renderTextCodeBlock(screenshot), '  ')].join('\n'))
          .join('\n')
      : '- Keine';

  return [
    '# Stagehand-Missionsbericht',
    '',
    `Erstellt am: \`${report.generatedAt}\``,
    `Mission: \`${report.mission}\``,
    `Status: \`${report.status}\``,
    'Transkript:',
    renderTextCodeBlock(report.transcriptPath),
    '',
    '## Erkenntnisse',
    findings,
    '',
    '## Screenshots',
    screenshots,
  ].join('\n');
}
