import { createScope, createTimeline, stagger, svg } from 'animejs';

export type StudioWorkbenchAnimationOptions = Readonly<{
  mode: 'full' | 'compact';
  scene: 'anonymous' | 'authenticated';
}>;

export const startContentAssemblyAnimation = (root: HTMLElement): (() => void) => {
  const scope = createScope({ root }).add(() => {
    const timeline = createTimeline({
      loop: true,
      loopDelay: 180,
      defaults: { ease: 'inOut(3)' },
    });

    timeline
      .add(
        svg.createDrawable('.studio-motion-frame-line'),
        {
          draw: ['0 0', '0 1', '1 1'],
          duration: 720,
        },
        0
      )
      .add(
        '.studio-motion-block',
        {
          opacity: [0.28, 1],
          scale: [0.82, 1],
          translateY: [7, 0],
          duration: 440,
          delay: stagger(95),
        },
        360
      )
      .add(
        '.studio-motion-accent',
        {
          opacity: [0.2, 1, 0.2],
          scale: [0.85, 1.12, 0.85],
          duration: 620,
        },
        920
      );
  });

  return () => scope.revert();
};

export const startWorkbenchAnimation = (
  root: HTMLElement,
  { mode, scene }: StudioWorkbenchAnimationOptions
): (() => void) => {
  const isFull = mode === 'full';
  const isAuthenticated = scene === 'authenticated';
  const scope = createScope({ root }).add(() => {
    const timeline = createTimeline({ defaults: { ease: 'out(4)' } });
    const grid = root.querySelectorAll('.studio-workbench-grid');
    const artworkBlocks = root.querySelectorAll('.studio-workbench-block');
    const connectors = root.querySelectorAll('.studio-workbench-connector');
    const modules = root.querySelectorAll('[data-studio-workbench-module]');
    const surfaces = root.querySelectorAll('[data-studio-workbench-surface]');

    if (grid.length > 0) {
      timeline.add(
        grid,
        {
          opacity: [0.18, 0.66],
          scale: [isFull ? 0.96 : 0.992, 1],
          duration: isFull ? 680 : 220,
        },
        0
      );
    }
    if (artworkBlocks.length > 0) {
      timeline.add(
        artworkBlocks,
        {
          opacity: [0.12, 0.92],
          scale: [isFull ? 0.74 : 0.94, 1],
          translateX: (_target: unknown, index = 0) =>
            isFull ? (index % 2 === 0 ? -20 - index * 2 : 18 + index * 2) : 0,
          translateY: (_target: unknown, index = 0) => (isFull ? (index < 2 ? -13 : 16) : 4),
          duration: isFull ? 620 : 260,
          delay: stagger(isFull ? 120 : 34),
        },
        isFull ? 260 : 40
      );
    }
    if (connectors.length > 0) {
      timeline.add(
        svg.createDrawable(connectors),
        {
          draw: ['0 0', '0 1', '1 1'],
          duration: isFull ? 720 : 230,
          delay: stagger(isFull ? 90 : 25),
        },
        isFull ? 760 : 120
      );
    }
    if (modules.length > 0) {
      timeline.add(
        modules,
        {
          opacity: [0.74, 1],
          scale: [isFull ? 0.965 : 0.99, 1],
          translateY: [isFull ? (isAuthenticated ? 12 : 8) : 4, 0],
          duration: isFull ? 520 : 240,
          delay: stagger(isFull ? 95 : 28),
        },
        isFull ? (isAuthenticated ? 620 : 980) : 120
      );
    }
    if (surfaces.length > 0) {
      timeline.add(
        surfaces,
        {
          opacity: [0.78, 1],
          translateY: [isFull ? 10 : 3, 0],
          duration: isFull ? 520 : 220,
        },
        isFull ? 1120 : 180
      );
    }
  });

  return () => scope.revert();
};
