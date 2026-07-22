export type PromoteEnvironment = 'dev' | 'staging' | 'prod';

export const evaluateEnvironmentRunGate = (input: {
  environment: PromoteEnvironment | undefined;
  label: string;
}) => {
  if (input.environment !== 'prod') {
    return {
      message: `${input.label}-Gate freigegeben: Der gehärtete One-shot-Executor wird im Promote-Workflow mit Exit-Code-Evidenz ausgeführt.`,
      ok: true,
    };
  }

  return {
    message: `${input.label}-Gate blockiert: Production erlaubt One-shot-Jobs im Modus "run" noch nicht. Erforderlich sind Staging-Paritaet, Production-Freigabe, Backup-/Restore-Readiness und spezifische Postconditions.`,
    ok: false,
  };
};
