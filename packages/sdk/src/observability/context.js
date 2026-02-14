import { AsyncLocalStorage } from 'node:async_hooks';
const workspaceStorage = new AsyncLocalStorage();
export const runWithWorkspaceContext = (context, fn) => {
    return workspaceStorage.run(context, fn);
};
export const getWorkspaceContext = () => {
    return workspaceStorage.getStore() ?? {};
};
export const setWorkspaceContext = (context) => {
    const current = workspaceStorage.getStore();
    if (!current) {
        return;
    }
    Object.assign(current, context);
};
export class MissingWorkspaceIdError extends Error {
    constructor(message = 'workspace_id header missing') {
        super(message);
        this.name = 'MissingWorkspaceIdError';
    }
}
export const extractWorkspaceId = (headers, headerNames) => {
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
export const createWorkspaceContextMiddleware = (options = {}) => {
    const headerNames = options.headerNames ?? ['x-workspace-id', 'x-sva-workspace-id'];
    const environment = options.environment ?? process.env.NODE_ENV ?? 'development';
    // Note: Cannot use SDK logger here due to circular dependency (context.ts is used BY logger)
    const warn = (message, meta) => {
        if (environment === 'development') {
            console.warn(`[WorkspaceContext] ${message}`, meta ?? {});
        }
    };
    return (req, _res, next) => {
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
