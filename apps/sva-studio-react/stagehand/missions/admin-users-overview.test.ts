import { describe, expect, it } from 'vitest';

import { createMissionPrompt } from './admin-users-overview.ts';

describe('admin-users-overview mission', () => {
  it('pins the admin users route and success criteria', () => {
    const prompt = createMissionPrompt({
      startUrl: 'http://127.0.0.1:3000/admin/users',
    });

    expect(prompt).toContain('/admin/users');
    expect(prompt).toContain('Login');
    expect(prompt).toContain('Forbidden');
    expect(prompt).toContain('Benutzerliste');
    expect(prompt).toContain('Leerzustand');
  });
});
