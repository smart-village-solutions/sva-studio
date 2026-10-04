import type {
  BaseOptions,
  IssueListOptions,
  IssueShowOptions,
  IssueTransitionOptions,
  IssueCommentOptions,
  ListOutputFormat,
} from './sonar-hotspots-types.ts';
import {
  DEFAULT_PROJECT_KEY,
  DEFAULT_PAGE_SIZE,
  error,
  parseFlags,
} from './sonar-hotspots-parse-shared.ts';

const ISSUE_TRANSITIONS = new Set(['confirm', 'accept', 'reopen', 'resolve', 'falsepositive']);

export const parseIssueListCommand = (
  args: readonly string[],
  shared: BaseOptions
): IssueListOptions => {
  const commandName = 'issues:list';
  const state: {
    projectKey: string;
    branch?: string;
    pullRequest?: string;
    statuses?: string;
    severities?: string;
    types?: string;
    rules?: string;
    impactSeverities?: string;
    assignees?: string;
    filePathIncludes?: string;
    pageSize: number;
    maxPages?: number;
    output: ListOutputFormat;
  } = {
    projectKey: DEFAULT_PROJECT_KEY,
    statuses: 'OPEN,CONFIRMED',
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
    '--statuses': { takesValue: true, handler: (next, value) => (next.statuses = value) },
    '--severities': { takesValue: true, handler: (next, value) => (next.severities = value) },
    '--types': { takesValue: true, handler: (next, value) => (next.types = value) },
    '--rules': { takesValue: true, handler: (next, value) => (next.rules = value) },
    '--impact-severities': {
      takesValue: true,
      handler: (next, value) => (next.impactSeverities = value),
    },
    '--assignees': { takesValue: true, handler: (next, value) => (next.assignees = value) },
    '--file-path-includes': {
      takesValue: true,
      handler: (next, value) => (next.filePathIncludes = value),
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
    command: 'issues:list',
    ...shared,
    ...state,
  };
};

export const parseIssueShowCommand = (
  args: readonly string[],
  shared: BaseOptions
): IssueShowOptions => {
  const commandName = 'issues:show';
  const state: { issueKey: string; json: boolean } = { issueKey: '', json: false };
  parseFlags(args, commandName, state, {
    '--issue': { takesValue: true, handler: (next, value) => (next.issueKey = value ?? '') },
    '--json': { takesValue: false, handler: (next) => (next.json = true) },
    '--base-url': { takesValue: true, handler: () => undefined },
  });

  if (state.issueKey.length === 0) {
    error('--issue ist erforderlich.');
  }

  return {
    command: 'issues:show',
    ...shared,
    ...state,
  };
};

export const parseIssueTransitionCommand = (
  args: readonly string[],
  shared: BaseOptions
): IssueTransitionOptions => {
  const commandName = 'issues:transition';
  const state: {
    issueKey: string;
    transition?: IssueTransitionOptions['transition'];
    comment?: string;
  } = {
    issueKey: '',
  };

  parseFlags(args, commandName, state, {
    '--issue': { takesValue: true, handler: (next, value) => (next.issueKey = value ?? '') },
    '--transition': {
      takesValue: true,
      handler: (next, value) => {
        const transitionValue = value ?? '';
        if (!ISSUE_TRANSITIONS.has(transitionValue)) {
          error('--transition erlaubt nur confirm, accept, reopen, resolve oder falsepositive.');
        }
        next.transition = transitionValue as IssueTransitionOptions['transition'];
      },
    },
    '--comment': { takesValue: true, handler: (next, value) => (next.comment = value) },
    '--base-url': { takesValue: true, handler: () => undefined },
  });

  if (state.issueKey.length === 0) {
    error('--issue ist erforderlich.');
  }
  if (!state.transition) {
    error('--transition ist erforderlich.');
  }
  const nextTransition = state.transition as IssueTransitionOptions['transition'];

  return {
    command: 'issues:transition',
    ...shared,
    issueKey: state.issueKey,
    transition: nextTransition,
    comment: state.comment,
  };
};

export const parseIssueCommentCommand = (
  args: readonly string[],
  shared: BaseOptions
): IssueCommentOptions => {
  const commandName = 'issues:comment';
  const state: { issueKey: string; comment: string } = { issueKey: '', comment: '' };
  parseFlags(args, commandName, state, {
    '--issue': { takesValue: true, handler: (next, value) => (next.issueKey = value ?? '') },
    '--comment': { takesValue: true, handler: (next, value) => (next.comment = value ?? '') },
    '--base-url': { takesValue: true, handler: () => undefined },
  });

  if (state.issueKey.length === 0) {
    error('--issue ist erforderlich.');
  }
  if (state.comment.trim().length === 0) {
    error('--comment ist erforderlich.');
  }

  return {
    command: 'issues:comment',
    ...shared,
    ...state,
  };
};
