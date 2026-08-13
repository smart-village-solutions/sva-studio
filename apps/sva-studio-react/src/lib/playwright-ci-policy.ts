export interface PlaywrightCiPolicyEnv {
  CI?: string;
  PLAYWRIGHT_MAX_FAILURES?: string;
}

export const resolvePlaywrightMaxFailures = (env: PlaywrightCiPolicyEnv): number => {
  if (env.CI !== 'true') {
    return 0;
  }

  const configuredValue = Number(env.PLAYWRIGHT_MAX_FAILURES ?? '0');
  if (!Number.isSafeInteger(configuredValue) || configuredValue < 0) {
    throw new Error('PLAYWRIGHT_MAX_FAILURES muss eine nicht negative ganze Zahl sein.');
  }

  return configuredValue;
};
