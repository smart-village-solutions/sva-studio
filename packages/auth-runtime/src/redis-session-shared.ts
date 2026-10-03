import { metrics } from '@opentelemetry/api';
import { createSdkLogger } from '@sva/server-runtime';

import { SessionStoreUnavailableError } from './runtime-errors.js';

export const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });
const meter = metrics.getMeter('sva.auth.sessions');
const sessionOperationsCounter = meter.createCounter('session_operations_total', {
  description: 'Session and login-state operations grouped by operation and result.',
});
const sessionOperationDurationHistogram = meter.createHistogram(
  'session_operation_duration_seconds',
  {
    description: 'Duration of session and login-state operations.',
    unit: 's',
  }
);

const resolveDefaultTestPrefix = (): string => {
  if (process.env.NODE_ENV !== 'test') {
    return '';
  }

  const workerId = process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID;
  return workerId ? `vitest:${workerId}:` : 'vitest:default:';
};

const resolveKeyPrefix = (): string =>
  process.env.SVA_AUTH_REDIS_KEY_PREFIX ?? resolveDefaultTestPrefix();

export const sessionPrefix = () => `${resolveKeyPrefix()}session:`;
export const loginStatePrefix = () => `${resolveKeyPrefix()}login_state:`;
export const sessionControlPrefix = () => `${resolveKeyPrefix()}session_control:`;
export const userSessionIndexPrefix = () => `${resolveKeyPrefix()}user_sessions:`;

export const DEFAULT_SESSION_TTL = 60 * 60 * 24 * 7; // 7 days in seconds
export const DEFAULT_LOGIN_STATE_TTL = 60 * 10; // 10 minutes in seconds
export const DEFAULT_SESSION_CONTROL_TTL = 60 * 60 * 24 * 30; // 30 days in seconds

export const runWithRequiredRedisSessionStore = async <T>(input: {
  operation: string;
  runAgainstRedis: () => Promise<T>;
}): Promise<T> => {
  try {
    return await input.runAgainstRedis();
  } catch (error) {
    logger.error('Redis session store unavailable', {
      operation: input.operation,
      error: error instanceof Error ? error.message : String(error),
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      mode: 'fail_fast',
    });
    throw new SessionStoreUnavailableError(input.operation, error);
  }
};

export const trackSessionOperation = async <T>(operation: string, work: () => Promise<T>): Promise<T> => {
  const startedAt = Date.now();
  try {
    const result = await work();
    sessionOperationsCounter.add(1, { operation, status: 'success' });
    sessionOperationDurationHistogram.record((Date.now() - startedAt) / 1000, { operation });
    return result;
  } catch (error) {
    sessionOperationsCounter.add(1, { operation, status: 'error' });
    sessionOperationDurationHistogram.record((Date.now() - startedAt) / 1000, { operation });
    throw error;
  }
};
