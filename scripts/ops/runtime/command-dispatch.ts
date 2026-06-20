import type { RuntimeCommand } from '../runtime-env.shared.ts';

export const dispatchRuntimeCommand = async <T>(
  runtimeCommand: RuntimeCommand,
  handlers: Partial<Record<RuntimeCommand, () => Promise<T> | T>>,
): Promise<T> => {
  const handler = handlers[runtimeCommand];
  if (!handler) {
    throw new Error(`Kein Handler fuer Runtime-Kommando ${runtimeCommand} konfiguriert.`);
  }

  return await handler();
};
