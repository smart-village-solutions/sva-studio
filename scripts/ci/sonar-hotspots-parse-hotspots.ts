import type {
  BaseOptions,
  ListOptions,
  ShowOptions,
  ReviewOptions,
  BulkReviewOptions,
  ListOutputFormat,
} from './sonar-hotspots-types.ts';
import {
  DEFAULT_PROJECT_KEY,
  DEFAULT_PAGE_SIZE,
  error,
  normalizeBooleanFlag,
  parseFlags,
} from './sonar-hotspots-parse-shared.ts';

const REVIEWABLE_STATUSES = new Set(['REVIEWED']);
const REVIEWABLE_RESOLUTIONS = new Set(['SAFE', 'FIXED', 'ACKNOWLEDGED']);

export const parseListCommand = (args: readonly string[], shared: BaseOptions): ListOptions => {
  const commandName = 'list';
  const state: {
    projectKey: string;
    branch?: string;
    pullRequest?: string;
    status?: string;
    resolution?: string;
    sinceLeakPeriod?: boolean;
    pageSize: number;
    maxPages?: number;
    ruleKey?: string;
    filePathIncludes?: string;
    output: ListOutputFormat;
  } = {
    projectKey: DEFAULT_PROJECT_KEY,
    status: 'TO_REVIEW',
    pageSize: DEFAULT_PAGE_SIZE,
    maxPages: 1,
    output: 'table',
  };

  parseFlags(args, commandName, state, {
    '--project': {
      takesValue: true,
      handler: (next, value) => (next.projectKey = value ?? next.projectKey),
    },
    '--branch': { takesValue: true, handler: (next, value) => (next.branch = value) },
    '--pull-request': { takesValue: true, handler: (next, value) => (next.pullRequest = value) },
    '--status': { takesValue: true, handler: (next, value) => (next.status = value) },
    '--resolution': { takesValue: true, handler: (next, value) => (next.resolution = value) },
    '--since-leak-period': {
      takesValue: true,
      handler: (next, value) => {
        next.sinceLeakPeriod = normalizeBooleanFlag(value ?? '');
      },
    },
    '--page-size': {
      takesValue: true,
      handler: (next, value) => {
        next.pageSize = Number.parseInt(value ?? '', 10);
      },
    },
    '--max-pages': {
      takesValue: true,
      handler: (next, value) => {
        next.maxPages = Number.parseInt(value ?? '', 10);
      },
    },
    '--rule': { takesValue: true, handler: (next, value) => (next.ruleKey = value) },
    '--file-path-includes': {
      takesValue: true,
      handler: (next, value) => (next.filePathIncludes = value),
    },
    '--json': { takesValue: false, handler: (next) => (next.output = 'json') },
    '--csv': { takesValue: false, handler: (next) => (next.output = 'csv') },
    '--base-url': { takesValue: true, handler: () => undefined },
  });

  if (!Number.isInteger(state.pageSize) || state.pageSize < 1 || state.pageSize > 500) {
    error('--page-size muss zwischen 1 und 500 liegen.');
  }
  if (state.maxPages !== undefined && (!Number.isInteger(state.maxPages) || state.maxPages < 1)) {
    error('--max-pages muss >= 1 sein.');
  }

  return {
    command: 'list',
    ...shared,
    ...state,
  };
};

export const parseShowCommand = (args: readonly string[], shared: BaseOptions): ShowOptions => {
  const commandName = 'show';
  const state: { hotspotKey: string; json: boolean } = { hotspotKey: '', json: false };
  parseFlags(args, commandName, state, {
    '--hotspot': { takesValue: true, handler: (next, value) => (next.hotspotKey = value ?? '') },
    '--json': { takesValue: false, handler: (next) => (next.json = true) },
    '--base-url': { takesValue: true, handler: () => undefined },
  });

  if (state.hotspotKey.length === 0) {
    error('--hotspot ist erforderlich.');
  }

  return {
    command: 'show',
    ...shared,
    ...state,
  };
};

export const parseReviewCommand = (args: readonly string[], shared: BaseOptions): ReviewOptions => {
  const commandName = 'review';
  const state: {
    hotspotKey: string;
    status: 'REVIEWED';
    resolution: 'SAFE' | 'FIXED' | 'ACKNOWLEDGED';
    comment: string;
  } = {
    hotspotKey: '',
    status: 'REVIEWED',
    resolution: 'SAFE',
    comment: '',
  };

  parseFlags(args, commandName, state, {
    '--hotspot': { takesValue: true, handler: (next, value) => (next.hotspotKey = value ?? '') },
    '--status': {
      takesValue: true,
      handler: (next, value) => {
        const statusValue = value ?? '';
        if (!REVIEWABLE_STATUSES.has(statusValue)) {
          error('--status erlaubt nur REVIEWED.');
        }
        next.status = statusValue as 'REVIEWED';
      },
    },
    '--resolution': {
      takesValue: true,
      handler: (next, value) => {
        const resolutionValue = value ?? '';
        if (!REVIEWABLE_RESOLUTIONS.has(resolutionValue)) {
          error('--resolution erlaubt nur SAFE, FIXED oder ACKNOWLEDGED.');
        }
        next.resolution = resolutionValue as 'SAFE' | 'FIXED' | 'ACKNOWLEDGED';
      },
    },
    '--comment': { takesValue: true, handler: (next, value) => (next.comment = value ?? '') },
    '--base-url': { takesValue: true, handler: () => undefined },
  });

  if (state.hotspotKey.length === 0) {
    error('--hotspot ist erforderlich.');
  }
  if (state.comment.trim().length === 0) {
    error('--comment ist erforderlich.');
  }

  return {
    command: 'review',
    ...shared,
    ...state,
  };
};

export const parseBulkReviewCommand = (
  args: readonly string[],
  shared: BaseOptions
): BulkReviewOptions => {
  const commandName = 'bulk-review';
  const state: {
    hotspotKeys: string[];
    status: 'REVIEWED';
    resolution: 'SAFE' | 'FIXED' | 'ACKNOWLEDGED';
    comment: string;
  } = {
    hotspotKeys: [],
    status: 'REVIEWED',
    resolution: 'SAFE',
    comment: '',
  };

  parseFlags(args, commandName, state, {
    '--hotspot': {
      takesValue: true,
      handler: (next, value) => {
        if (value) {
          next.hotspotKeys.push(value);
        }
      },
    },
    '--status': {
      takesValue: true,
      handler: (next, value) => {
        const statusValue = value ?? '';
        if (!REVIEWABLE_STATUSES.has(statusValue)) {
          error('--status erlaubt nur REVIEWED.');
        }
        next.status = statusValue as 'REVIEWED';
      },
    },
    '--resolution': {
      takesValue: true,
      handler: (next, value) => {
        const resolutionValue = value ?? '';
        if (!REVIEWABLE_RESOLUTIONS.has(resolutionValue)) {
          error('--resolution erlaubt nur SAFE, FIXED oder ACKNOWLEDGED.');
        }
        next.resolution = resolutionValue as 'SAFE' | 'FIXED' | 'ACKNOWLEDGED';
      },
    },
    '--comment': { takesValue: true, handler: (next, value) => (next.comment = value ?? '') },
    '--base-url': { takesValue: true, handler: () => undefined },
  });

  if (state.hotspotKeys.length === 0) {
    error('Mindestens ein --hotspot ist erforderlich.');
  }
  if (state.comment.trim().length === 0) {
    error('--comment ist erforderlich.');
  }

  return {
    command: 'bulk-review',
    ...shared,
    hotspotKeys: state.hotspotKeys,
    status: state.status,
    resolution: state.resolution,
    comment: state.comment,
  };
};
