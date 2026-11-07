import { jobWriteFields } from '../generated/jobs.js';
import type { RawRecord, WriteShape } from './vouchers-snapshot.js';
const blank = (shape: WriteShape): RawRecord =>
  Object.fromEntries(
    Object.entries(shape).map(([key, value]) => [key, typeof value === 'object' ? [] : null])
  );
export function jobFixture(): RawRecord {
  return {
    ...blank(jobWriteFields),
    id: '42',
    genericType: 'Job',
    title: 'Sachbearbeitung',
    visible: false,
    externalId: 'legacy-42',
    publicationDate: '2026-11-01T09:00:00+01:00',
    updatedAt: '2026-11-01T10:00:00Z',
    dataProvider: { id: '7', name: 'Redaktion' },
    ancestry: null,
    memberId: null,
    pointOfInterest: null,
    quota: null,
    discountType: null,
    genericItems: [],
    genericItemMessages: [],
    pushNotifications: [],
    likeCount: 0,
    teaser: 'Alte Einleitung',
    description: 'Weiterer Alttext',
    payload: { employmentType: 'Ausbildung', opaque: { keep: [1, 2] } },
    categories: [{ name: 'Stadt' }],
    dates: [{ ...blank(jobWriteFields.dates), dateEnd: '2026-12-01', weekday: 'Monday' }],
    contacts: [
      {
        ...blank(jobWriteFields.contacts),
        firstName: 'A',
        lastName: 'B',
        email: 'person@example.org',
        fax: '12',
        webUrls: [{ url: 'https://example.org/apply', description: 'Bewerbung' }],
      },
    ],
    companies: [1, 2].map((number) => ({
      ...blank(jobWriteFields.companies),
      name: `Firma ${number}`,
      contact: null,
      address: {
        addition: 'Eingang',
        street: 'Straße 1',
        zip: '12345',
        city: 'Stadt',
        kind: 'default',
        geoLocation: { latitude: 0, longitude: 13 },
      },
    })),
    contentBlocks: [
      { ...blank(jobWriteFields.contentBlocks), body: '<p>Inhalt</p>', title: 'Zusatz' },
      { ...blank(jobWriteFields.contentBlocks), body: '<p>Zweiter Block</p>' },
    ],
    mediaContents: [
      {
        ...blank(jobWriteFields.mediaContents),
        contentType: 'attachement',
        copyright: 'Stadt',
        payload: { opaque: true },
        sourceUrl: { url: 'https://example.org/job.pdf', description: 'Ausschreibung' },
      },
    ],
  };
}
