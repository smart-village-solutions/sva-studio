#!/usr/bin/env node

import { classify } from './ci-poll-decide.classification.mjs';
import { buildOutput } from './ci-poll-decide.output.mjs';
import { computeNoProgressCount } from './ci-poll-decide.state.mjs';

/**
 * CI Poll Decision Script
 *
 * Deterministic decision engine for CI monitoring.
 * Takes ci_information JSON + state args, outputs a single JSON action line.
 *
 * Architecture:
 *   classify()    — pure decision tree, returns { action, code, extra? }
 *   buildOutput() — maps classification to full output with messages, delays, counters
 *
 * Usage:
 *   node ci-poll-decide.mjs '<ci_info_json>' <poll_count> <verbosity> \
 *     [--wait-mode] [--prev-cipe-url <url>] [--expected-sha <sha>] \
 *     [--prev-status <status>] [--timeout <minutes>] [--new-cipe-timeout <minutes>] \
 *     [--elapsed-seconds <n>] [--env-rerun-count <n>] [--no-progress-count <n>] \
 *     [--prev-cipe-status <status>] [--prev-sh-status <status>] \
 *     [--prev-verification-status <status>] [--prev-failure-classification <status>]
 *
 * Note: --timeout and --new-cipe-timeout are accepted in MINUTES (matching the
 * skill's documented flags) and converted to seconds internally. --elapsed-seconds
 * is the wall-clock time since monitoring began, carried across attempts by the
 * orchestrator, and is the authoritative signal for the --timeout budget.
 */

// --- Arg parsing ---

const args = process.argv.slice(2);
const ciInfoJson = args[0];
const pollCount = parseInt(args[1], 10) || 0;
const verbosity = args[2] || 'medium';

function getFlag(name) {
  return args.includes(name);
}

function getArg(name) {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const waitMode = getFlag('--wait-mode');
const prevCipeUrl = getArg('--prev-cipe-url');
const expectedSha = getArg('--expected-sha');
const prevStatus = getArg('--prev-status');
// Flags are documented in minutes; convert to seconds for internal comparison.
const timeoutSeconds = parseInt(getArg('--timeout') || '0', 10) * 60;
const newCipeTimeoutSeconds = parseInt(getArg('--new-cipe-timeout') || '0', 10) * 60;
// Wall-clock seconds since monitoring began (carried across attempts); null when
// the orchestrator doesn't supply it (see isTimedOut for that fallback).
const elapsedArg = getArg('--elapsed-seconds');
const elapsedSeconds = elapsedArg !== null ? parseInt(elapsedArg, 10) : null;
const envRerunCount = parseInt(getArg('--env-rerun-count') || '0', 10);
const inputNoProgressCount = parseInt(getArg('--no-progress-count') || '0', 10);
const prevCipeStatus = getArg('--prev-cipe-status');
const prevShStatus = getArg('--prev-sh-status');
const prevVerificationStatus = getArg('--prev-verification-status');
const prevFailureClassification = getArg('--prev-failure-classification');

// --- Parse CI info ---

let ci;
try {
  ci = JSON.parse(ciInfoJson);
} catch {
  console.log(
    JSON.stringify({
      action: 'done',
      code: 'error',
      message: 'Failed to parse ci_information JSON',
      noProgressCount: inputNoProgressCount + 1,
      envRerunCount,
    })
  );
  process.exit(0);
}

const {
  cipeStatus,
  selfHealingStatus,
  verificationStatus,
  selfHealingEnabled,
  selfHealingSkippedReason,
  failureClassification: rawFailureClassification,
  failedTaskIds = [],
  verifiedTaskIds = [],
  couldAutoApplyTasks,
  autoApplySkipped,
  autoApplySkipReason,
  userAction,
  cipeUrl,
  commitSha,
} = ci;

const failureClassification = rawFailureClassification?.toLowerCase() ?? null;

const context = {
  cipeStatus,
  selfHealingStatus,
  verificationStatus,
  selfHealingEnabled,
  selfHealingSkippedReason,
  failureClassification,
  failedTaskIds,
  verifiedTaskIds,
  couldAutoApplyTasks,
  autoApplySkipped,
  autoApplySkipReason,
  userAction,
  cipeUrl,
  commitSha,
  waitMode,
  prevCipeUrl,
  expectedSha,
  prevStatus,
  timeoutSeconds,
  newCipeTimeoutSeconds,
  elapsedSeconds,
  envRerunCount,
  inputNoProgressCount,
  prevCipeStatus,
  prevShStatus,
  prevVerificationStatus,
  prevFailureClassification,
  pollCount,
  verbosity,
};

// --- Helpers ---

// --- Run ---

// Compute noProgressCount from input. Single assignment, no mutation.
// Wait mode: reset on new cipe, otherwise unchanged (wait doesn't count as no-progress).
// Normal mode: reset on any state change, otherwise increment.
const noProgressCount = computeNoProgressCount(context);

console.log(
  JSON.stringify(buildOutput(classify(context, noProgressCount), context, noProgressCount))
);
