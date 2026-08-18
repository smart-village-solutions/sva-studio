import type { PluginWorkerBootstrapLogger } from './plugin-worker-bootstrap-logging.server';

export type WorkspaceContext = { readonly requestId?: string | null };
export type ServerTransportComponent = 'server-entry-transport' | 'server-function-transport';
export type RouteDispatcher = (request: Request) => Promise<Response | null>;
export type RouteDispatchDescriptor = {
  readonly label: string;
  readonly getDispatcher: () => Promise<RouteDispatcher>;
};
export type RequestContextSdk = {
  createSdkLogger(options: {
    readonly component: string;
    readonly level: 'info';
    readonly enableConsole: boolean;
    readonly enableOtel: boolean;
  }): PluginWorkerBootstrapLogger;
  getWorkspaceContext(): WorkspaceContext;
  withRequestContext<T>(
    input: { readonly request: Request; readonly fallbackWorkspaceId: string },
    callback: () => Promise<T>
  ): Promise<T>;
};
