import { createScope, createTimeline, stagger, svg } from 'animejs';
import type { AnimationParams, FunctionValue, Timeline, TimelinePosition } from 'animejs';

export type StudioWorkbenchAnimationOptions = Readonly<{
  mode: 'full' | 'compact';
  scene: 'anonymous' | 'authenticated';
}>;

type WorkbenchAnimationSettings = Readonly<{
  artworkBlockDelay: number;
  artworkBlockDuration: number;
  artworkBlockScale: number;
  artworkBlockStart: number;
  artworkBlockTranslateX: FunctionValue<number>;
  artworkBlockTranslateY: FunctionValue<number>;
  connectorDelay: number;
  connectorDuration: number;
  connectorStart: number;
  gridDuration: number;
  gridScale: number;
  moduleDelay: number;
  moduleDuration: number;
  moduleScale: number;
  moduleStart: Readonly<Record<StudioWorkbenchAnimationOptions['scene'], number>>;
  moduleTranslateY: Readonly<Record<StudioWorkbenchAnimationOptions['scene'], [number, number]>>;
  surfaceDuration: number;
  surfaceStart: number;
  surfaceTranslateY: [number, number];
}>;

const fullBlockTranslateX: FunctionValue<number> = (_target, index = 0) =>
  ((index % 2) * 2 - 1) * (20 + index * 2);
const fullBlockTranslateY: FunctionValue<number> = (_target, index = 0) =>
  [-13, -13, 16, 16, 16][index] ?? 16;
const compactBlockTranslateX: FunctionValue<number> = () => 0;
const compactBlockTranslateY: FunctionValue<number> = () => 4;

const WORKBENCH_ANIMATION_SETTINGS: Readonly<
  Record<StudioWorkbenchAnimationOptions['mode'], WorkbenchAnimationSettings>
> = {
  full: {
    artworkBlockDelay: 120,
    artworkBlockDuration: 620,
    artworkBlockScale: 0.74,
    artworkBlockStart: 260,
    artworkBlockTranslateX: fullBlockTranslateX,
    artworkBlockTranslateY: fullBlockTranslateY,
    connectorDelay: 90,
    connectorDuration: 720,
    connectorStart: 760,
    gridDuration: 680,
    gridScale: 0.96,
    moduleDelay: 95,
    moduleDuration: 520,
    moduleScale: 0.965,
    moduleStart: { anonymous: 980, authenticated: 620 },
    moduleTranslateY: { anonymous: [8, 0], authenticated: [12, 0] },
    surfaceDuration: 520,
    surfaceStart: 1120,
    surfaceTranslateY: [10, 0],
  },
  compact: {
    artworkBlockDelay: 34,
    artworkBlockDuration: 260,
    artworkBlockScale: 0.94,
    artworkBlockStart: 40,
    artworkBlockTranslateX: compactBlockTranslateX,
    artworkBlockTranslateY: compactBlockTranslateY,
    connectorDelay: 25,
    connectorDuration: 230,
    connectorStart: 120,
    gridDuration: 220,
    gridScale: 0.992,
    moduleDelay: 28,
    moduleDuration: 240,
    moduleScale: 0.99,
    moduleStart: { anonymous: 120, authenticated: 120 },
    moduleTranslateY: { anonymous: [4, 0], authenticated: [4, 0] },
    surfaceDuration: 220,
    surfaceStart: 180,
    surfaceTranslateY: [3, 0],
  },
};

const addAnimation = (
  timeline: Timeline,
  elements: NodeListOf<Element>,
  parameters: AnimationParams,
  position: TimelinePosition
): void => {
  if (elements.length === 0) return;
  timeline.add(Array.from(elements), parameters, position);
};

const addDrawableAnimation = (
  timeline: Timeline,
  elements: NodeListOf<SVGGeometryElement>,
  parameters: AnimationParams,
  position: TimelinePosition
): void => {
  if (elements.length === 0) return;
  timeline.add(svg.createDrawable(elements), parameters, position);
};

const addWorkbenchArtworkAnimations = (
  timeline: Timeline,
  root: HTMLElement,
  settings: WorkbenchAnimationSettings
): void => {
  addAnimation(
    timeline,
    root.querySelectorAll('.studio-workbench-grid'),
    {
      opacity: [0.18, 0.66],
      scale: [settings.gridScale, 1],
      duration: settings.gridDuration,
    },
    0
  );
  addAnimation(
    timeline,
    root.querySelectorAll('.studio-workbench-block'),
    {
      opacity: [0.12, 0.92],
      scale: [settings.artworkBlockScale, 1],
      translateX: settings.artworkBlockTranslateX,
      translateY: settings.artworkBlockTranslateY,
      duration: settings.artworkBlockDuration,
      delay: stagger(settings.artworkBlockDelay),
    },
    settings.artworkBlockStart
  );
  addDrawableAnimation(
    timeline,
    root.querySelectorAll<SVGGeometryElement>('.studio-workbench-connector'),
    {
      draw: ['0 0', '0 1', '1 1'],
      duration: settings.connectorDuration,
      delay: stagger(settings.connectorDelay),
    },
    settings.connectorStart
  );
};

const addWorkbenchContentAnimations = (
  timeline: Timeline,
  root: HTMLElement,
  scene: StudioWorkbenchAnimationOptions['scene'],
  settings: WorkbenchAnimationSettings
): void => {
  addAnimation(
    timeline,
    root.querySelectorAll('[data-studio-workbench-module]'),
    {
      opacity: [0.74, 1],
      scale: [settings.moduleScale, 1],
      translateY: settings.moduleTranslateY[scene],
      duration: settings.moduleDuration,
      delay: stagger(settings.moduleDelay),
    },
    settings.moduleStart[scene]
  );
  addAnimation(
    timeline,
    root.querySelectorAll('[data-studio-workbench-surface]'),
    {
      opacity: [0.78, 1],
      translateY: settings.surfaceTranslateY,
      duration: settings.surfaceDuration,
    },
    settings.surfaceStart
  );
};

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
  const settings = WORKBENCH_ANIMATION_SETTINGS[mode];
  const scope = createScope({ root }).add(() => {
    const timeline = createTimeline({ defaults: { ease: 'out(4)' } });
    addWorkbenchArtworkAnimations(timeline, root, settings);
    addWorkbenchContentAnimations(timeline, root, scene, settings);
  });

  return () => scope.revert();
};
