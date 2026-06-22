import { afterAll, afterEach, beforeAll } from 'vitest';

const installTestLocalStorage = (): void => {
  if ('localStorage' in globalThis) {
    return;
  }

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

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value(this: HTMLCanvasElement) {
      return {
        canvas: this,
        clearRect: () => undefined,
        drawImage: () => undefined,
        fillRect: () => undefined,
        getImageData: () => ({ data: new Uint8ClampedArray(), width: 0, height: 0 }),
        putImageData: () => undefined,
        createImageData: () => ({ data: new Uint8ClampedArray(), width: 0, height: 0 }),
        setTransform: () => undefined,
        resetTransform: () => undefined,
        save: () => undefined,
        restore: () => undefined,
        scale: () => undefined,
        rotate: () => undefined,
        translate: () => undefined,
        transform: () => undefined,
        beginPath: () => undefined,
        closePath: () => undefined,
        moveTo: () => undefined,
        lineTo: () => undefined,
        stroke: () => undefined,
        fill: () => undefined,
        arc: () => undefined,
        measureText: () => ({ width: 0 }),
        strokeRect: () => undefined,
        fillText: () => undefined,
        strokeText: () => undefined,
      };
    },
    writable: true,
  });
}

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
