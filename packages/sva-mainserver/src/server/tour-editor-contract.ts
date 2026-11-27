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
export const audioInput = z.strictObject({
  id: id.optional(),
  contentType: z.literal('audio'),
  captionText: z.string().trim().max(250).optional(),
  copyright: z.string().trim().max(250).optional(),
  sourceUrl: z.strictObject({
    url: z.string().trim().min(1).max(2048),
    description: z.string().max(250).optional(),
  }),
});
const ownAudio = z.array(audioInput).max(20);
const toTourAudioInput = (media: z.output<typeof ownAudio>) =>
  media.map(({ contentType, captionText, copyright, sourceUrl }) => ({
    contentType,
    captionText,
    copyright,
    sourceUrl,
  }));
const readAudio = z.array(
  z.object({
    id,
    contentType: z.literal('audio'),
    captionText: z.string().nullish(),
    copyright: z.string().nullish(),
    sourceUrl: z.object({ url: z.string().nullish(), description: z.string().nullish() }).nullish(),
  })
);
const patchInput = z
  .strictObject({
    name: name.optional(),
    lengthKm: lengthKm.optional(),
    description: description.optional(),
    mediaContents: ownAudio.optional(),
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
            mediaContents: ownAudio.optional(),
          })
          .refine((stop) => Boolean(stop.id || stop.name))
      )
      .max(200)
      .optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0);
export const updateInput = z.strictObject({ expectedRevision: revision, patch: patchInput });

export const toTourEditVariables = (id: string, input: z.output<typeof updateInput>) => {
  const { mediaContents, tourStops, ...fields } = input.patch;
  return {
    id,
    expectedRevision: input.expectedRevision,
    ...fields,
    ...(mediaContents === undefined ? {} : { mediaContents: toTourAudioInput(mediaContents) }),
    ...(tourStops === undefined
      ? {}
      : {
          tourStops: tourStops.map(({ mediaContents: audio, ...stop }) =>
            audio === undefined ? stop : { ...stop, mediaContents: toTourAudioInput(audio) }
          ),
        }),
  };
};

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
  mediaContents: readAudio,
  tourStops: z.array(
    z.object({
      id,
      name: z.string().nullable(),
      description: z.string().nullable(),
      geoLocation: readCoordinate.nullable(),
      mediaContents: readAudio,
      inheritedPoiMediaContents: readAudio,
    })
  ),
});
export const readResult = z.object({ editableTour: editableTour.nullable() });
export type TourEditorSnapshot = z.output<typeof editableTour>;
export const updateResult = z.object({ createTour: z.object({ editorialSnapshot: editableTour }) });
const audioFields = 'id contentType captionText copyright sourceUrl { url description }';
const editorFields = `
  id revision name lengthKm description
  dataProvider { id name }
  geometryTourData { latitude longitude }
  mediaContents { ${audioFields} }
  tourStops {
    id name description geoLocation { latitude longitude }
    mediaContents { ${audioFields} }
    inheritedPoiMediaContents { ${audioFields} }
  }
`;

export const editableTourDocument = `
  query SvaMainserverEditableTour($id: ID!) {
    editableTour(id: $id) { ${editorFields} }
  }
`;

export const editTourDocument = `
  mutation SvaMainserverEditTour(
    $id: ID!, $expectedRevision: String!, $name: String, $lengthKm: Int,
    $description: String, $geometryTourData: [GeoLocationInput!], $tourStops: [TourStopInput!],
    $mediaContents: [MediaContentInput!]
  ) {
    createTour(
      id: $id, expectedRevision: $expectedRevision, name: $name, lengthKm: $lengthKm,
      description: $description, geometryTourData: $geometryTourData, tourStops: $tourStops,
      mediaContents: $mediaContents
    ) {
      editorialSnapshot { ${editorFields} }
    }
  }
`;
