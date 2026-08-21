import { mediaLiterals } from '@sva/media';
import { z } from 'zod';

const instanceIdSchema = z.string().trim().min(1).optional();
const visibilitySchema = z.enum(mediaLiterals.visibilities);

const editableMetadataSchema = z.object({
  title: z.string().trim().min(1).max(512).nullable().optional(),
  description: z.string().trim().min(1).max(5000).nullable().optional(),
  altText: z.string().trim().min(1).max(512).nullable().optional(),
  copyright: z.string().trim().min(1).max(512).nullable().optional(),
  license: z.string().trim().min(1).max(512).nullable().optional(),
});

export const uploadInitializationSchema = z
  .object({
    instanceId: instanceIdSchema,
    mediaType: z.literal(mediaLiterals.types[0]).default(mediaLiterals.types[0]),
    mimeType: z.string().trim().min(1),
    byteSize: z.number().int().positive(),
    visibility: visibilitySchema.default('public'),
    uploadContext: z.enum(['library', 'content-save']).default('library'),
    contentSaveOperationId: z.string().uuid().optional(),
    draftId: z.string().uuid().optional(),
  })
  .refine(
    ({ uploadContext, contentSaveOperationId, draftId }) =>
      uploadContext === 'content-save'
        ? Boolean(contentSaveOperationId) && Boolean(draftId)
        : !contentSaveOperationId && !draftId,
    'Content-Save-Uploads benötigen Operations- und Draft-ID; Library-Uploads dürfen sie nicht enthalten.'
  );

export const contentSaveOperationCreateSchema = z.object({
  operationId: z.string().uuid(),
  instanceId: instanceIdSchema,
  targetType: z.string().trim().min(1).max(128),
});

export const contentSaveOperationReferencesSchema = z.object({
  instanceId: instanceIdSchema,
  references: z.array(
    z.object({
      id: z.string().uuid().optional(),
      assetId: z.string().uuid(),
      role: z.string().trim().min(1),
      sortOrder: z.number().int().nonnegative().optional(),
    })
  ),
});

export const contentSaveOperationContentSavedSchema = z.object({
  instanceId: instanceIdSchema,
  targetId: z.string().trim().min(1),
});

export const contentSaveOperationCommandSchema = z.object({
  instanceId: instanceIdSchema,
  errorCode: z.string().trim().min(1).max(128).optional(),
});

export const registerBucketMediaSchema = z.object({
  instanceId: instanceIdSchema,
  storageKey: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  byteSize: z.number().int().nonnegative(),
  mimeType: z.string().trim().min(1),
  visibility: visibilitySchema.default('public'),
  metadata: editableMetadataSchema.partial().optional(),
});

export const metadataUpdateSchema = z.object({
  instanceId: instanceIdSchema,
  visibility: visibilitySchema.optional(),
  metadata: editableMetadataSchema
    .extend({
      focusPoint: z
        .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
        .nullable()
        .optional(),
      crop: z
        .object({
          x: z.number().min(0),
          y: z.number().min(0),
          width: z.number().positive(),
          height: z.number().positive(),
        })
        .nullable()
        .optional(),
    })
    .partial()
    .refine(
      (value) => Object.keys(value).length > 0,
      'metadata: Mindestens ein Metadatenfeld ist erforderlich.'
    ),
});

export const replaceReferencesSchema = z.object({
  instanceId: instanceIdSchema,
  targetType: z.string().trim().min(1),
  targetId: z.string().trim().min(1),
  references: z.array(
    z.object({
      id: z.string().trim().min(1).optional(),
      assetId: z.string().trim().min(1),
      role: z.string().trim().min(1),
      sortOrder: z.number().int().nonnegative().optional(),
    })
  ),
});
