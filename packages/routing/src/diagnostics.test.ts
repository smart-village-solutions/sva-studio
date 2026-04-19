import { describe, expect, it } from 'vitest';

import { emitRoutingDiagnostic, type RoutingDiagnosticEvent } from './diagnostics';

const testEvent: RoutingDiagnosticEvent = {
  level: 'info',
  event: 'routing.guard.access_denied',
  route: '/account',
  reason: 'unauthenticated',
  redirect_target: '/auth/login',
};

describe('emitRoutingDiagnostic', () => {
  it('swallows rejected promises from async diagnostics hooks', async () => {
    expect(() =>
      emitRoutingDiagnostic((() => Promise.reject(new Error('diagnostics failed'))) as never, testEvent)
    ).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
