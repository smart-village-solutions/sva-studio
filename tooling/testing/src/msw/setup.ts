import { afterAll, afterEach, beforeAll } from 'vitest';

const installTestLocalStorage = (): void => {
  const storage = new Map<string, string>();

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      clear: () => {
        storage.clear();
      },
      getItem: (key: string) => {
        return storage.get(String(key)) ?? null;
      },
      key: (index: number) => {
        return [...storage.keys()][index] ?? null;
      },
      removeItem: (key: string) => {
        storage.delete(String(key));
      },
      setItem: (key: string, value: string) => {
        storage.set(String(key), String(value));
      },
      get length() {
        return storage.size;
      },
    } satisfies Storage,
    writable: true,
  });
};

installTestLocalStorage();

const [{ resetStudioMswHandlers }, { studioMswServer }] = await Promise.all([
  import('./reset.ts'),
  import('./server.ts'),
]);

(globalThis as { __studioMswServer?: typeof studioMswServer }).__studioMswServer = studioMswServer;

beforeAll(() => {
  studioMswServer.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  resetStudioMswHandlers();
});

afterAll(() => {
  studioMswServer.close();
});
