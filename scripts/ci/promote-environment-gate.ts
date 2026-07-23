export type PromoteEnvironment = 'dev' | 'staging' | 'prod';

export const evaluateEnvironmentRunGate = (input: {
  environment: PromoteEnvironment | undefined;
  label: string;
}) => {
  if (input.environment === 'dev' || input.environment === 'staging' || input.environment === 'prod') {
    return {
      message: `${input.label}-Gate freigegeben: Der gehärtete One-shot-Executor wird im Promote-Workflow mit Exit-Code-Evidenz ausgeführt.`,
      ok: true,
    };
  }

  return {
    message: `${input.label}-Gate blockiert: Zielumgebung ${input.environment ?? 'fehlend'} ist ungültig; erlaubt sind dev, staging oder prod.`,
    ok: false,
  };
};
