import type { DeployGateMode, PromoteEnvironment } from './promote-deploy-gates.ts';

export interface PromoteDeployGateCliOptions {
  base: string;
  bootstrapExecutorConfigured: boolean;
  bootstrapMode: DeployGateMode;
  changedFiles: string[] | null;
  environment: PromoteEnvironment | undefined;
  head: string;
  migrationExecutorConfigured: boolean;
  migrationMode: DeployGateMode;
}

export const parseBoolean = (value: string): boolean => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Ungültiger Boolean-Wert: ${value}`);
};

export const parseMode = (value: string, flag: string): DeployGateMode => {
  if (value === 'assert-none' || value === 'auto' || value === 'run') return value;
  throw new Error(`Ungültiger Wert für ${flag}: ${value}`);
};

export const parsePromoteDeployGateCliOptions = (args: readonly string[]): PromoteDeployGateCliOptions => {
  let base = 'origin/main';
  let head = 'HEAD';
  let migrationMode: DeployGateMode = 'assert-none';
  let bootstrapMode: DeployGateMode = 'assert-none';
  let migrationExecutorConfigured = false;
  let bootstrapExecutorConfigured = false;
  let changedFiles: string[] | null = null;
  let environment: PromoteEnvironment | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const nextValue = (): string => {
      const value = args[index + 1];
      if (!value) throw new Error(`Fehlender Wert für ${argument}`);
      index += 1;
      return value;
    };
    if (argument === '--base') base = nextValue();
    else if (argument === '--head') head = nextValue();
    else if (argument === '--migration-mode') migrationMode = parseMode(nextValue(), '--migration-mode');
    else if (argument === '--bootstrap-mode') bootstrapMode = parseMode(nextValue(), '--bootstrap-mode');
    else if (argument === '--migration-executor-configured') migrationExecutorConfigured = parseBoolean(nextValue());
    else if (argument === '--bootstrap-executor-configured') bootstrapExecutorConfigured = parseBoolean(nextValue());
    else if (argument === '--changed-files') changedFiles = [...new Set(nextValue().split(',').map((value) => value.trim()).filter(Boolean))].sort();
    else if (argument === '--environment') {
      const value = nextValue();
      if (value !== 'dev' && value !== 'staging' && value !== 'prod') throw new Error(`Ungültige Umgebung: ${value}`);
      environment = value;
    } else throw new Error(`Unbekannte Option: ${argument}`);
  }
  return { base, bootstrapExecutorConfigured, bootstrapMode, changedFiles, environment, head, migrationExecutorConfigured, migrationMode };
};
