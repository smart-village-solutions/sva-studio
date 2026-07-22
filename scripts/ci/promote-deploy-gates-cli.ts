import type { DeployGateMode } from './promote-deploy-gates.ts';

export const parseBoolean = (value: string): boolean => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Ungültiger Boolean-Wert: ${value}`);
};

export const parseMode = (value: string, flag: string): DeployGateMode => {
  if (value === 'assert-none' || value === 'run') return value;
  throw new Error(`Ungültiger Wert für ${flag}: ${value}`);
};
