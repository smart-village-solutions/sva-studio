export type PromoteEnvironment = 'dev' | 'staging' | 'prod';

export const evaluateEnvironmentRunGate = (input: {
  environment: PromoteEnvironment | undefined;
  label: string;
}) => {
  if (input.environment === 'dev' || input.environment === 'staging') {
    return {
      message: `${input.label}-Gate freigegeben: Der gehärtete One-shot-Executor wird im Promote-Workflow mit Exit-Code-Evidenz ausgeführt.`,
      ok: true,
    };
  }

  return {
    message: `${input.label}-Gate blockiert: ${input.environment === 'prod' ? 'Production erlaubt One-shot-Jobs im Modus "run" noch nicht. Erforderlich sind Staging-Parität, Production-Freigabe, Backup-/Restore-Readiness und spezifische Postconditions.' : 'Die Zielumgebung fehlt oder ist ungültig.'}`,
    ok: false,
  };
};
