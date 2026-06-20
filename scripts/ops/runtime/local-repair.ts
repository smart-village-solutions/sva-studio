type LocalRuntimeRepairMeta<DoctorCheck, DoctorReport> = Readonly<{
  isBlockingRepairFailure: (check: DoctorCheck) => boolean;
  hasBlockingReasonCode: (report: DoctorReport, reasonCode: string) => boolean;
  getChecks: (report: DoctorReport) => readonly DoctorCheck[];
  getCheckMessage: (check: DoctorCheck) => string;
  getCheckReasonCode: (check: DoctorCheck) => string | undefined;
  getCheckCode: (check: DoctorCheck) => string;
}>;

export const createLocalRuntimeRepairOps = <DoctorCheck, DoctorReport, SecretSyncSummary>(
  deps: LocalRuntimeRepairMeta<DoctorCheck, DoctorReport>,
) => {
  const repairLocalRuntimeWithDeps = async (
    repairDeps: {
      postflightDoctor: () => Promise<DoctorReport>;
      preflightDoctor: () => Promise<DoctorReport>;
      reconcileInstanceRegistry: () => Promise<void>;
      runActorBindingRepair?: () => Promise<void>;
      runMigrate: () => Promise<void>;
      syncTenantSecrets: () => Promise<SecretSyncSummary>;
    },
    options: {
      authoritative: boolean;
    },
  ): Promise<{
    postflightReport: DoctorReport;
    preflightReport: DoctorReport;
    tenantSecretSync: SecretSyncSummary;
  }> => {
    const preflightReport = await repairDeps.preflightDoctor();

    if (
      deps.hasBlockingReasonCode(preflightReport, 'schema_migration_drift')
      || deps.hasBlockingReasonCode(preflightReport, 'schema_manual_drift')
    ) {
      await repairDeps.runMigrate();
    }

    await repairDeps.reconcileInstanceRegistry();
    const tenantSecretSync = await repairDeps.syncTenantSecrets();

    if (repairDeps.runActorBindingRepair && deps.hasBlockingReasonCode(preflightReport, 'actor_binding_drift')) {
      await repairDeps.runActorBindingRepair();
    }

    const postflightReport = await repairDeps.postflightDoctor();

    if (deps.hasBlockingReasonCode(postflightReport, 'schema_manual_drift')) {
      throw new Error('Lokaler Repair kann die erkannte Schema-Drift nicht automatisch heilen. Bitte Umgebung oder Snapshot manuell untersuchen.');
    }

    if (!options.authoritative && deps.hasBlockingReasonCode(postflightReport, 'instance_identity_drift')) {
      throw new Error(
        'Lokale Instanz-Identitaetsdrift bleibt im Preserve-Modus bestehen. Fuer eine autoritative Korrektur env:repair:local-keycloak --authoritative erneut ausfuehren.',
      );
    }

    const blockingChecks = deps.getChecks(postflightReport).filter(deps.isBlockingRepairFailure);
    if (blockingChecks.length > 0) {
      const summary = blockingChecks
        .map((check) => `${deps.getCheckReasonCode(check) ?? deps.getCheckCode(check)}: ${deps.getCheckMessage(check)}`)
        .join(' | ');
      throw new Error(`Lokaler Runtime-Repair bleibt nach dem Reparaturlauf blockiert: ${summary}`);
    }

    return {
      postflightReport,
      preflightReport,
      tenantSecretSync,
    };
  };

  return {
    repairLocalRuntimeWithDeps,
  } as const;
};
