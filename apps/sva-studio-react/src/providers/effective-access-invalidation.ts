type Listener = () => void;

let generation = 0;
const listeners = new Set<Listener>();

export const getEffectiveAccessInvalidationGeneration = (): number => generation;

export const subscribeToEffectiveAccessInvalidation = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const requestEffectiveAccessInvalidation = (): void => {
  generation += 1;
  for (const listener of listeners) {
    listener();
  }
};
