import { backoff } from './ci-poll-decide.state.mjs';

// Message templates keyed by status or key
const messages = {
  // wait mode
  new_cipe_detected: ({ cipeStatus }) => `New CI Attempt detected! CI: ${cipeStatus || 'N/A'}`,
  no_new_cipe: () => 'New CI Attempt timeout exceeded. No new CI Attempt detected.',
  waiting_for_cipe: () => 'Waiting for new CI Attempt...',

  // guards
  polling_timeout: () => 'Polling timeout exceeded.',
  circuit_breaker: () => 'No progress after 13 consecutive polls. Stopping.',

  // terminal
  ci_success: () => 'CI passed successfully!',
  cipe_canceled: () => 'CI Attempt was canceled.',
  cipe_timed_out: () => 'CI Attempt timed out.',
  cipe_no_tasks: () => 'CI failed but no Nx tasks were recorded.',

  // environment
  environment_rerun_cap: () => 'Environment rerun cap (2) exceeded. Bailing.',
  environment_issue: () => 'CI: FAILED | Classification: ENVIRONMENT_STATE',

  // throttled
  self_healing_throttled: () => 'Self-healing throttled \u2014 too many unapplied fixes.',

  // polling
  ci_running: ({ cipeStatus }) => `CI: ${cipeStatus}`,
  sh_running: ({ cipeStatus, selfHealingStatus }) =>
    `CI: ${cipeStatus} | Self-healing: ${selfHealingStatus}`,
  flaky_rerun: () => 'CI: FAILED | Classification: FLAKY_TASK (auto-rerun in progress)',
  fix_auto_applied: () => 'CI: FAILED | Fix auto-applied, new CI Attempt spawning',
  verification_pending: ({ verificationStatus }) =>
    `CI: FAILED | Self-healing: COMPLETED | Verification: ${verificationStatus}`,

  // actionable
  fix_auto_applying: () => 'Fix verified! Auto-applying...',
  fix_auto_apply_skipped: (_context, extra) =>
    `Fix verified but auto-apply was skipped. ${
      extra?.autoApplySkipReason
        ? `Reason: ${extra.autoApplySkipReason}`
        : 'Offer to apply manually.'
    }`,
  fix_needs_review: ({ verificationStatus }) =>
    `Fix available but needs review. Verification: ${verificationStatus || 'N/A'}`,
  fix_apply_ready: () => 'Fix available and verified. Ready to apply.',
  fix_needs_local_verify: (_context, extra) =>
    `Fix available. ${extra.verifiableTaskIds.length} task(s) need local verification.`,
  fix_failed: () => 'Self-healing failed to generate a fix.',
  no_fix: () => 'CI failed, no fix available.',

  // fallback
  fallback: ({ cipeStatus, selfHealingStatus, verificationStatus }) =>
    `CI: ${cipeStatus || 'N/A'} | Self-healing: ${
      selfHealingStatus || 'N/A'
    } | Verification: ${verificationStatus || 'N/A'}`,
};

// Codes where noProgressCount resets to 0 (genuine progress occurred)
const resetProgressCodes = new Set([
  'ci_success',
  'fix_auto_applying',
  'fix_auto_apply_skipped',
  'fix_needs_review',
  'fix_apply_ready',
  'fix_needs_local_verify',
]);

function formatMessage(msg, context) {
  const { verbosity, cipeStatus, selfHealingStatus, verificationStatus, prevStatus, pollCount } =
    context;
  if (verbosity === 'minimal') {
    const currentStatus = `${cipeStatus}|${selfHealingStatus}|${verificationStatus}`;
    if (currentStatus === (prevStatus || '')) return null;
    return msg;
  }
  if (verbosity === 'verbose') {
    return [
      `Poll #${pollCount + 1} | CI: ${cipeStatus || 'N/A'} | Self-healing: ${
        selfHealingStatus || 'N/A'
      } | Verification: ${verificationStatus || 'N/A'}`,
      msg,
    ].join('\n');
  }
  return `Poll #${pollCount + 1} | ${msg}`;
}

export function buildOutput(decision, context, noProgressCount) {
  const { envRerunCount } = context;
  const { action, code, extra } = decision;

  // noProgressCount is already computed before classify() was called.
  // Here we only handle the reset for "genuine progress" done-codes.

  const msgFn = messages[code];
  const rawMsg = msgFn ? msgFn(context, extra) : `Unknown: ${code}`;
  const message = formatMessage(rawMsg, context);

  const result = {
    action,
    code,
    message,
    noProgressCount: resetProgressCodes.has(code) ? 0 : noProgressCount,
    envRerunCount,
  };

  // Add delay
  if (action === 'wait') {
    result.delay = 30;
  } else if (action === 'poll') {
    result.delay = code === 'new_cipe_detected' ? 60 : backoff(noProgressCount);
    result.fields = 'light';
  }

  // Add extras
  if (code === 'new_cipe_detected') result.newCipeDetected = true;
  if (extra?.verifiableTaskIds) result.verifiableTaskIds = extra.verifiableTaskIds;
  if (extra?.autoApplySkipReason) result.autoApplySkipReason = extra.autoApplySkipReason;

  return result;
}
