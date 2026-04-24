import { withRequestContext } from '@sva/server-runtime';

import { liveInternal, readyInternal } from './iam-account-management/platform-handlers.js';

const withHealthRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, work);

export const healthReadyHandler = async (request: Request): Promise<Response> =>
  withHealthRequestContext(request, () => readyInternal(request));

export const healthLiveHandler = async (request: Request): Promise<Response> =>
  withHealthRequestContext(request, () => liveInternal(request));
