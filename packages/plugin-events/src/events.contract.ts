import { z } from 'zod';

/**
 * Participation fields of the event write contract. The limit is a GraphQL `Int`; `null` clears
 * it. The host validates the same rule, and a contract test in @sva/sva-mainserver keeps both
 * schemas aligned.
 */
export const eventParticipationSchema = z.object({
  registrationRequired: z.boolean().optional(),
  maximumAttendees: z.number().int().min(0).max(2_147_483_647).nullable().optional(),
});
