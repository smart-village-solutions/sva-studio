import { isSsfTranslationLocaleList, type SsfTranslationTarget } from '@sva/core';
import { z } from 'zod';

export const ssfInterfaceDraftSchema = z
  .object({
    type: z.literal('ssf_translation'),
    name: z.string().trim().min(1).max(120),
    enabled: z.boolean(),
    config: z
      .object({
        origin: z.string().trim().min(1).max(512),
        apiKey: z.string().max(4096),
        revision: z.string().min(1).max(128),
        selectedLocales: z.custom<SsfTranslationTarget[]>(isSsfTranslationLocaleList),
      })
      .strict(),
  })
  .strict();
