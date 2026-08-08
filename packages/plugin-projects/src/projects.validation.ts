import { z } from 'zod';

import { projectStatuses } from './projects.api-types.js';

const requiredText = (message: string) => z.string().trim().min(1, message);

export const projectImageSchema = z.object({
  url: requiredText('Bild-URL ist erforderlich.'),
  altText: requiredText('Alternativtext ist erforderlich.'),
  caption: z.string().trim().optional(),
  credits: z.string().trim().optional(),
  position: z.number().int().nonnegative(),
});

export const projectFormSchema = z
  .object({
    language: z.string().trim(),
    title: requiredText('Titel ist erforderlich.'),
    description: z.string().trim(),
    fullText: z.string().trim(),
    images: z.array(projectImageSchema),
    status: z.enum(projectStatuses),
  })
  .superRefine((value, ctx) => {
    const positions = value.images.map((image) => image.position);
    const expected = positions.map((_, index) => index);
    if (positions.some((position, index) => position !== expected[index])) {
      ctx.addIssue({
        code: 'custom',
        path: ['images'],
        message: 'Bildpositionen müssen lückenlos und bei 0 beginnend sein.',
      });
    }
  });

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
