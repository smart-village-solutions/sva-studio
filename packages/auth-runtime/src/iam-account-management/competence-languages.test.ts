import { expect, it } from 'vitest';
import { updateUserSchema, updateMyProfileSchema } from './schemas.js';
it('allows managed canonical language edits and explicit clearing, without self-profile writes', () => {
  expect(updateUserSchema.parse({ competenceLanguages: ['DE', 'en-us', 'de'] })).toEqual({
    competenceLanguages: ['de', 'en-US'],
  });
  expect(updateUserSchema.parse({ competenceLanguages: [] })).toEqual({ competenceLanguages: [] });
  expect(updateUserSchema.safeParse({ competenceLanguages: ['not_a_tag'] }).success).toBe(false);
  expect(updateUserSchema.safeParse({ competenceLanguages: Array(41).fill('de') }).success).toBe(
    false
  );
  expect(updateMyProfileSchema.safeParse({ competenceLanguages: ['de'] }).success).toBe(false);
});
