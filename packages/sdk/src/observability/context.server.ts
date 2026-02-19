import { AsyncLocalStorage } from 'node:async_hooks';

export interface WorkspaceContext {
  workspaceId?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
}

const workspaceStorage = new AsyncLocalStorage<WorkspaceContext>();

export const runWithWorkspaceContext = <T>(context: WorkspaceContext, fn: () => T): T => {
  return workspaceStorage.run(context, fn);
};

export const getWorkspaceContext = (): WorkspaceContext => {
  return workspaceStorage.getStore() ?? {};
};

export const setWorkspaceContext = (context: WorkspaceContext): void => {
  const current = workspaceStorage.getStore();
  if (!current) {
    return;
  }
  Object.assign(current, context);
};

export class MissingWorkspaceIdError extends Error {
  public constructor(message = 'workspace_id header missing') {
    super(message);
    this.name = 'MissingWorkspaceIdError';
  }
}

export interface WorkspaceMiddlewareOptions {
  headerNames?: string[];
  environment?: 'development' | 'production' | 'test';
}

export type WorkspaceMiddleware = (
  req: { headers?: Record<string, string | string[] | undefined> },
  res: unknown,
  next: (error?: Error) => void
) => void;

export const extractWorkspaceId = (
  headers: Record<string, string | string[] | undefined> | undefined,
  headerNames: string[]
): string | undefined => {
  if (!headers) {
    return undefined;
  }

  for (const headerName of headerNames) {
    const value = headers[headerName.toLowerCase()] ?? headers[headerName];
    if (Array.isArray(value)) {
      if (value.length > 0 && value[0]) {
        return value[0];
      }
      continue;
    }
    if (value) {
      return value;
    }
  }

  return undefined;
};

export const createWorkspaceContextMiddleware = (options: WorkspaceMiddlewareOptions = {}): WorkspaceMiddleware => {
  const headerNames = options.headerNames ?? ['x-workspace-id', 'x-sva-workspace-id'];
  const environment = options.environment ?? (process.env.NODE_ENV as WorkspaceMiddlewareOptions['environment']) ?? 'development';

  // Note: Cannot use SDK logger here due to circular dependency (context.ts is used BY logger)
  const warn = (message: string, meta?: Record<string, unknown>) => {
    if (environment === 'development') {
      console.warn(`[WorkspaceContext] ${message}`, meta ?? {});
    }
  };

  return (req, _res, next): void => {
    const workspaceId = extractWorkspaceId(req.headers, headerNames);

    if (!workspaceId && environment !== 'development') {
      next(new MissingWorkspaceIdError());
      return;
    }

    if (!workspaceId && environment === 'development') {
      warn('workspace_id header missing', {
        header_names: headerNames,
        headers_present: req.headers ? Object.keys(req.headers) : [],
      });
    }

    runWithWorkspaceContext({ workspaceId }, () => {
      next();
    });
  };
};
