import { z } from 'zod';

const createJsonObjectFieldSchema = (message: string) =>
  z.string().superRefine((value: string, ctx) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return;
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        ctx.addIssue({ code: 'custom', message });
      }
    } catch {
      ctx.addIssue({ code: 'custom', message });
    }
  });

const createOptionalNumberStringSchema = (message: string) =>
  z.string().superRefine((value: string, ctx) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return;
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) === false) {
      ctx.addIssue({ code: 'custom', message });
    }
  });

const createOptionalHttpsUrlSchema = (message: string) =>
  z.string().superRefine((value: string, ctx) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:') {
        ctx.addIssue({ code: 'custom', message });
      }
    } catch {
      ctx.addIssue({ code: 'custom', message });
    }
  });

export const genericItemsDetailFormSchema = z.object({
  title: z.string().trim().min(1, 'Titel ist erforderlich.'),
  genericType: z.string().trim().min(1, 'Generic-Type ist erforderlich.'),
  teaser: z.string(),
  visible: z.boolean(),
  author: z.string(),
  keywords: z.string(),
  externalId: z.string(),
  publicationDate: z.string(),
  publishedAt: z.string(),
  categories: z.array(z.string()).superRefine((values, ctx) => {
    if (values.some((value) => value.trim().length === 0 || value.trim().length > 128)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Kategorien benötigen einen Namen mit maximal 128 Zeichen.',
      });
    }
  }),
  contacts: z.array(
    z.object({
      firstName: z.string(),
      lastName: z.string(),
      email: z.string(),
      phone: z.string(),
    })
  ),
  webUrls: z.array(
    z.object({
      url: createOptionalHttpsUrlSchema('URLs müssen mit https:// beginnen.'),
      description: z.string(),
    })
  ),
  addresses: z.array(
    z.object({
      addition: z.string(),
      street: z.string(),
      zip: z.string(),
      city: z.string(),
      kind: z.string(),
      latitude: z.string(),
      longitude: z.string(),
    })
  ),
  contentBlocks: z.array(
    z.object({
      title: z.string(),
      intro: z.string(),
      body: z.string(),
    })
  ),
  openingHours: z.array(
    z.object({
      weekday: z.string(),
      dateFrom: z.string(),
      dateTo: z.string(),
      timeFrom: z.string(),
      timeTo: z.string(),
      description: z.string(),
      open: z.boolean(),
    })
  ),
  mediaContents: z.array(
    z.object({
      captionText: z.string(),
      copyright: z.string(),
      contentType: z.string(),
      height: z.string(),
      width: z.string(),
      sourceUrl: z.object({
        // Asset URLs are host-provided and can be non-https in local/editor environments.
        url: z.string(),
        description: z.string(),
      }),
    })
  ),
  locations: z.array(
    z.object({
      name: z.string(),
      department: z.string(),
      district: z.string(),
      regionName: z.string(),
      state: z.string(),
      latitude: z.string(),
      longitude: z.string(),
    })
  ),
  dates: z.array(
    z.object({
      weekday: z.string(),
      dateStart: z.string(),
      dateEnd: z.string(),
      timeStart: z.string(),
      timeEnd: z.string(),
      timeDescription: z.string(),
      useOnlyTimeDescription: z.boolean(),
    })
  ),
  accessibilityInformations: z.array(
    z.object({
      description: z.string(),
      types: z.string(),
      urls: z.array(
        z.object({
          url: createOptionalHttpsUrlSchema('URLs müssen mit https:// beginnen.'),
          description: z.string(),
        })
      ),
    })
  ),
  priceInformations: z.array(
    z.object({
      name: z.string(),
      amount: createOptionalNumberStringSchema('Preisangaben müssen valide Zahlen enthalten.'),
      groupPrice: z.boolean(),
      ageFrom: createOptionalNumberStringSchema('Preisangaben müssen valide Zahlen enthalten.'),
      ageTo: createOptionalNumberStringSchema('Preisangaben müssen valide Zahlen enthalten.'),
      minAdultCount: createOptionalNumberStringSchema('Preisangaben müssen valide Zahlen enthalten.'),
      maxAdultCount: createOptionalNumberStringSchema('Preisangaben müssen valide Zahlen enthalten.'),
      minChildrenCount: createOptionalNumberStringSchema('Preisangaben müssen valide Zahlen enthalten.'),
      maxChildrenCount: createOptionalNumberStringSchema('Preisangaben müssen valide Zahlen enthalten.'),
      description: z.string(),
      category: z.string(),
    })
  ),
  payloadText: createJsonObjectFieldSchema('Payload muss ein JSON-Objekt sein.'),
});

export type GenericItemsDetailFormValues = z.infer<typeof genericItemsDetailFormSchema>;
