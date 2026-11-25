import { z } from 'zod';

const meilisearchEnvironments = ['production', 'staging', 'development', 'test'] as const;
export const hasLegacyMeilisearchSource = (instanceId: string): boolean =>
  instanceId === 'bb-guben' || instanceId === 'de-studio-sandbox';

export const meilisearchPublicConfigSchema = z.object({
  origin: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          url.protocol === 'https:' &&
          url.pathname === '/' &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash
        );
      } catch {
        return false;
      }
    }),
  environment: z.enum(meilisearchEnvironments),
  municipalityIds: z
    .string()
    .trim()
    .max(1000)
    .refine((value) => {
      const ids = value.split(',').map((id) => id.trim());
      return (
        ids.length <= 50 &&
        ids.every((id) => /^[1-9][0-9]*$/.test(id) && Number.isSafeInteger(Number(id)))
      );
    }),
});

export const meilisearchInterfaceDraftSchema = z
  .object({
    type: z.literal('meilisearch'),
    name: z.string().trim().min(1).max(120),
    enabled: z.boolean(),
    config: meilisearchPublicConfigSchema
      .extend({
        apiKey: z.string().trim().max(8192).regex(/^\S*$/),
      })
      .strict(),
  })
  .strict();

export type MeilisearchInterfaceFields = Readonly<{
  type: 'meilisearch';
  apiKeyConfigured: boolean;
  config: z.infer<typeof meilisearchPublicConfigSchema>;
}>;

export const emptyMeilisearchDraft = (): z.infer<typeof meilisearchInterfaceDraftSchema> => ({
  type: 'meilisearch',
  name: 'Meilisearch',
  enabled: true,
  config: { origin: '', environment: 'production', municipalityIds: '', apiKey: '' },
});
