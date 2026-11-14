/** Public, bounded representation of published Studio release notes. */
import { z } from 'zod';

export const STUDIO_RELEASES_URL = 'https://github.com/smart-village-solutions/sva-studio/releases';
export const studioReleaseTagPattern = /^studio-v\d+\.\d+\.\d+$/u;
export const studioReleaseNotesSchema = z
  .array(
    z.object({
      tag: z.string().regex(studioReleaseTagPattern),
      name: z.string().min(1).max(500),
      publishedAt: z.iso.datetime(),
      body: z.string().max(200_000),
    })
  )
  .max(20);
export type StudioReleaseNotes = z.infer<typeof studioReleaseNotesSchema>;
