import { createOperationLogger, logBrowserOperationStart } from '../lib/browser-operation-logging';
import { isDevelopmentBrowserEnv } from '../lib/browser-env';

const sidebarLogger = createOperationLogger('sidebar', 'debug');
export { sidebarLogger };

export const logSidebarDebug = (eventName: string, meta: Record<string, unknown>) => {
  if (!isDevelopmentBrowserEnv()) {
    return;
  }

  logBrowserOperationStart(sidebarLogger, eventName, meta);
};
