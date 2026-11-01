import { describe, expect, it } from 'vitest';
import { buildClientSchema, parse, validate, type IntrospectionQuery } from 'graphql';
import schemaSnapshot from '../generated/schema.snapshot.json';
import {
  constructionSiteDetailDocument,
  constructionSiteListDocument,
  constructionSiteWriteDocument,
  constructionSiteWriteFields,
  constructionSiteOperationDocument,
} from '../generated/construction-sites.js';
import {
  buildConstructionSiteWrite,
  constructionSiteRead,
  constructionSiteFingerprint,
  assertConstructionSiteWritable,
} from './construction-sites-snapshot.js';
import type { WriteShape } from './vouchers-snapshot.js';

const blank = (shape: WriteShape) =>
  Object.fromEntries(
    Object.entries(shape).map(([key, value]) => [key, typeof value === 'object' ? [] : null])
  );
function fixture() {
  return {
    ...blank(constructionSiteWriteFields),
    id: '42',
    title: 'Brückenbau',
    genericType: 'ConstructionSite',
    visible: false,
    dataProvider: { id: 'provider-1', name: 'Redaktion' },
    updatedAt: '2026-11-01T10:00:00Z',
    ancestry: null,
    memberId: null,
    pointOfInterest: null,
    quota: null,
    discountType: null,
    genericItems: [],
    genericItemMessages: [],
    pushNotifications: [],
    payload: {
      opaque: { untouched: [1, 2] },
      direction: 'Nord',
      cause: 'Arbeiten',
      restrictions: [{ description: 'Einspurig', extra: { preserve: true } }],
    },
    categories: [{ name: 'Verkehr' }],
    dates: [
      {
        ...blank(constructionSiteWriteFields.dates),
        dateStart: '2026-11-01',
        dateEnd: '2026-11-30',
        weekday: 'Monday',
      },
    ],
    contentBlocks: [
      { ...blank(constructionSiteWriteFields.contentBlocks), title: 'Zusatz', body: '<p>Alt</p>' },
      { ...blank(constructionSiteWriteFields.contentBlocks), body: 'Zweiter Block' },
    ],
    locations: [
      {
        ...blank(constructionSiteWriteFields.locations),
        name: 'Brücke',
        district: 'Mitte',
        geoLocation: { latitude: 0, longitude: 13 },
      },
    ],
  };
}
describe('ConstructionSite Bestandserhalt', () => {
  it.each([
    constructionSiteDetailDocument,
    constructionSiteListDocument,
    constructionSiteWriteDocument,
    constructionSiteOperationDocument,
  ])('uses the existing GraphQL schema', (document) => {
    const schema = buildClientSchema(schemaSnapshot.data as unknown as IntrospectionQuery);
    expect(validate(schema, parse(document)).map((error) => error.message)).toEqual([]);
  });
  it('preserves opaque payloads, restriction metadata, secondary blocks and location metadata', () => {
    const stored = fixture();
    const input = constructionSiteRead(stored).input;
    const write = buildConstructionSiteWrite({ ...input, title: 'Neuer Titel' }, stored);
    expect(write.title).toBe('Neuer Titel');
    expect(write.payload).toEqual(stored.payload);
    expect(write.contentBlocks).toEqual(stored.contentBlocks);
    expect(write.dates).toEqual(stored.dates);
    expect(write.locations).toEqual(stored.locations);
    expect(stored.title).toBe('Brückenbau');
  });
  it('accepts active-only categories without inventing hidden memberships', () => {
    const stored = fixture();
    // The Mainserver read excludes an inactive, non-default membership.
    const originalMemberships = [
      { name: 'Verkehr', active: true },
      { name: 'Alt', active: false },
    ];
    stored.categories = originalMemberships
      .filter((item) => item.active)
      .map(({ name }) => ({ name }));
    const write = buildConstructionSiteWrite(constructionSiteRead(stored).input, stored);
    expect(write.categories).toEqual([{ name: 'Verkehr' }]);
    expect(write.payload).toEqual(stored.payload);
  });
  it('blocks incomplete reads and non-restorable dependents before writing', () => {
    const incomplete: Record<string, unknown> = fixture();
    delete incomplete.companies;
    expect(() => assertConstructionSiteWritable(incomplete)).toThrow();
    expect(constructionSiteRead(incomplete).writeBlockedReason).toBe(
      'construction_site_incomplete'
    );
    for (const key of ['genericItems', 'genericItemMessages', 'pushNotifications']) {
      expect(() =>
        assertConstructionSiteWritable({ ...fixture(), [key]: [{ id: 'dependent-1' }] })
      ).toThrow('construction_site_dependents_unsupported');
    }
    expect(() => assertConstructionSiteWritable({ ...fixture(), ancestry: '1' })).toThrow(
      'construction_site_dependents_unsupported'
    );
  });
  it('retains damaged read information instead of treating filtered lists as safe', () => {
    const malformed = { ...fixture(), webUrls: [{ url: 42 }] };
    expect(constructionSiteRead(malformed).writeBlockedReason).toBe('construction_site_incomplete');
    expect(() =>
      buildConstructionSiteWrite(constructionSiteRead(fixture()).input, malformed)
    ).toThrow();
    expect(() => assertConstructionSiteWritable({ ...fixture(), companies: null })).toThrow(
      'construction_site_incomplete'
    );
    expect(() =>
      assertConstructionSiteWritable({
        ...fixture(),
        companies: [{ ...blank(constructionSiteWriteFields.companies), name: 42 }],
      })
    ).toThrow('construction_site_incomplete');
  });
  it('detects opaque changes even when updatedAt is unchanged', () => {
    const stored = fixture();
    expect(constructionSiteFingerprint({ ...stored, payload: { changed: true } })).not.toBe(
      constructionSiteFingerprint(stored)
    );
  });
  it('rejects forged indices and sanitizes changed content', () => {
    const stored = fixture();
    const input = constructionSiteRead(stored).input;
    expect(() =>
      buildConstructionSiteWrite(
        { ...input, locations: [{ ...input.locations[0]!, sourceIndex: 99 }] },
        stored
      )
    ).toThrow('construction_site_content_conflict');
    const write = buildConstructionSiteWrite(
      { ...input, contentBlocks: [{ body: '<script>bad()</script><p>Sicher</p>' }] },
      stored
    );
    expect(write.contentBlocks).toEqual([{ body: '<p>Sicher</p>' }]);
  });
  it('preserves nullable and absent optional fields when editing only the title',()=>{
    const stored=fixture();
    stored.payload={opaque:true,direction:null,restrictions:null};
    (stored.contentBlocks as Record<string,unknown>[])[0]!.body=null;
    (stored.locations as Record<string,unknown>[])[0]!.name=null;
    const input=constructionSiteRead(stored).input;input.title='Only the title';
    const write=buildConstructionSiteWrite(input,stored);
    expect(write.payload).toEqual(stored.payload);
    expect(write.contentBlocks).toEqual(stored.contentBlocks);
    expect(write.locations).toEqual(stored.locations);
    expect(write.dates).toEqual(stored.dates);
  });

});
