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
