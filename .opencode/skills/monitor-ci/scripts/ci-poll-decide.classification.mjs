import { isNewCipe, isTimedOut, isWaitTimedOut } from './ci-poll-decide.state.mjs';

function categorizeTasks({ failedTaskIds, verifiedTaskIds }) {
  const verifiedSet = new Set(verifiedTaskIds);
  const unverified = failedTaskIds.filter((task) => !verifiedSet.has(task));
  if (unverified.length === 0) return { category: 'all_verified' };
  const verifiable = unverified.filter((task) => {
    const parts = task.split(':');
    return !(parts.length >= 2 && parts[1].includes('e2e'));
  });
  if (verifiable.length === 0) return { category: 'e2e_only' };
  return { category: 'needs_local_verify', verifiableTaskIds: verifiable };
}

function classifyWait(context) {
  if (isNewCipe(context)) return { action: 'poll', code: 'new_cipe_detected' };
  // The total timeout caps waiting before the separate new-attempt timeout.
  if (isTimedOut(context)) return { action: 'done', code: 'polling_timeout' };
  if (isWaitTimedOut(context)) return { action: 'done', code: 'no_new_cipe' };
  return { action: 'wait', code: 'waiting_for_cipe' };
}

const terminalCiCodes = new Map([
  ['SUCCEEDED', 'ci_success'],
  ['CANCELED', 'cipe_canceled'],
  ['TIMED_OUT', 'cipe_timed_out'],
]);

function classifyCompletedCi(context) {
  const {
    cipeStatus,
    failedTaskIds,
    selfHealingStatus,
    failureClassification,
    envRerunCount,
    selfHealingSkippedReason,
  } = context;
  const code = terminalCiCodes.get(cipeStatus);
  if (code) return { action: 'done', code };
  if (cipeStatus === 'FAILED' && failedTaskIds.length === 0 && selfHealingStatus == null)
    return { action: 'done', code: 'cipe_no_tasks' };
  if (failureClassification === 'environment_state')
    return {
      action: 'done',
      code: envRerunCount >= 2 ? 'environment_rerun_cap' : 'environment_issue',
    };
  if (selfHealingSkippedReason === 'THROTTLED')
    return { action: 'done', code: 'self_healing_throttled' };
  return null;
}

function classifyActiveCi(context) {
  const {
    cipeStatus,
    selfHealingStatus,
    selfHealingSkippedReason,
    failureClassification,
    userAction,
  } = context;
  if (['IN_PROGRESS', 'NOT_STARTED'].includes(cipeStatus))
    return { action: 'poll', code: 'ci_running' };
  if (['IN_PROGRESS', 'NOT_STARTED'].includes(selfHealingStatus) && !selfHealingSkippedReason)
    return { action: 'poll', code: 'sh_running' };
  if (failureClassification === 'flaky_task') return { action: 'poll', code: 'flaky_rerun' };
  if (userAction === 'APPLIED_AUTOMATICALLY') return { action: 'poll', code: 'fix_auto_applied' };
  return null;
}

function classifyAutomaticFix({
  couldAutoApplyTasks,
  autoApplySkipped,
  autoApplySkipReason,
  verificationStatus,
}) {
  if (couldAutoApplyTasks !== true) return null;
  if (autoApplySkipped === true)
    return { action: 'done', code: 'fix_auto_apply_skipped', extra: { autoApplySkipReason } };
  if (['NOT_STARTED', 'IN_PROGRESS'].includes(verificationStatus))
    return { action: 'poll', code: 'verification_pending' };
  if (verificationStatus === 'COMPLETED') return { action: 'done', code: 'fix_auto_applying' };
  return null;
}

function classifyAvailableFix(context) {
  const { selfHealingStatus, verificationStatus, couldAutoApplyTasks } = context;
  if (selfHealingStatus !== 'COMPLETED') return null;
  if (
    verificationStatus === 'FAILED' ||
    verificationStatus === 'NOT_EXECUTABLE' ||
    (couldAutoApplyTasks !== true && !verificationStatus)
  )
    return { action: 'done', code: 'fix_needs_review' };
  const tasks = categorizeTasks(context);
  if (['all_verified', 'e2e_only'].includes(tasks.category))
    return { action: 'done', code: 'fix_apply_ready' };
  return {
    action: 'done',
    code: 'fix_needs_local_verify',
    extra: { verifiableTaskIds: tasks.verifiableTaskIds },
  };
}

export function classify(context, noProgressCount) {
  const { waitMode, selfHealingStatus, cipeStatus, selfHealingEnabled } = context;
  if (waitMode) return classifyWait(context);
  if (isTimedOut(context)) return { action: 'done', code: 'polling_timeout' };
  if (noProgressCount >= 13) return { action: 'done', code: 'circuit_breaker' };
  // Direct, lazy calls retain the documented first-matching-decision priority.
  const decision =
    classifyCompletedCi(context) ??
    classifyActiveCi(context) ??
    classifyAutomaticFix(context) ??
    classifyAvailableFix(context);
  if (decision) return decision;
  if (selfHealingStatus === 'FAILED') return { action: 'done', code: 'fix_failed' };
  if (
    cipeStatus === 'FAILED' &&
    (selfHealingEnabled === false || selfHealingStatus === 'NOT_EXECUTABLE')
  )
    return { action: 'done', code: 'no_fix' };
  return { action: 'poll', code: 'fallback' };
}
