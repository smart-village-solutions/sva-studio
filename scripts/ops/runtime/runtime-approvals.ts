import type {
  AcceptanceReleaseMode,
  DoctorCheck,
  DoctorReasonCode,
  DoctorReport,
  RemoteRuntimeProfile,
  RuntimeCommand,
} from '../runtime-env.shared.ts';
import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import { createLocalRuntimeRepairOps } from './local-repair.ts';

export type DangerousApprovalRequirement = Readonly<{
  readonly reason: string;
  readonly token: string;
}>;

export const assertDangerousOperationApproved = (input: {
  readonly actualApprovalToken?: string;
  readonly expectedApprovalToken: string;
  readonly reason: string;
}) => {
  if (input.actualApprovalToken?.trim() === input.expectedApprovalToken) {
    return;
  }

  throw new Error(
    `${input.reason} Gefaehrlicher Pfad bleibt gesperrt. Erneut mit --approve-dangerous=${input.expectedApprovalToken} ausfuehren.`,
  );
};

export const resolveLocalDangerousApprovalRequirement = (
  runtimeProfile: RuntimeProfile,
  runtimeCommand: Extract<RuntimeCommand, 'repair' | 'reconcile'>,
  options: {
    authoritative: boolean;
  },
): DangerousApprovalRequirement | null => {
  if (!options.authoritative) {
    return null;
  }

  const token = `${runtimeProfile}:${runtimeCommand}:authoritative`;
  const reason =
    runtimeCommand === 'repair'
      ? 'Autoritativer lokaler Repair kann geschuetzte Identitaetsfelder bewusst ueberschreiben.'
      : 'Autoritativer lokaler Registry-Reconcile kann geschuetzte Identitaetsfelder bewusst ueberschreiben.';

  return { reason, token };
};

export const resolveRemoteDangerousApprovalRequirement = (
  runtimeProfile: RemoteRuntimeProfile,
  runtimeCommand: Extract<RuntimeCommand, 'deploy' | 'down' | 'migrate' | 'reset'>,
  options: {
    releaseMode?: AcceptanceReleaseMode;
  },
): DangerousApprovalRequirement => {
  if (runtimeCommand === 'deploy') {
    const releaseMode = options.releaseMode ?? 'app-only';
    return {
      reason:
        releaseMode === 'schema-and-app'
          ? 'Remote-Deploy im Modus schema-and-app mutiert Laufzeit und Datenbankschema.'
          : 'Remote-Deploy mutiert den Ziel-Stack.',
      token: `${runtimeProfile}:deploy:${releaseMode}`,
    };
  }

  if (runtimeCommand === 'down') {
    return {
      reason: 'Remote-Down entfernt den Ziel-Stack.',
      token: `${runtimeProfile}:down`,
    };
  }

  if (runtimeCommand === 'migrate') {
    return {
      reason: 'Remote-Migrate mutiert das Datenbankschema der Zielumgebung.',
      token: `${runtimeProfile}:migrate`,
    };
  }

  return {
    reason: 'Remote-Reset setzt Postgres und Redis der Zielumgebung zurueck.',
    token: `${runtimeProfile}:reset`,
  };
};

const hasBlockingReasonCode = (report: DoctorReport, reasonCode: DoctorReasonCode) =>
  report.checks.some((check) => check.reasonCode === reasonCode);

const isBlockingRepairFailure = (check: DoctorCheck): boolean => {
  if (check.status === 'warn') {
    return check.reasonCode === 'instance_identity_drift';
  }

  return check.status === 'error';
};

export type LocalRuntimeRepairDeps<SecretSyncSummary> = Readonly<{
  postflightDoctor: () => Promise<DoctorReport>;
  preflightDoctor: () => Promise<DoctorReport>;
  reconcileInstanceRegistry: () => Promise<void>;
  runActorBindingRepair?: () => Promise<void>;
  runMigrate: () => Promise<void>;
  syncTenantSecrets: () => Promise<SecretSyncSummary>;
}>;

export const repairLocalRuntimeWithDeps = createLocalRuntimeRepairOps<
  DoctorCheck,
  DoctorReport,
  unknown
>({
  getCheckCode: (check) => check.code,
  getCheckMessage: (check) => check.message,
  getCheckReasonCode: (check) => check.reasonCode,
  getChecks: (report) => report.checks,
  hasBlockingReasonCode: (report, reasonCode) => hasBlockingReasonCode(report, reasonCode as DoctorReasonCode),
  isBlockingRepairFailure,
}).repairLocalRuntimeWithDeps as <SecretSyncSummary>(
  deps: LocalRuntimeRepairDeps<SecretSyncSummary>,
  options: {
    authoritative: boolean;
  },
) => Promise<{
  postflightReport: DoctorReport;
  preflightReport: DoctorReport;
  tenantSecretSync: SecretSyncSummary;
}>;
