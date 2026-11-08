import { z } from 'zod';
import { ValidateNotSelfIntersecting } from 'terra-draw';

const position = z.tuple([
  z
    .number()
    .finite()
    .min(-180)
    .max(180)
    .transform((n) => Math.round(n * 1e6) / 1e6),
  z
    .number()
    .finite()
    .min(-90)
    .max(90)
    .transform((n) => Math.round(n * 1e6) / 1e6),
]);
const positions = z.array(position).max(500);
const feature = z
  .object({
    type: z.literal('Feature'),
    id: z.uuidv4(),
    properties: z.object({}).strict(),
    geometry: z.discriminatedUnion('type', [
      z.object({ type: z.literal('LineString'), coordinates: positions.min(2) }).strict(),
      z.object({ type: z.literal('Polygon'), coordinates: z.tuple([positions.min(4)]) }).strict(),
    ]),
  })
  .strict();
const equal = (a: number[], b: number[]) => a[0] === b[0] && a[1] === b[1];
export const constructionSiteGeometrySchema = z
  .object({
    version: z.literal(1),
    type: z.literal('FeatureCollection'),
    features: z.array(feature).min(1).max(10),
  })
  .strict()
  .superRefine((value, ctx) => {
    const invalid = () => ctx.addIssue({ code: 'custom', message: 'invalid_geometry' });
    if (new Set(value.features.map((f) => f.id)).size !== value.features.length) invalid();
    let count = 0;
    for (const f of value.features) {
      const points =
        f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates;
      count += points.length;
      if (points.length < (f.geometry.type === 'Polygon' ? 4 : 2)) {
        invalid();
        continue;
      }
      if (points.some((p, i) => i > 0 && equal(p, points[i - 1]!))) invalid();
      if (f.geometry.type === 'Polygon') {
        if (!equal(points[0]!, points[points.length - 1]!)) invalid();
        const area = points.slice(0, -1).reduce((sum, p, i) => {
          const next = points[i + 1]!;
          return sum + p[0] * next[1] - next[0] * p[1];
        }, 0);
        if (area === 0 || !ValidateNotSelfIntersecting(f).valid) invalid();
      }
    }
    if (count > 1000 || new TextEncoder().encode(JSON.stringify(value)).length > 48 * 1024)
      invalid();
  })
  .transform((value) => {
    for (const f of value.features) {
      if (f.geometry.type !== 'Polygon') continue;
      const ring = f.geometry.coordinates[0];
      const area = ring.slice(0, -1).reduce((sum, p, i) => {
        const next = ring[i + 1]!;
        return sum + p[0] * next[1] - next[0] * p[1];
      }, 0);
      if (area < 0) ring.reverse();
    }
    return value;
  });
export type ConstructionSiteGeometryV1 = z.infer<typeof constructionSiteGeometrySchema>;
export type ConstructionSiteGeometryFeature = ConstructionSiteGeometryV1['features'][number];
