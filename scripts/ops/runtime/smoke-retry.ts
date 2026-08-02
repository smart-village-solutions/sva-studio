import type { AcceptanceProbeResult, DoctorCheck, DoctorReport } from '../runtime-env.shared.ts';

const retryableExternalWarmupProbeNames = new Set([
  'public-home',
  'public-live',
  'public-ready',
  'public-auth-login',
  'public-auth-login-bb-guben',
  'public-auth-login-de-musterhausen',
  'public-iam-context',
  'public-iam-instances',
]);
const retryableExternalWarmupSignals = ['404', '502', '503', '504', 'timeout', 'timed out', 'gateway'];
const retryableInternalWarmupStates = ['pending', 'preparing', 'starting', 'assigned', 'accepted', 'new', 'ready', 'shutdown'];

export const deriveInternalVerifyMaxAttempts = (input: { readonly retryDelayMs: number; readonly warmupWindowMs: number }) => {
  const normalizedRetryDelayMs = input.retryDelayMs > 0 ? input.retryDelayMs : 1000;
  return Math.max(1, Math.floor(input.warmupWindowMs / normalizedRetryDelayMs) + 1);
};

const checkContainsRetryableWarmupSignal = (check: DoctorCheck, retryableWarmupSignalsInput: readonly string[]) => {
  const message = typeof check.message === 'string' ? check.message.toLowerCase() : '';
  if (retryableWarmupSignalsInput.some((signal) => message.includes(signal))) return true;
  const details = check.details;
  if (!details) return false;
  const status = details.status;
  if (typeof status === 'number' && [404, 502, 503, 504].includes(status)) return true;
  const payload = details.payload;
  return typeof payload === 'string' && retryableWarmupSignalsInput.some((signal) => payload.toLowerCase().includes(signal));
};

export const shouldRetryInternalVerify = (
  doctorReport: DoctorReport,
  retryableWarmupChecks: ReadonlySet<string> = new Set(['health-live', 'health-ready', 'auth-login', 'auth-me', 'tenant-auth-proof', 'app-db-principal']),
  retryableWarmupSignalsInput: readonly string[] = ['404', '502', '503', '504', 'timeout', 'timed out', 'gateway'],
) => {
  const failingChecks = doctorReport.checks.filter((check) => check.status === 'error');
  return failingChecks.length > 0 && failingChecks.every((check) => retryableWarmupChecks.has(check.name) && checkContainsRetryableWarmupSignal(check, retryableWarmupSignalsInput));
};

export const shouldRetryInternalProbeFailure = (probe: AcceptanceProbeResult) => {
  if (probe.status !== 'error' || probe.name !== 'swarm-app-task') return false;
  const hasRetryableWarmupState = (value: string | undefined) => typeof value === 'string' && retryableInternalWarmupStates.some((warmupState) => value.includes(warmupState));
  const lowerCaseMessage = probe.message.toLowerCase();
  if (hasRetryableWarmupState(lowerCaseMessage)) return true;
  const details = probe.details;
  if (!details || typeof details !== 'object') return false;
  const values = ['state', 'currentState', 'desiredState'].map((key) => (key in details && typeof details[key as keyof typeof details] === 'string' ? String(details[key as keyof typeof details]).toLowerCase() : undefined));
  return values.some((value) => hasRetryableWarmupState(value));
};

export const shouldRetryInternalVerifyAttempt = ({
  doctorReport,
  probes,
  retryableWarmupChecks = new Set(['health-live', 'health-ready', 'auth-login', 'auth-me', 'tenant-auth-proof', 'app-db-principal']),
  retryableWarmupSignals = ['404', '502', '503', '504', 'timeout', 'timed out', 'gateway'],
}: {
  doctorReport: DoctorReport;
  probes: readonly AcceptanceProbeResult[];
  retryableWarmupChecks?: ReadonlySet<string>;
  retryableWarmupSignals?: readonly string[];
}) => {
  const failingProbes = probes.filter((probe) => probe.status === 'error');
  const doctorFailed = doctorReport.status === 'error';
  if (!doctorFailed && failingProbes.length === 0) return false;
  const hasRetryableWarmupOnlyErrors = doctorFailed ? shouldRetryInternalVerify(doctorReport, new Set(retryableWarmupChecks), retryableWarmupSignals) : true;
  const hasRetryableWarmupOnlyProbeFailures = failingProbes.length > 0 ? failingProbes.every((probe) => shouldRetryInternalProbeFailure(probe)) : true;
  return hasRetryableWarmupOnlyErrors && hasRetryableWarmupOnlyProbeFailures;
};

export const shouldRetryExternalSmoke = (probes: readonly AcceptanceProbeResult[]) => {
  const failingProbes = probes.filter((probe) => probe.status === 'error');
  return failingProbes.length > 0 && failingProbes.every((probe) => {
    const isIngressProbe = probe.name.startsWith('public-ingress-https-') || probe.name.startsWith('public-ingress-login-');
    const hasRetryableName = retryableExternalWarmupProbeNames.has(probe.name)
      || probe.name.startsWith('public-auth-login-')
      || isIngressProbe;
    const hasRetryableSignal = retryableExternalWarmupSignals.some((signal) => probe.message.toLowerCase().includes(signal));
    return hasRetryableName && (hasRetryableSignal || (isIngressProbe && probe.httpStatus === undefined));
  });
};

export const summarizeExternalSmokeAttempt = (probes: readonly AcceptanceProbeResult[]) => {
  const failures = probes.filter((probe) => probe.status === 'error');
  const statuses = failures.reduce<Record<string, number>>((summary, probe) => {
    const key = probe.httpStatus === undefined ? 'transport' : String(probe.httpStatus);
    summary[key] = (summary[key] ?? 0) + 1;
    return summary;
  }, {});
  return { failed: failures.length, retryable: shouldRetryExternalSmoke(probes), statuses };
};
