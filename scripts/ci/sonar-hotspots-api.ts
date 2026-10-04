import type {
  ListOptions,
  ShowOptions,
  ReviewOptions,
  IssueListOptions,
  IssueShowOptions,
  IssueTransitionOptions,
  IssueCommentOptions,
  SonarHotspotSearchItem,
  SonarHotspotSearchResponse,
  SonarHotspotDetails,
  SonarIssueSearchItem,
  SonarIssueSearchResponse,
  SonarIssueDetails,
} from './sonar-hotspots-types.ts';
import { error } from './sonar-hotspots-parse-shared.ts';

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

  const filePathIncludes = options.filePathIncludes;
  return hotspots.filter((hotspot) => hotspot.component.includes(filePathIncludes));
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

export const buildIssueSearchParams = (
  options: IssueListOptions,
  pageIndex: number
): URLSearchParams => {
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
