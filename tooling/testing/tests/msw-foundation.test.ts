import { describe, expect, it } from 'vitest';

import { HttpResponse, http, resetStudioMswHandlers, studioMswServer } from '../src/msw/index.ts';

describe('studio MSW foundation', () => {
  it('resets runtime handler overrides back to the base handlers', async () => {
    const responseBeforeOverride = await fetch('https://studio.test/health');
    expect(responseBeforeOverride.status).toBe(200);
    expect(await responseBeforeOverride.json()).toEqual({ status: 'base' });

    studioMswServer.use(
      http.get('https://studio.test/health', () => {
        return HttpResponse.json({ status: 'overridden' }, { status: 200 });
      })
    );

    const overriddenResponse = await fetch('https://studio.test/health');
    expect(overriddenResponse.status).toBe(200);
    expect(await overriddenResponse.json()).toEqual({ status: 'overridden' });

    resetStudioMswHandlers();

    const responseAfterReset = await fetch('https://studio.test/health');
    expect(responseAfterReset.status).toBe(200);
    expect(await responseAfterReset.json()).toEqual({ status: 'base' });
  });
});
