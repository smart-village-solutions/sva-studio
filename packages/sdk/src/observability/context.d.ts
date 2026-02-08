export interface WorkspaceContext {
    workspaceId?: string;
    requestId?: string;
    userId?: string;
    sessionId?: string;
}
export declare const runWithWorkspaceContext: <T>(context: WorkspaceContext, fn: () => T) => T;
export declare const getWorkspaceContext: () => WorkspaceContext;
export declare const setWorkspaceContext: (context: WorkspaceContext) => void;
export declare class MissingWorkspaceIdError extends Error {
    constructor(message?: string);
}
export interface WorkspaceMiddlewareOptions {
    headerNames?: string[];
    environment?: 'development' | 'production' | 'test';
}
export type WorkspaceMiddleware = (req: {
    headers?: Record<string, string | string[] | undefined>;
}, res: unknown, next: (error?: Error) => void) => void;
export declare const extractWorkspaceId: (headers: Record<string, string | string[] | undefined> | undefined, headerNames: string[]) => string | undefined;
export declare const createWorkspaceContextMiddleware: (options?: WorkspaceMiddlewareOptions) => WorkspaceMiddleware;
//# sourceMappingURL=context.d.ts.map