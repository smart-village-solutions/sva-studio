export function backoff(count) {
  const delays = [60, 90, 120, 180];
  return delays[Math.min(count, delays.length - 1)];
}

function hasStateChanged({
  prevCipeStatus,
  cipeStatus,
  prevShStatus,
  selfHealingStatus,
  prevVerificationStatus,
  verificationStatus,
  prevFailureClassification,
  failureClassification,
}) {
  return [
    [prevCipeStatus, cipeStatus],
    [prevShStatus, selfHealingStatus],
    [prevVerificationStatus, verificationStatus],
    [prevFailureClassification, failureClassification],
  ].some(([previous, current]) => previous && current !== previous);
}

export function isTimedOut({ timeoutSeconds, elapsedSeconds, pollCount }) {
  if (timeoutSeconds <= 0) return false;
  // Prefer real wall-clock elapsed (carried across attempts) so --timeout caps
  // total monitor duration, not a single invocation.
  if (elapsedSeconds !== null && !Number.isNaN(elapsedSeconds))
    return elapsedSeconds >= timeoutSeconds;
  // Fallback: estimate elapsed from poll cadence within this invocation.
  const avgDelay = pollCount === 0 ? 0 : backoff(Math.floor(pollCount / 2));
  return pollCount * avgDelay >= timeoutSeconds;
}

export function isWaitTimedOut({ newCipeTimeoutSeconds, pollCount }) {
  if (newCipeTimeoutSeconds <= 0) return false;
  return pollCount * 30 >= newCipeTimeoutSeconds;
}

export function isNewCipe({ prevCipeUrl, cipeUrl, expectedSha, commitSha }) {
  return (
    (prevCipeUrl && cipeUrl && cipeUrl !== prevCipeUrl) ||
    (expectedSha && commitSha && commitSha === expectedSha)
  );
}

export function computeNoProgressCount(context) {
  const { waitMode, inputNoProgressCount } = context;
  if (waitMode) return isNewCipe(context) ? 0 : inputNoProgressCount;
  if (isNewCipe(context) || hasStateChanged(context)) return 0;
  return inputNoProgressCount + 1;
}
