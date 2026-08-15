import type { AcceptanceFailureCode, AcceptanceStepRecord } from './iam-acceptance.ts';

export type ApiResponse = {
  json: () => Promise<unknown>;
  status: () => number;
};

export type Locator = {
  click: () => Promise<void>;
  count: () => Promise<number>;
  fill: (value: string) => Promise<void>;
  first: () => Locator;
  isVisible: () => Promise<boolean>;
};

export type Page = {
  close: () => Promise<void>;
  context: () => BrowserContext;
  getByLabel: (text: string) => Locator;
  getByRole: (role: string, options?: { exact?: boolean; name?: string | RegExp }) => Locator;
  getByText: (text: string | RegExp) => Locator;
  goto: (
    url: string,
    options?: { waitUntil?: 'domcontentloaded' | 'load'; timeout?: number }
  ) => Promise<unknown>;
  locator: (selector: string) => Locator;
  waitForLoadState: (state?: 'domcontentloaded' | 'load' | 'networkidle') => Promise<void>;
  waitForURL: (url: string | RegExp, options?: { timeout?: number }) => Promise<void>;
};

export type BrowserContext = {
  close: () => Promise<void>;
  newPage: () => Promise<Page>;
  request: {
    delete: (
      url: string,
      options?: { failOnStatusCode?: boolean; headers?: Record<string, string> }
    ) => Promise<ApiResponse>;
    get: (
      url: string,
      options?: { failOnStatusCode?: boolean; headers?: Record<string, string> }
    ) => Promise<ApiResponse>;
    patch: (
      url: string,
      options: { data: unknown; failOnStatusCode?: boolean; headers?: Record<string, string> }
    ) => Promise<ApiResponse>;
    post: (
      url: string,
      options: { data?: unknown; failOnStatusCode?: boolean; headers?: Record<string, string> }
    ) => Promise<ApiResponse>;
  };
};

export type Browser = {
  close: () => Promise<void>;
  newContext: () => Promise<BrowserContext>;
};

export type BrowserModule = {
  chromium: {
    launch: (options?: { headless?: boolean }) => Promise<Browser>;
  };
};

export type PoolClient = {
  query: <T>(
    text: string,
    values?: readonly unknown[]
  ) => Promise<{ rowCount: number | null; rows: T[] }>;
  release: () => void;
};

export type Pool = {
  connect: () => Promise<PoolClient>;
  end: () => Promise<void>;
  query: <T>(
    text: string,
    values?: readonly unknown[]
  ) => Promise<{ rowCount: number | null; rows: T[] }>;
};

export type PgModule = {
  Pool: new (options: { connectionString: string }) => Pool;
};

export type AcceptanceRecorder = {
  readonly failStep: (input: {
    details: string;
    failureCode: AcceptanceFailureCode;
    metadata?: Readonly<Record<string, unknown>>;
    name: string;
  }) => never;
  readonly recordStep: (step: AcceptanceStepRecord) => AcceptanceStepRecord;
  readonly steps: readonly AcceptanceStepRecord[];
};

export const createAcceptanceRecorder = (): AcceptanceRecorder => {
  const steps: AcceptanceStepRecord[] = [];
  const recordStep = (step: AcceptanceStepRecord): AcceptanceStepRecord => {
    steps.push(step);
    const statusLabel = step.status.toUpperCase();
    const detailSuffix = step.details ? `: ${step.details}` : '';
    console.log(`[iam-acceptance] ${statusLabel} ${step.name}${detailSuffix}`);
    return step;
  };
  const failStep: AcceptanceRecorder['failStep'] = (input): never => {
    recordStep({
      name: input.name,
      status: 'failed',
      details: input.details,
      failureCode: input.failureCode,
      metadata: input.metadata,
    });
    throw new Error(`${input.failureCode}: ${input.details}`);
  };
  return { failStep, recordStep, steps };
};

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
} as const;

export const buildMutationHeaders = (
  baseUrl: string,
  idempotencyKey?: string
): Record<string, string> => {
  const origin = new URL(baseUrl).origin;
  return {
    ...JSON_HEADERS,
    Origin: origin,
    Referer: `${origin}/`,
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  };
};

export const fetchJson = async <T>(response: ApiResponse): Promise<T> =>
  response.json() as Promise<T>;

export const requestJson = async <T>(
  recorder: AcceptanceRecorder,
  response: ApiResponse,
  input: {
    details: string;
    failureCode: AcceptanceFailureCode;
    expectedStatus: number;
    name: string;
  }
): Promise<T> => {
  if (response.status() !== input.expectedStatus) {
    recorder.failStep({
      name: input.name,
      failureCode: input.failureCode,
      details: `${input.details} (HTTP ${response.status()})`,
    });
  }
  return fetchJson<T>(response);
};

export const expectVisible = async (
  recorder: AcceptanceRecorder,
  locator: Locator,
  input: { details: string; failureCode: AcceptanceFailureCode; name: string }
): Promise<void> => {
  const visible = await locator.isVisible().catch(() => false);
  if (!visible) {
    recorder.failStep(input);
  }
};
