import { beforeEach, describe, expect, it, vi } from 'vitest';

const animeState = vi.hoisted(() => {
  const timeline = { add: vi.fn() };
  const scope = { add: vi.fn(), revert: vi.fn() };

  return {
    createDrawable: vi.fn(),
    createScope: vi.fn(),
    createTimeline: vi.fn(),
    scope,
    stagger: vi.fn(),
    timeline,
  };
});

vi.mock('animejs', () => ({
  createScope: animeState.createScope,
  createTimeline: animeState.createTimeline,
  stagger: animeState.stagger,
  svg: { createDrawable: animeState.createDrawable },
}));

import { startContentAssemblyAnimation, startWorkbenchAnimation } from './studio-motion.anime.js';

const installAnimeMocks = () => {
  animeState.timeline.add.mockImplementation(() => animeState.timeline);
  animeState.createTimeline.mockReturnValue(animeState.timeline);
  animeState.createDrawable.mockImplementation((target: unknown) => ({ target }));
  animeState.stagger.mockImplementation((delay: number) => ({ delay }));
  animeState.scope.add.mockImplementation((setup: () => void) => {
    setup();
    return animeState.scope;
  });
  animeState.createScope.mockReturnValue(animeState.scope);
};

const createWorkbenchRoot = (): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = `
    <svg>
      <g class="studio-workbench-grid"></g>
      <rect class="studio-workbench-block"></rect>
      <rect class="studio-workbench-block"></rect>
      <path class="studio-workbench-connector"></path>
    </svg>
    <section data-studio-workbench-module></section>
    <section data-studio-workbench-surface></section>
  `;
  return root;
};

describe('studio motion Anime.js bindings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installAnimeMocks();
  });

  it('builds and reverts the looping content assembly timeline', () => {
    const root = document.createElement('div');
    const cleanup = startContentAssemblyAnimation(root);

    expect(animeState.createScope).toHaveBeenCalledWith({ root });
    expect(animeState.createTimeline).toHaveBeenCalledWith({
      loop: true,
      loopDelay: 180,
      defaults: { ease: 'inOut(3)' },
    });
    expect(animeState.createDrawable).toHaveBeenCalledWith('.studio-motion-frame-line');
    expect(animeState.timeline.add).toHaveBeenCalledTimes(3);

    cleanup();
    expect(animeState.scope.revert).toHaveBeenCalledTimes(1);
  });

  it('configures the full anonymous workbench scene', () => {
    const root = createWorkbenchRoot();
    const cleanup = startWorkbenchAnimation(root, { mode: 'full', scene: 'anonymous' });

    expect(animeState.createTimeline).toHaveBeenCalledWith({ defaults: { ease: 'out(4)' } });
    expect(animeState.timeline.add).toHaveBeenCalledTimes(5);

    const blockParameters = animeState.timeline.add.mock.calls[1]?.[1] as {
      translateX: (_target: unknown, index?: number) => number;
      translateY: (_target: unknown, index?: number) => number;
    };
    expect(blockParameters.translateX(null)).toBe(-20);
    expect(blockParameters.translateX(null, 1)).toBe(22);
    expect(blockParameters.translateY(null, 0)).toBe(-13);
    expect(blockParameters.translateY(null, 8)).toBe(16);

    const moduleParameters = animeState.timeline.add.mock.calls[3]?.[1] as {
      opacity?: unknown;
      translateY: [number, number];
    };
    expect(moduleParameters.opacity).toBeUndefined();
    expect(moduleParameters.translateY).toEqual([8, 0]);

    const surfaceParameters = animeState.timeline.add.mock.calls[4]?.[1] as {
      opacity?: unknown;
    };
    expect(surfaceParameters.opacity).toBeUndefined();

    cleanup();
    expect(animeState.scope.revert).toHaveBeenCalledTimes(1);
  });

  it('configures the compact authenticated workbench scene', () => {
    const root = createWorkbenchRoot();
    startWorkbenchAnimation(root, { mode: 'compact', scene: 'authenticated' });

    const blockParameters = animeState.timeline.add.mock.calls[1]?.[1] as {
      translateX: (_target: unknown, index?: number) => number;
      translateY: (_target: unknown, index?: number) => number;
    };
    expect(blockParameters.translateX(null)).toBe(0);
    expect(blockParameters.translateY(null)).toBe(4);

    const moduleParameters = animeState.timeline.add.mock.calls[3]?.[1] as {
      translateY: [number, number];
    };
    expect(moduleParameters.translateY).toEqual([4, 0]);
  });

  it('does not add workbench animations for missing scene elements', () => {
    startWorkbenchAnimation(document.createElement('div'), {
      mode: 'compact',
      scene: 'anonymous',
    });

    expect(animeState.timeline.add).not.toHaveBeenCalled();
    expect(animeState.createDrawable).not.toHaveBeenCalled();
  });
});
