export type HomeMotionContext = 'anonymous' | 'authenticated';
export type HomeMotionMode = 'full' | 'compact';

type HomeMotionStorage = Readonly<{
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}>;

const HOME_MOTION_STORAGE_KEYS = {
  anonymous: 'sva-studio:home-motion:anonymous:v1',
  authenticated: 'sva-studio:home-motion:authenticated:v1',
} as const satisfies Record<HomeMotionContext, string>;

export const resolveHomeMotionMode = (
  context: HomeMotionContext,
  storage: HomeMotionStorage | undefined
): HomeMotionMode => {
  if (!storage) return 'compact';

  const storageKey = HOME_MOTION_STORAGE_KEYS[context];
  try {
    if (storage.getItem(storageKey) === 'seen') return 'compact';
    storage.setItem(storageKey, 'seen');
    return 'full';
  } catch {
    return 'compact';
  }
};
