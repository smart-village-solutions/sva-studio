import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1);

export const organizationTypeSchema = z.enum(['county', 'municipality', 'district', 'company', 'agency', 'other']);
export const contentAuthorPolicySchema = z.enum(['org_only', 'org_or_personal']);
export const membershipVisibilitySchema = z.enum(['internal', 'external']);

export const createOrganizationSchema = z.object({
  organizationKey: nonEmptyString,
  displayName: nonEmptyString,
  parentOrganizationId: z.string().uuid().optional(),
  organizationType: organizationTypeSchema.default('other'),
  contentAuthorPolicy: contentAuthorPolicySchema.default('org_only'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateOrganizationSchema = z
  .object({
    organizationKey: nonEmptyString.optional(),
    displayName: nonEmptyString.optional(),
    parentOrganizationId: z.string().uuid().nullable().optional(),
    organizationType: organizationTypeSchema.optional(),
    contentAuthorPolicy: contentAuthorPolicySchema.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (value) =>
      value.organizationKey !== undefined ||
      value.displayName !== undefined ||
      value.parentOrganizationId !== undefined ||
      value.organizationType !== undefined ||
      value.contentAuthorPolicy !== undefined ||
      value.metadata !== undefined,
    { message: 'at_least_one_field_required' }
  );

export const assignOrganizationMembershipSchema = z.object({
  accountId: z.string().uuid(),
  isDefaultContext: z.boolean().optional(),
  visibility: membershipVisibilitySchema.optional(),
});

export const updateOrganizationContextSchema = z.object({
  organizationId: z.string().uuid(),
});
