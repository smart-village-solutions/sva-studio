import type { CheckSummary, CliOptions } from './pr-review-intake.types.js';

const FAILURE_MARKERS = [
  'error',
  'fail',
  'failed',
  'traceback',
  'exception',
  'assert',
  'panic',
  'fatal',
  'timeout',
  'segmentation fault',
] as const;

export const parseCliOptions = (args: readonly string[]): CliOptions => {
  const [command, ...rest] = args;
  if (command !== 'snapshot' && command !== 'threads' && command !== 'checks') {
    throw new Error('Erwartetes Subcommand: snapshot | threads | checks');
  }

  let repo: string | undefined;
  let pullRequestNumber: number | undefined;
  let json = false;
  let maxLines = 160;
  let context = 30;

  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];

    if (argument === '--json') {
      json = true;
      continue;
    }

    if (argument === '--repo' || argument === '--pr' || argument === '--max-lines' || argument === '--context') {
      const value = rest[index + 1];
      if (!value) {
        throw new Error(`Fehlender Wert für ${argument}`);
      }

      if (argument === '--repo') {
        repo = value;
      } else {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          throw new Error(`Ungültiger Wert für ${argument}: ${value}`);
        }
        if (argument === '--pr') {
          pullRequestNumber = parsed;
        } else if (argument === '--max-lines') {
          maxLines = parsed;
        } else {
          context = parsed;
        }
      }

      index += 1;
      continue;
    }

    throw new Error(`Unbekanntes Argument: ${argument}`);
  }

  if ((repo && !pullRequestNumber) || (!repo && pullRequestNumber)) {
    throw new Error('--repo und --pr müssen gemeinsam gesetzt werden.');
  }

  return { command, json, repo, pullRequestNumber, maxLines, context };
};

export const parseAvailableFields = (message: string): string[] => {
  if (!message.includes('Available fields:')) {
    return [];
  }

  const fields: string[] = [];
  let collecting = false;

  for (const line of message.split('\n')) {
    if (line.includes('Available fields:')) {
      collecting = true;
      continue;
    }
    if (!collecting) {
      continue;
    }
    const field = line.trim();
    if (field) {
      fields.push(field);
    }
  }

  return fields;
};

export const extractRunId = (url: string): string | null => {
  if (!url) {
    return null;
  }
  for (const pattern of [/\/actions\/runs\/(\d+)/u, /\/runs\/(\d+)/u]) {
    const match = pattern.exec(url);
    if (match) {
      return match[1];
    }
  }
  return null;
};

export const extractJobId = (url: string): string | null => {
  if (!url) {
    return null;
  }
  const longMatch = /\/actions\/runs\/\d+\/job\/(\d+)/u.exec(url);
  if (longMatch) {
    return longMatch[1];
  }
  return /\/job\/(\d+)/u.exec(url)?.[1] ?? null;
};

const scoreFailureLine = (lowered: string): number => {
  if (lowered.includes('error:')) {
    return 5;
  }
  if (
    lowered.includes('traceback') ||
    lowered.includes('exception') ||
    lowered.includes('fatal') ||
    lowered.includes('segmentation fault')
  ) {
    return 4;
  }
  if (lowered.includes('assert') || lowered.includes('panic')) {
    return 3;
  }
  if (lowered.includes('failed') || lowered.includes('timeout')) {
    return 2;
  }
  return 1;
};

export const extractFailureSnippet = (logText: string, maxLines: number, context: number): string => {
  const lines = logText.split('\n');
  if (lines.length === 0) {
    return '';
  }

  let markerIndex: number | null = null;
  let bestScore = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const lowered = lines[index]?.toLowerCase() ?? '';
    if (!FAILURE_MARKERS.some((marker) => lowered.includes(marker))) {
      continue;
    }

    const score = scoreFailureLine(lowered);
    if (score > bestScore || (score === bestScore && markerIndex != null && index > markerIndex)) {
      markerIndex = index;
      bestScore = score;
    }
  }

  if (markerIndex == null) {
    return lines.slice(-maxLines).join('\n');
  }

  const start = Math.max(0, markerIndex - context);
  const end = Math.min(lines.length, markerIndex + context + 1);
  return lines.slice(start, end).slice(-maxLines).join('\n');
};

export const buildSnapshotSummary = (result: {
  reviewThreads: { open: readonly unknown[]; resolved: readonly unknown[] };
  checks: { failing: readonly CheckSummary[]; pending: readonly CheckSummary[] };
}) => {
  const openThreads = result.reviewThreads.open.length;
  const resolvedThreads = result.reviewThreads.resolved.length;
  const failingChecks = result.checks.failing.length;
  const pendingChecks = result.checks.pending.length;

  return {
    openThreads,
    resolvedThreads,
    failingChecks,
    pendingChecks,
    hasBlockers: openThreads > 0 || failingChecks > 0,
  };
};
