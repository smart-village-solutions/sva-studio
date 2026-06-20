import type { AcceptanceDeployDeps, AcceptanceDeployState } from './acceptance-deploy.types.ts';
import { failDeploy } from './acceptance-deploy-state.ts';

export const runInternalVerifyPhase = async (deps: AcceptanceDeployDeps, state: AcceptanceDeployState) => {
  const startedAt = Date.now();
  const internalVerify = await deps.runInternalVerify(state.runtimeProfile, state.env);
  state.report = { ...state.report, internalProbes: [...state.report.internalProbes, ...internalVerify.probes] };
  const failed = internalVerify.doctorReport.status === 'error' || internalVerify.probes.some((probe) => probe.status === 'error');
  if (failed) {
    state.steps.push(deps.createStepResult('internal-verify', startedAt, 'error', 'Interne Verifikation meldet Fehler.', { probes: internalVerify.probes, report: internalVerify.doctorReport }));
    failDeploy(state, 'health');
  }

  state.steps.push(deps.createStepResult('internal-verify', startedAt, 'ok', 'Interne Verifikation erfolgreich abgeschlossen.', { probes: internalVerify.probes, report: internalVerify.doctorReport }));
};

export const runExternalSmokePhase = async (deps: AcceptanceDeployDeps, state: AcceptanceDeployState) => {
  const startedAt = Date.now();
  try {
    const externalProbes = await deps.runExternalSmokeWithWarmup(state.env, { runtimeProfile: state.runtimeProfile });
    state.report = { ...state.report, externalProbes };
    const failingProbe = externalProbes.find((probe) => probe.status === 'error');
    if (failingProbe) {
      throw new Error(`${failingProbe.name}: ${failingProbe.message}`);
    }
    state.steps.push(deps.createStepResult('external-smoke', startedAt, 'ok', 'Externe Smoke-Probes erfolgreich abgeschlossen.', { probes: externalProbes }));
  } catch (error) {
    state.steps.push(deps.createStepResult('external-smoke', startedAt, 'error', error instanceof Error ? error.message : String(error)));
    failDeploy(state, 'ingress');
  }
};

export const finalizeSuccessfulDeploy = async (deps: AcceptanceDeployDeps, state: AcceptanceDeployState) => {
  const startedAt = Date.now();
  state.report = {
    ...state.report,
    releaseDecision: { summary: 'Alle technischen Gates erfolgreich.', technicalGatePassed: true },
  };
  state.steps.push(deps.createStepResult('release-decision', startedAt, 'ok', 'Technische Freigabe erteilt.', { technicalGatePassed: true }));
  state.report = { ...state.report, stackStatus: await deps.captureAcceptanceStackStatus(state.env), steps: state.steps };
  deps.writeAcceptanceDeployReport(state.report);
  deps.printJsonIfRequested(state.report);
  if (!deps.jsonOutput) {
    console.log(`Acceptance-Deploy erfolgreich. Bericht: ${state.report.artifacts.markdownPath}`);
  }
};
