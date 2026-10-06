import { describe, expect, it } from 'vitest';

import {
  isPersonalApiRequestAuthenticated,
  markPersonalApiRequestAuthenticated,
} from '../personal-api-request-state.js';
import { validateCsrf } from './csrf.js';

describe('IAM CSRF validation', () => {
  it('skips browser CSRF checks only for a request marked after personal bearer verification', () => {
    const request = new Request('https://tenant.example/api/v1/iam/users', { method: 'POST' });
    expect(validateCsrf(request)).not.toBeNull();
    expect(isPersonalApiRequestAuthenticated(request)).toBe(false);

    markPersonalApiRequestAuthenticated(request);

    expect(isPersonalApiRequestAuthenticated(request)).toBe(true);
    expect(validateCsrf(request)).toBeNull();
  });
});
