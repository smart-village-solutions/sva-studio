#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'https://sonarcloud.io/api';
const DEFAULT_PROJECT_KEY = 'smart-village-app_sva-studio';
const DEFAULT_PAGE_SIZE = 100;
const REVIEWABLE_STATUSES = new Set(['REVIEWED']);
const REVIEWABLE_RESOLUTIONS = new Set(['SAFE', 'FIXED', 'ACKNOWLEDGED']);
const ISSUE_TRANSITIONS = new Set(['confirm', 'accept', 'reopen', 'resolve', 'falsepositive']);

export type CommandName =
  | 'list'
  | 'show'
  | 'review'
  | 'bulk-review'
  | 'issues:list'
  | 'issues:show'
  | 'issues:transition'
  | 'issues:comment';
export type ListOutputFormat = 'table' | 'json' | 'csv';

export interface BaseOptions {
  baseUrl: string;
  token: string;
}

export interface ListOptions extends BaseOptions {
  command: 'list';
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
}

export interface ShowOptions extends BaseOptions {
  command: 'show';
  hotspotKey: string;
  json: boolean;
}

export interface ReviewOptions extends BaseOptions {
  command: 'review';
  hotspotKey: string;
  status: 'REVIEWED';
  resolution: 'SAFE' | 'FIXED' | 'ACKNOWLEDGED';
  comment: string;
}

export interface BulkReviewOptions extends BaseOptions {
  command: 'bulk-review';
  hotspotKeys: readonly string[];
  status: 'REVIEWED';
  resolution: 'SAFE' | 'FIXED' | 'ACKNOWLEDGED';
  comment: string;
}

export interface IssueListOptions extends BaseOptions {
  command: 'issues:list';
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
}

export interface IssueShowOptions extends BaseOptions {
  command: 'issues:show';
  issueKey: string;
  json: boolean;
}

export interface IssueTransitionOptions extends BaseOptions {
  command: 'issues:transition';
  issueKey: string;
  transition: 'confirm' | 'accept' | 'reopen' | 'resolve' | 'falsepositive';
  comment?: string;
}

export interface IssueCommentOptions extends BaseOptions {
  command: 'issues:comment';
  issueKey: string;
  comment: string;
}

export type ParsedCommand =
  | ListOptions
  | ShowOptions
  | ReviewOptions
  | BulkReviewOptions
  | IssueListOptions
  | IssueShowOptions
  | IssueTransitionOptions
  | IssueCommentOptions;

export interface SonarHotspotSearchItem {
  key: string;
  component: string;
  project: string;
  securityCategory?: string;
  status?: string;
  resolution?: string;
  line?: number;
  message?: string;
  vulnerabilityProbability?: string;
  ruleKey?: string;
}

export interface SonarHotspotSearchResponse {
  paging?: {
    pageIndex?: number;
    pageSize?: number;
    total?: number;
  };
  hotspots?: SonarHotspotSearchItem[];
}

export interface SonarHotspotDetails {
  key: string;
  component: string;
  project: string;
  securityCategory?: string;
  status?: string;
  resolution?: string;
  line?: number;
  message?: string;
  vulnerabilityProbability?: string;
  rule?: {
    key?: string;
    name?: string;
    riskDescription?: string;
    vulnerabilityDescription?: string;
    fixRecommendations?: string;
  };
  comments?: Array<{
    markdown: string;
    createdAt?: string;
  }>;
}

export interface SonarIssueSearchItem {
  key: string;
  rule?: string;
  severity?: string;
  component: string;
  project: string;
  line?: number;
  status?: string;
  message?: string;
  type?: string;
  assignee?: string;
  impacts?: Array<{
    severity?: string;
    softwareQuality?: string;
  }>;
}

export interface SonarIssueSearchResponse {
  paging?: {
    pageIndex?: number;
    pageSize?: number;
    total?: number;
  };
  issues?: SonarIssueSearchItem[];
}

export interface SonarIssueDetails extends SonarIssueSearchItem {
  comments?: Array<{
    markdown?: string;
    createdAt?: string;
  }>;
  transitions?: readonly string[];
}

const usage = `SonarCloud Hotspots und Issues

Umgebungsvariablen:
  SONAR_TOKEN oder SONARQUBE_TOKEN   API-Token mit Projektberechtigungen

Befehle:
  list                Offene oder gefilterte Hotspots abrufen
  show                Details für einen Hotspot anzeigen
  review              Hotspot als REVIEWED markieren
  bulk-review         Mehrere Hotspots als REVIEWED markieren
  issues:list         Offene oder gefilterte Issues abrufen
  issues:show         Details für ein Issue anzeigen
  issues:transition   Status-Transition auf ein Issue anwenden
  issues:comment      Kommentar an ein Issue hängen

Beispiele:
  tsx scripts/ci/sonar-hotspots.ts list
  tsx scripts/ci/sonar-hotspots.ts list --branch main --status TO_REVIEW
  tsx scripts/ci/sonar-hotspots.ts list --csv
  tsx scripts/ci/sonar-hotspots.ts list --file-path-includes apps/sva-studio-react/src/components
  tsx scripts/ci/sonar-hotspots.ts show --hotspot AXxxxx
  tsx scripts/ci/sonar-hotspots.ts review --hotspot AXxxxx --resolution SAFE --comment "Kein Risiko im konkreten Kontext"
  tsx scripts/ci/sonar-hotspots.ts bulk-review --hotspot AX1 --hotspot AX2 --resolution SAFE --comment "Gleiche technische Begründung"
  tsx scripts/ci/sonar-hotspots.ts issues:list --statuses OPEN,CONFIRMED --types BUG,VULNERABILITY
  tsx scripts/ci/sonar-hotspots.ts issues:show --issue AXxxxx
  tsx scripts/ci/sonar-hotspots.ts issues:transition --issue AXxxxx --transition accept --comment "Akzeptiert im konkreten Kontext"
  tsx scripts/ci/sonar-hotspots.ts issues:comment --issue AXxxxx --comment "Fix ist im aktuellen Branch umgesetzt"
`;

const error = (message: string): never => {
  throw new Error(message);
};

const readFlagValue = (args: readonly string[], index: number, flag: string): string => {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    error(`Fehlender Wert für ${flag}`);
  }
  return value;
};

const normalizeBooleanFlag = (value: string): boolean => {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  error(`Ungültiger Boolean-Wert: ${value}`);
  throw new Error('unreachable');
};

const readSharedOptions = (args: readonly string[], env: NodeJS.ProcessEnv) => {
  let baseUrl = DEFAULT_BASE_URL;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--base-url') {
      baseUrl = readFlagValue(args, index, argument);
    }
  }

  const token = env.SONAR_TOKEN ?? env.SONARQUBE_TOKEN ?? '';
  if (token.length === 0) {
    error('SONAR_TOKEN oder SONARQUBE_TOKEN ist erforderlich.');
  }

  return {
    baseUrl,
    token,
  };
};

type FlagHandler<TState> = (state: TState, value: string | undefined) => void;

interface FlagSpec<TState> {
  takesValue: boolean;
  handler: FlagHandler<TState>;
}

const parseFlags = <TState>(
  args: readonly string[],
  commandName: string,
  state: TState,
  specs: Readonly<Record<string, FlagSpec<TState>>>
): void => {
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const spec = specs[argument ?? ''];

    if (!spec) {
      error(`Unbekanntes Argument für ${commandName}: ${argument}`);
    }

    const value = spec.takesValue ? readFlagValue(args, index, argument ?? '') : undefined;
    if (spec.takesValue) {
      index += 1;
    }
    spec.handler(state, value);
  }
};

export const parseCommand = (argv: readonly string[], env: NodeJS.ProcessEnv = process.env): ParsedCommand => {
  const normalizedArgv = argv[0] === '--' ? argv.slice(1) : argv;
  const [commandName = 'list', ...args] = normalizedArgv;
  const shared = readSharedOptions(args, env);

  if (commandName === 'list') {
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
      '--project': { takesValue: true, handler: (next, value) => (next.projectKey = value ?? next.projectKey) },
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
      '--file-path-includes': { takesValue: true, handler: (next, value) => (next.filePathIncludes = value) },
      '--json': { takesValue: false, handler: (next) => (next.output = 'json') },
      '--csv': { takesValue: false, handler: (next) => (next.output = 'csv') },
      '--base-url': { takesValue: true, handler: () => {} },
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
  }

  if (commandName === 'show') {
    const state: { hotspotKey: string; json: boolean } = { hotspotKey: '', json: false };
    parseFlags(args, commandName, state, {
      '--hotspot': { takesValue: true, handler: (next, value) => (next.hotspotKey = value ?? '') },
      '--json': { takesValue: false, handler: (next) => (next.json = true) },
      '--base-url': { takesValue: true, handler: () => {} },
    });

    if (state.hotspotKey.length === 0) {
      error('--hotspot ist erforderlich.');
    }

    return {
      command: 'show',
      ...shared,
      ...state,
    };
  }

  if (commandName === 'review') {
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
      '--base-url': { takesValue: true, handler: () => {} },
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
  }

  if (commandName === 'bulk-review') {
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
      '--base-url': { takesValue: true, handler: () => {} },
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
  }

  if (commandName === 'issues:list') {
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
      '--project': { takesValue: true, handler: (next, value) => (next.projectKey = value ?? next.projectKey) },
      '--branch': { takesValue: true, handler: (next, value) => (next.branch = value) },
      '--pull-request': { takesValue: true, handler: (next, value) => (next.pullRequest = value) },
      '--statuses': { takesValue: true, handler: (next, value) => (next.statuses = value) },
      '--severities': { takesValue: true, handler: (next, value) => (next.severities = value) },
      '--types': { takesValue: true, handler: (next, value) => (next.types = value) },
      '--rules': { takesValue: true, handler: (next, value) => (next.rules = value) },
      '--impact-severities': { takesValue: true, handler: (next, value) => (next.impactSeverities = value) },
      '--assignees': { takesValue: true, handler: (next, value) => (next.assignees = value) },
      '--file-path-includes': { takesValue: true, handler: (next, value) => (next.filePathIncludes = value) },
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
      '--base-url': { takesValue: true, handler: () => {} },
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
  }

  if (commandName === 'issues:show') {
    const state: { issueKey: string; json: boolean } = { issueKey: '', json: false };
    parseFlags(args, commandName, state, {
      '--issue': { takesValue: true, handler: (next, value) => (next.issueKey = value ?? '') },
      '--json': { takesValue: false, handler: (next) => (next.json = true) },
      '--base-url': { takesValue: true, handler: () => {} },
    });

    if (state.issueKey.length === 0) {
      error('--issue ist erforderlich.');
    }

    return {
      command: 'issues:show',
      ...shared,
      ...state,
    };
  }

  if (commandName === 'issues:transition') {
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
      '--base-url': { takesValue: true, handler: () => {} },
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
  }

  if (commandName === 'issues:comment') {
    const state: { issueKey: string; comment: string } = { issueKey: '', comment: '' };
    parseFlags(args, commandName, state, {
      '--issue': { takesValue: true, handler: (next, value) => (next.issueKey = value ?? '') },
      '--comment': { takesValue: true, handler: (next, value) => (next.comment = value ?? '') },
      '--base-url': { takesValue: true, handler: () => {} },
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
  }

  error(`Unbekanntes Kommando: ${commandName}`);
  throw new Error('unreachable');
};

const createHeaders = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
});

const ensureOk = async (response: Response): Promise<void> => {
  if (response.ok) {
    return;
  }

  const body = await response.text();
  error(`SonarCloud API Fehler ${response.status}: ${body || response.statusText}`);
};

export const buildListSearchParams = (options: ListOptions, pageIndex: number): URLSearchParams => {
  const params = new URLSearchParams({
    projectKey: options.projectKey,
    p: String(pageIndex),
    ps: String(options.pageSize),
  });

  if (options.branch) {
    params.set('branch', options.branch);
  }
  if (options.pullRequest) {
    params.set('pullRequest', options.pullRequest);
  }
  if (options.status) {
    params.set('status', options.status);
  }
  if (options.resolution) {
    params.set('resolution', options.resolution);
  }
  if (options.sinceLeakPeriod !== undefined) {
    params.set('sinceLeakPeriod', String(options.sinceLeakPeriod));
  }
  if (options.ruleKey) {
    params.set('onlyMine', 'false');
    params.set('ruleKey', options.ruleKey);
  }

  return params;
};

export const filterHotspots = (
  hotspots: readonly SonarHotspotSearchItem[],
  options: Pick<ListOptions, 'filePathIncludes'>
): SonarHotspotSearchItem[] => {
  if (!options.filePathIncludes) {
    return [...hotspots];
  }

  return hotspots.filter((hotspot) => hotspot.component.includes(options.filePathIncludes!));
};

export const fetchHotspots = async (options: ListOptions): Promise<SonarHotspotSearchItem[]> => {
  const hotspots: SonarHotspotSearchItem[] = [];
  const totalPages = options.maxPages ?? 1;

  for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
    const searchParams = buildListSearchParams(options, pageIndex);
    const response = await fetch(`${options.baseUrl}/hotspots/search?${searchParams.toString()}`, {
      headers: createHeaders(options.token),
    });
    await ensureOk(response);

    const payload = (await response.json()) as SonarHotspotSearchResponse;
    const items = filterHotspots(payload.hotspots ?? [], options);
    hotspots.push(...items);

    const total = payload.paging?.total ?? hotspots.length;
    const pageSize = payload.paging?.pageSize ?? options.pageSize;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    if (pageIndex >= pageCount) {
      break;
    }
  }

  return hotspots;
};

export const fetchHotspot = async (options: ShowOptions): Promise<SonarHotspotDetails> => {
  const params = new URLSearchParams({ hotspot: options.hotspotKey });
  const response = await fetch(`${options.baseUrl}/hotspots/show?${params.toString()}`, {
    headers: createHeaders(options.token),
  });
  await ensureOk(response);
  return (await response.json()) as SonarHotspotDetails;
};

export const buildIssueSearchParams = (options: IssueListOptions, pageIndex: number): URLSearchParams => {
  const params = new URLSearchParams({
    projects: options.projectKey,
    p: String(pageIndex),
    ps: String(options.pageSize),
  });

  if (options.branch) {
    params.set('branch', options.branch);
  }
  if (options.pullRequest) {
    params.set('pullRequest', options.pullRequest);
  }
  if (options.statuses) {
    params.set('issueStatuses', options.statuses);
  }
  if (options.severities) {
    params.set('severities', options.severities);
  }
  if (options.types) {
    params.set('types', options.types);
  }
  if (options.rules) {
    params.set('rules', options.rules);
  }
  if (options.impactSeverities) {
    params.set('impactSeverities', options.impactSeverities);
  }
  if (options.assignees) {
    params.set('assignees', options.assignees);
  }

  return params;
};

export const filterIssues = (
  issues: readonly SonarIssueSearchItem[],
  options: Pick<IssueListOptions, 'filePathIncludes'>
): SonarIssueSearchItem[] => {
  if (!options.filePathIncludes) {
    return [...issues];
  }

  const filePathIncludes = options.filePathIncludes;
  return issues.filter((issue) => issue.component.includes(filePathIncludes));
};

export const fetchIssues = async (options: IssueListOptions): Promise<SonarIssueSearchItem[]> => {
  const issues: SonarIssueSearchItem[] = [];
  const totalPages = options.maxPages ?? 1;

  for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
    const searchParams = buildIssueSearchParams(options, pageIndex);
    const response = await fetch(`${options.baseUrl}/issues/search?${searchParams.toString()}`, {
      headers: createHeaders(options.token),
    });
    await ensureOk(response);

    const payload = (await response.json()) as SonarIssueSearchResponse;
    const items = filterIssues(payload.issues ?? [], options);
    issues.push(...items);

    const total = payload.paging?.total ?? issues.length;
    const pageSize = payload.paging?.pageSize ?? options.pageSize;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    if (pageIndex >= pageCount) {
      break;
    }
  }

  return issues;
};

export const fetchIssue = async (options: IssueShowOptions): Promise<SonarIssueDetails> => {
  const params = new URLSearchParams({ issue: options.issueKey });
  const response = await fetch(`${options.baseUrl}/issues/show?${params.toString()}`, {
    headers: createHeaders(options.token),
  });
  await ensureOk(response);
  const payload = (await response.json()) as { issue: SonarIssueDetails };
  return payload.issue;
};

export const reviewHotspot = async (options: ReviewOptions): Promise<void> => {
  const body = new URLSearchParams({
    hotspot: options.hotspotKey,
    status: options.status,
    resolution: options.resolution,
    comment: options.comment,
  });

  const response = await fetch(`${options.baseUrl}/hotspots/change_status`, {
    method: 'POST',
    headers: {
      ...createHeaders(options.token),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  await ensureOk(response);
};

export const transitionIssue = async (options: IssueTransitionOptions): Promise<void> => {
  const body = new URLSearchParams({
    issue: options.issueKey,
    transition: options.transition,
  });
  if (options.comment) {
    body.set('comment', options.comment);
  }

  const response = await fetch(`${options.baseUrl}/issues/do_transition`, {
    method: 'POST',
    headers: {
      ...createHeaders(options.token),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  await ensureOk(response);
};

export const commentIssue = async (options: IssueCommentOptions): Promise<void> => {
  const body = new URLSearchParams({
    issue: options.issueKey,
    text: options.comment,
  });

  const response = await fetch(`${options.baseUrl}/issues/add_comment`, {
    method: 'POST',
    headers: {
      ...createHeaders(options.token),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  await ensureOk(response);
};

export const formatListTable = (hotspots: readonly SonarHotspotSearchItem[]): string => {
  if (hotspots.length === 0) {
    return 'Keine Hotspots gefunden.';
  }

  const lines = hotspots.map((hotspot) => {
    const location = hotspot.line ? `${hotspot.component}:${hotspot.line}` : hotspot.component;
    const status = hotspot.status ?? 'UNKNOWN';
    const probability = hotspot.vulnerabilityProbability ?? '-';
    const ruleKey = hotspot.ruleKey ?? '-';
    return `${hotspot.key}\t${status}\t${probability}\t${ruleKey}\t${location}`;
  });

  return ['key\tstatus\tprobability\trule\tlocation', ...lines].join('\n');
};

const escapeCsvField = (value: string): string => {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
};

export const formatListCsv = (hotspots: readonly SonarHotspotSearchItem[]): string => {
  const header = ['key', 'status', 'probability', 'rule', 'component', 'line', 'message'];
  const rows = hotspots.map((hotspot) =>
    [
      hotspot.key,
      hotspot.status ?? '',
      hotspot.vulnerabilityProbability ?? '',
      hotspot.ruleKey ?? '',
      hotspot.component,
      hotspot.line !== undefined ? String(hotspot.line) : '',
      hotspot.message ?? '',
    ]
      .map(escapeCsvField)
      .join(',')
  );

  return [header.join(','), ...rows].join('\n');
};

export const formatIssueTable = (issues: readonly SonarIssueSearchItem[]): string => {
  if (issues.length === 0) {
    return 'Keine Issues gefunden.';
  }

  const lines = issues.map((issue) => {
    const location = issue.line ? `${issue.component}:${issue.line}` : issue.component;
    return `${issue.key}\t${issue.status ?? '-'}\t${issue.severity ?? '-'}\t${issue.type ?? '-'}\t${issue.rule ?? '-'}\t${location}`;
  });

  return ['key\tstatus\tseverity\ttype\trule\tlocation', ...lines].join('\n');
};

export const formatIssueCsv = (issues: readonly SonarIssueSearchItem[]): string => {
  const header = ['key', 'status', 'severity', 'type', 'rule', 'component', 'line', 'message'];
  const rows = issues.map((issue) =>
    [
      issue.key,
      issue.status ?? '',
      issue.severity ?? '',
      issue.type ?? '',
      issue.rule ?? '',
      issue.component,
      issue.line !== undefined ? String(issue.line) : '',
      issue.message ?? '',
    ]
      .map(escapeCsvField)
      .join(',')
  );

  return [header.join(','), ...rows].join('\n');
};

export const formatHotspotDetails = (hotspot: SonarHotspotDetails): string => {
  const commentLines = (hotspot.comments ?? []).map((comment) => `- ${comment.createdAt ?? 'unbekannt'}: ${comment.markdown}`);

  return [
    `key: ${hotspot.key}`,
    `component: ${hotspot.component}`,
    `line: ${hotspot.line ?? '-'}`,
    `status: ${hotspot.status ?? '-'}`,
    `resolution: ${hotspot.resolution ?? '-'}`,
    `securityCategory: ${hotspot.securityCategory ?? '-'}`,
    `probability: ${hotspot.vulnerabilityProbability ?? '-'}`,
    `rule: ${hotspot.rule?.key ?? '-'}${hotspot.rule?.name ? ` (${hotspot.rule.name})` : ''}`,
    `message: ${hotspot.message ?? '-'}`,
    hotspot.rule?.fixRecommendations ? `fixRecommendations: ${hotspot.rule.fixRecommendations}` : 'fixRecommendations: -',
    commentLines.length > 0 ? `comments:\n${commentLines.join('\n')}` : 'comments: -',
  ].join('\n');
};

export const formatIssueDetails = (issue: SonarIssueDetails): string => {
  const commentLines = (issue.comments ?? []).map((comment) => `- ${comment.createdAt ?? 'unbekannt'}: ${comment.markdown ?? ''}`);
  const impacts = (issue.impacts ?? []).map((impact) => `${impact.softwareQuality ?? 'unknown'}:${impact.severity ?? 'unknown'}`);

  return [
    `key: ${issue.key}`,
    `component: ${issue.component}`,
    `line: ${issue.line ?? '-'}`,
    `status: ${issue.status ?? '-'}`,
    `severity: ${issue.severity ?? '-'}`,
    `type: ${issue.type ?? '-'}`,
    `rule: ${issue.rule ?? '-'}`,
    `assignee: ${issue.assignee ?? '-'}`,
    `message: ${issue.message ?? '-'}`,
    `impacts: ${impacts.length > 0 ? impacts.join(', ') : '-'}`,
    `transitions: ${issue.transitions?.join(', ') ?? '-'}`,
    commentLines.length > 0 ? `comments:\n${commentLines.join('\n')}` : 'comments: -',
  ].join('\n');
};

export const run = async (argv: readonly string[]): Promise<number> => {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage);
    return 0;
  }

  const command = parseCommand(argv);

  if (command.command === 'list') {
    const hotspots = await fetchHotspots(command);
    if (command.output === 'json') {
      console.log(JSON.stringify(hotspots, null, 2));
      return 0;
    }
    if (command.output === 'csv') {
      console.log(formatListCsv(hotspots));
      return 0;
    }
    console.log(formatListTable(hotspots));
    return 0;
  }

  if (command.command === 'issues:list') {
    const issues = await fetchIssues(command);
    if (command.output === 'json') {
      console.log(JSON.stringify(issues, null, 2));
      return 0;
    }
    if (command.output === 'csv') {
      console.log(formatIssueCsv(issues));
      return 0;
    }
    console.log(formatIssueTable(issues));
    return 0;
  }

  if (command.command === 'show') {
    const hotspot = await fetchHotspot(command);
    console.log(command.json ? JSON.stringify(hotspot, null, 2) : formatHotspotDetails(hotspot));
    return 0;
  }

  if (command.command === 'issues:show') {
    const issue = await fetchIssue(command);
    console.log(command.json ? JSON.stringify(issue, null, 2) : formatIssueDetails(issue));
    return 0;
  }

  if (command.command === 'issues:transition') {
    await transitionIssue(command);
    console.log(`Issue ${command.issueKey} mit Transition ${command.transition} aktualisiert.`);
    return 0;
  }

  if (command.command === 'issues:comment') {
    await commentIssue(command);
    console.log(`Kommentar zu Issue ${command.issueKey} hinzugefügt.`);
    return 0;
  }

  if (command.command === 'review') {
    await reviewHotspot(command);
    console.log(
      `Hotspot ${command.hotspotKey} als ${command.status}/${command.resolution} markiert.`
    );
    return 0;
  }

  for (const hotspotKey of command.hotspotKeys) {
    await reviewHotspot({
      command: 'review',
      baseUrl: command.baseUrl,
      token: command.token,
      hotspotKey,
      status: command.status,
      resolution: command.resolution,
      comment: command.comment,
    });
  }
  console.log(
    `${command.hotspotKeys.length} Hotspots als ${command.status}/${command.resolution} markiert.`
  );
  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).catch((reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.error(message);
    process.exit(1);
  });
}
