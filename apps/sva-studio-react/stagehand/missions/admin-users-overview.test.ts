import { describe, expect, it } from 'vitest';

import { createMissionPrompt } from './admin-users-overview.ts';
import { getStagehandMissionStories } from '../stories/catalog.ts';

describe('admin-users-overview mission', () => {
  it('pins the admin users route, success criteria, and story basis', () => {
    const prompt = createMissionPrompt({
      startUrl: 'http://127.0.0.1:3000/admin/users',
      stories: getStagehandMissionStories('admin-users-overview'),
    });

    expect(prompt).toContain('/admin/users');
    expect(prompt).toContain('Login');
    expect(prompt).toContain('Forbidden');
    expect(prompt).toContain('Benutzerliste');
    expect(prompt).toContain('Leerzustand');
    expect(prompt).toContain('Story 18');
    expect(prompt).toContain('Story 19');
    expect(prompt).toContain('Mandanten');
  });
});
