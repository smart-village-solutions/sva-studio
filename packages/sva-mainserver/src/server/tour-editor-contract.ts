import { sanitizeRichTextHtml } from '@sva/core/rich-text-html';
import { z } from 'zod';

const name = z.string().trim().min(1).max(250);
const lengthKm = z.number().int().min(0).max(2_147_483_647);
const description = z.string().max(100_000).transform(sanitizeRichTextHtml).nullable();
const coordinate = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
const id = z.string().trim().min(1).max(250);
const revision = z.string().min(1).max(256);
const patchInput = z
  .strictObject({
    name: name.optional(),
    lengthKm: lengthKm.optional(),
    description: description.optional(),
    geometryTourData: z
      .array(coordinate)
      .max(10_000)
      .refine((points) => points.length !== 1)
      .optional(),
    tourStops: z
      .array(
        z
          .strictObject({
            id: id.optional(),
            name: name.optional(),
            description: description.optional(),
            geoLocation: coordinate.nullable().optional(),
          })
          .refine((stop) => Boolean(stop.id || stop.name))
      )
      .max(200)
      .optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0);
export const updateInput = z.strictObject({ expectedRevision: revision, patch: patchInput });

const readCoordinate = z.object({
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});
const editableTour = z.object({
  id,
  revision,
  name: z.string().nullable(),
  lengthKm: z.number().int().nullable(),
  description: z.string().nullable(),
  dataProvider: z.object({
    id,
    name: z
      .string()
      .nullable()
      .transform((value) => value ?? undefined),
  }),
  geometryTourData: z.array(readCoordinate),
  tourStops: z.array(
    z.object({
      id,
      name: z.string().nullable(),
      description: z.string().nullable(),
      geoLocation: readCoordinate.nullable(),
    })
  ),
});
export const readResult = z.object({ editableTour: editableTour.nullable() });
export const updateResult = z.object({ updateTour: editableTour });
const editorFields = `
  id revision name lengthKm description
  dataProvider { id name }
  geometryTourData { latitude longitude }
  tourStops { id name description geoLocation { latitude longitude } }
`;

export const editableTourDocument = `
  query SvaMainserverEditableTour($id: ID!) {
    editableTour(id: $id) { ${editorFields} }
  }
`;

export const updateTourDocument = `
  mutation SvaMainserverUpdateTour($id: ID!, $expectedRevision: String!, $patch: TourEditorialPatchInput!) {
    updateTour(id: $id, expectedRevision: $expectedRevision, patch: $patch) { ${editorFields} }
  }
`;
