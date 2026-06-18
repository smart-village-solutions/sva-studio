#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

import { createGhExecutor, ensureGhAuthenticated, fetchPullRequestSummary, resolvePullRequestRef } from './pr-review-intake.gh.js';
import { fetchChecks } from './pr-review-intake.checks.js';
import { fetchReviewThreads } from './pr-review-intake.threads.js';
import type { GhExecutor, IntakeSubcommand, SnapshotResult } from './pr-review-intake.types.js';
import { buildSnapshotSummary, parseCliOptions } from './pr-review-intake.utils.js';

const collectSnapshot = (
  options: ReturnType<typeof parseCliOptions>,
  executor: GhExecutor
): SnapshotResult => {
  const ref = resolvePullRequestRef(options, executor);
  const pr = fetchPullRequestSummary(ref, executor);
  const reviewThreads = fetchReviewThreads(ref, executor);
  const checks = fetchChecks(ref, executor, options);

  return {
    pr,
    reviewThreads,
    checks,
    summary: buildSnapshotSummary({ reviewThreads, checks }),
    sources: {
      pullRequest: ref.source === 'explicit' ? 'explicit repo/pr parameters' : 'current branch PR via gh pr view',
      reviewThreads: 'gh api graphql reviewThreads',
      checks: 'gh pr checks + gh run view/gh api job logs',
    },
  };
};

const projectResult = (command: IntakeSubcommand, snapshot: SnapshotResult): unknown => {
  if (command === 'threads') {
    return {
      pr: snapshot.pr,
      reviewThreads: snapshot.reviewThreads,
      summary: {
        openThreads: snapshot.summary.openThreads,
        resolvedThreads: snapshot.summary.resolvedThreads,
        hasBlockers: snapshot.summary.openThreads > 0,
      },
      sources: {
        pullRequest: snapshot.sources.pullRequest,
        reviewThreads: snapshot.sources.reviewThreads,
      },
    };
  }

  if (command === 'checks') {
    return {
      pr: snapshot.pr,
      checks: snapshot.checks,
      summary: {
        failingChecks: snapshot.summary.failingChecks,
        pendingChecks: snapshot.summary.pendingChecks,
        hasBlockers: snapshot.summary.failingChecks > 0,
      },
      sources: {
        pullRequest: snapshot.sources.pullRequest,
        checks: snapshot.sources.checks,
      },
    };
  }

  return snapshot;
};

const renderPlainText = (command: IntakeSubcommand, result: SnapshotResult): string => {
  const lines = [`PR #${result.pr.number}: ${result.pr.title}`];
  lines.push(`Quelle: ${result.pr.source === 'explicit' ? 'explizites repo/pr' : 'aktueller Branch-PR'}`);

  if (command !== 'checks') {
    lines.push(`Offene Review-Threads: ${result.reviewThreads.open.length}`);
    lines.push(`Resolved Review-Threads: ${result.reviewThreads.resolved.length}`);
    if (result.reviewThreads.open.length > 0) {
      lines.push('Offene Threads:');
      lines.push(
        ...result.reviewThreads.open.map((thread) =>
          `- ${thread.line ? `${thread.path}:${thread.line}` : thread.path} (${thread.commentCount} Kommentare) ${thread.url}`
        )
      );
    }
  }

  if (command !== 'threads') {
    lines.push(`Failing Checks: ${result.checks.failing.length}`);
    lines.push(`Pending Checks: ${result.checks.pending.length}`);
    if (result.checks.failing.length > 0) {
      lines.push('Failing Checks:');
      lines.push(
        ...result.checks.failing.map((check) => {
          const detail = check.logSnippet ? check.logSnippet.split('\n')[0] : check.note ?? check.error ?? 'kein Detail';
          return `- ${check.name} [${check.analysisStatus}] ${detail}`;
        })
      );
    }
    if (result.checks.pending.length > 0) {
      lines.push('Pending Checks:');
      lines.push(...result.checks.pending.map((check) => `- ${check.name} [pending] ${check.detailsUrl || check.note || ''}`.trimEnd()));
    }
  }

  return lines.join('\n');
};

export const executePrReviewIntake = (
  args: readonly string[],
  dependencies?: { executor?: GhExecutor }
): { exitCode: number; stdout: string; stderr: string } => {
  try {
    const options = parseCliOptions(args);
    const executor = dependencies?.executor ?? createGhExecutor();
    ensureGhAuthenticated(executor);

    const snapshot = collectSnapshot(options, executor);
    const stdout = options.json
      ? JSON.stringify(projectResult(options.command, snapshot), null, 2)
      : renderPlainText(options.command, snapshot);

    if (options.command === 'threads') {
      return { exitCode: snapshot.reviewThreads.open.length > 0 ? 1 : 0, stdout, stderr: '' };
    }
    if (options.command === 'checks') {
      return { exitCode: snapshot.checks.failing.length > 0 ? 1 : 0, stdout, stderr: '' };
    }

    return { exitCode: snapshot.summary.hasBlockers ? 1 : 0, stdout, stderr: '' };
  } catch (error) {
    return { exitCode: 2, stdout: '', stderr: error instanceof Error ? error.message : String(error) };
  }
};

export const runPrReviewIntake = (args: readonly string[], dependencies?: { executor?: GhExecutor }): number => {
  const result = executePrReviewIntake(args, dependencies);
  if (result.stdout) {
    process.stdout.write(`${result.stdout}\n`);
  }
  if (result.stderr) {
    process.stderr.write(`${result.stderr}\n`);
  }
  return result.exitCode;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runPrReviewIntake(process.argv.slice(2)));
}
