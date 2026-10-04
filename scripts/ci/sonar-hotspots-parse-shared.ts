export const DEFAULT_BASE_URL = 'https://sonarcloud.io/api';
export const DEFAULT_PROJECT_KEY = 'smart-village-app_sva-studio';
export const DEFAULT_PAGE_SIZE = 100;
export const error = (message: string): never => {
  throw new Error(message);
};

const readFlagValue = (args: readonly string[], index: number, flag: string): string => {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    error(`Fehlender Wert für ${flag}`);
  }
  return value;
};

export const normalizeBooleanFlag = (value: string): boolean => {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  error(`Ungültiger Boolean-Wert: ${value}`);
  throw new Error('unreachable');
};

export const readSharedOptions = (args: readonly string[], env: NodeJS.ProcessEnv) => {
  let baseUrl = DEFAULT_BASE_URL;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--base-url') {
      baseUrl = readFlagValue(args, index, argument);
    }
  }

  const token = env.SONAR_TOKEN ?? env.SONARQUBE_TOKEN ?? '';
  if (token.length === 0) {
    error('SONAR_TOKEN oder SONARQUBE_TOKEN ist erforderlich.');
  }

  return {
    baseUrl,
    token,
  };
};

type FlagHandler<TState> = (state: TState, value: string | undefined) => void;

interface FlagSpec<TState> {
  takesValue: boolean;
  handler: FlagHandler<TState>;
}

export const parseFlags = <TState>(
  args: readonly string[],
  commandName: string,
  state: TState,
  specs: Readonly<Record<string, FlagSpec<TState>>>
): void => {
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const spec = specs[argument ?? ''];

    if (!spec) {
      error(`Unbekanntes Argument für ${commandName}: ${argument}`);
    }

    const value = spec.takesValue ? readFlagValue(args, index, argument ?? '') : undefined;
    if (spec.takesValue) {
      index += 1;
    }
    spec.handler(state, value);
  }
};
