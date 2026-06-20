import type { DoctorCheck, RuntimeProfile } from '../runtime-env.shared.ts';
import type { RuntimeDoctorDeps, RuntimeProfileValidation } from './doctor.types.ts';

export const createRuntimeEnvCheck = (
  deps: RuntimeDoctorDeps,
  runtimeProfile: RuntimeProfile,
  validation: RuntimeProfileValidation,
  runtimeContract: Readonly<Record<string, unknown>>,
  message: string,
) => {
  if (validation.missing.length > 0 || validation.placeholders.length > 0 || validation.invalid.length > 0) {
    return deps.toDoctorCheck('runtime-env', 'error', 'runtime_env_invalid', message, {
      derived: validation.derived,
      derivedKeys: deps.getRuntimeProfileDerivedEnvKeys(runtimeProfile),
      effectiveSummary: runtimeContract,
      invalid: validation.invalid,
      missing: validation.missing,
      placeholders: validation.placeholders,
      requiredKeys: deps.getRuntimeProfileRequiredEnvKeys(runtimeProfile),
    });
  }

  return deps.toDoctorCheck('runtime-env', 'ok', 'runtime_env_valid', message.replace('nicht ', ''), {
    derived: validation.derived,
    derivedKeys: deps.getRuntimeProfileDerivedEnvKeys(runtimeProfile),
    effectiveSummary: runtimeContract,
    requiredKeys: deps.getRuntimeProfileRequiredEnvKeys(runtimeProfile),
  });
};

export const createEndpointHealthCheck = async (
  deps: RuntimeDoctorDeps,
  input: { baseUrl: string; errorCode: string; name: string; okCode: string; okMessage: string; path: string; unreachableCode: string },
): Promise<DoctorCheck> => {
  try {
    const result = await deps.checkHttpHealth(new URL(input.path, input.baseUrl).toString());
    return deps.toDoctorCheck(
      input.name,
      result.response.ok ? 'ok' : 'error',
      result.response.ok ? input.okCode : input.errorCode,
      result.response.ok ? input.okMessage : `${input.okMessage.split(' erfolgreich.')[0]} antwortet mit ${result.response.status}.`,
      { payload: (result.payload ?? {}) as Record<string, unknown>, status: result.response.status },
    );
  } catch (error) {
    return deps.toDoctorCheck(input.name, 'error', input.unreachableCode, error instanceof Error ? error.message : String(error));
  }
};

export const createAssertionCheck = async (
  deps: RuntimeDoctorDeps,
  input: { code: string; errorCode: string; name: string; okMessage: string; run: () => Promise<void> },
): Promise<DoctorCheck> => {
  try {
    await input.run();
    return deps.toDoctorCheck(input.name, 'ok', input.code, input.okMessage);
  } catch (error) {
    return deps.toDoctorCheck(input.name, 'error', input.errorCode, error instanceof Error ? error.message : String(error));
  }
};
