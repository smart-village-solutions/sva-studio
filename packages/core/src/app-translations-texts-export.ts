/** Reviewed texts.js formats: v1 for mobile-app ca0eb0375; source SHA-256 f213f1b08a758c555931734391b0733be2ba380aeded557e1a2618972511e114.
 * v2 targets mobile-app 5.0.0 (master 608c01b5a plus the central locale controls).
 * Function signatures and key segmentation were checked against the GPL-3.0 App reference.
 */
import {
  catalogAssert,
  catalogDigest,
  validateCatalogLocales,
  validateCatalogManifest,
  validateCatalogValue,
  type CatalogManifest,
  type CatalogRelease,
} from './app-translations.js';

const manifestDigest = '3239ba0e6210114ef53b8cffb98830233c4f9f318052ddce92bc4b34971421d8';
const functions: Readonly<Record<string, readonly string[]>> = {
  'components.sueReportProgress': ['step', 'ofStep'],
  'noticeboard.alerts.dateDifference': ['requestedDateDifference'],
  'noticeboard.alerts.documentHint': ['count'],
  'noticeboard.alerts.documentSizeError': ['size'],
  'noticeboard.alerts.documentsSizeError': ['size'],
  'noticeboard.alerts.imageHint': ['count'],
  'noticeboard.alerts.imageSizeError': ['size'],
  'noticeboard.alerts.imagesSizeError': ['size'],
  'noticeboard.inputDate': ['requestedDateDifference'],
  'placeholder.homeSectionTitle': ['title'],
  'sue.report.alerts.imagesTotalSizeError': ['size'],
  'sue.report.alerts.limitOfArea': ['city'],
  'sue.report.imageHint': ['maxFileCount'],
  'volunteer.report.action': ['target'],
  'volunteer.showPreviousComments': ['commentsCount'],
  'voucher.detailScreen.frequency': ['maxPerPerson', 'frequency'],
  'voucher.detailScreen.limit': ['availableQuantity', 'maxQuantity'],
  'wallet.add.inputs.errors.cardNumberRequired': ['cardType'],
  'wallet.add.inputs.errors.cardPinRequired': ['cardType'],
  'wallet.add.inputs.errors.lengthExceeded': ['cardType', 'maxLength'],
  'wallet.detail.deleteConfirmationMessage': ['value'],
  'weather.alertsText': ['from', 'to'],
};
const manifestV2Digest = '5ead916a8b42364d87252736d481268076132044efb0cd962ce3448717ce62d1';
const functionsV2: Readonly<Record<string, readonly string[]>> = {
  ...functions,
  'bus.locationFilter.resetTo': ['areaName'],
  'floorPlan.floorChanged': ['title'],
  'participationProject.categoryCount': ['count'],
  'participationProject.completedCount': ['count'],
  'voucher.detailScreen.discountAmount': ['amount'],
  'voucher.detailScreen.discountPercentage': ['percentage'],
  'wasteCalendar.scheduledWasteReminderCount': ['count'],
};
const pluralKeys = new Set([
  'participationProject.categoryCount',
  'wasteCalendar.scheduledWasteReminderCount',
]);
const interpolate = (value: string, args: readonly string[], key: string): string => {
  const parts: string[] = [];
  let start = 0;
  for (const match of value.matchAll(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g)) {
    parts.push(literal(value.slice(start, match.index)));
    const token = match[1];
    catalogAssert(token && args.includes(token));
    const parameter =
      key === 'voucher.detailScreen.frequency'
        ? token === 'maxPerPerson'
          ? '(maxPerPerson || 1)'
          : 'catalog.voucher.detailScreen[frequency]'
        : token;
    parts.push(`String(${parameter})`);
    start = match.index + match[0].length;
  }
  parts.push(literal(value.slice(start)));
  return parts.join('+');
};
export const CATALOG_TEXTS_EXPORT_MAX_BYTES = 8 * 1024 * 1024;
const literal = (value: unknown) =>
  JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
type Tree = Map<string, Tree | string>;
const renderTree = (tree: Tree): string =>
  `{${[...tree].map(([key, value]) => `${literal(key)}:${typeof value === 'string' ? value : renderTree(value)}`).join(',')}}`;

/** Only immutable, fully verified municipal snapshots of the reviewed format are exportable. */
export const exportCatalogTextsJs = async (
  release: CatalogRelease,
  rawManifest: CatalogManifest
): Promise<string> => {
  const manifest = validateCatalogManifest(rawManifest);
  const digest = await catalogDigest(manifest);
  catalogAssert(
    digest === manifestDigest || digest === manifestV2Digest,
    'catalog_export_incompatible'
  );
  const version = digest === manifestV2Digest ? 2 : 1;
  const signatures = version === 2 ? functionsV2 : functions;
  const appNameKeys = new Set(
    version === 2 ? ['screenTitles.home'] : ['screenTitles.home', 'screenTitles.events']
  );
  catalogAssert(/^[1-9][0-9]{0,19}$/.test(release.catalogSetRevision));
  catalogAssert(release.state === 'sealed' && release.scope.kind === 'municipal');
  catalogAssert(release.contractId === manifest.contractId);
  const locales = validateCatalogLocales(release.supportedLocales);
  catalogAssert(Object.keys(release.catalogs).sort().join(',') === [...locales].sort().join(','));
  catalogAssert((await catalogDigest(release.descriptor)) === release.checksum);
  const descriptor = release.descriptor;
  catalogAssert(
    descriptor.schemaVersion === 1 &&
      descriptor.instanceId === release.scope.instanceId &&
      descriptor.organizationId === release.scope.organizationId &&
      descriptor.contractId === release.contractId &&
      descriptor.catalogSetRevision === release.catalogSetRevision &&
      JSON.stringify(descriptor.appCompatibility) === JSON.stringify(manifest.appCompatibility) &&
      JSON.stringify(descriptor.supportedLocales) === JSON.stringify(locales)
  );
  const descriptors = descriptor.catalogs;
  catalogAssert(Array.isArray(descriptors) && descriptors.length === locales.length);
  let size = 0;
  for (const locale of locales) {
    const artifact = release.catalogs[locale];
    catalogAssert(artifact);
    const { checksum, ...payload } = artifact;
    size += new TextEncoder().encode(JSON.stringify(artifact)).length;
    catalogAssert(size <= CATALOG_TEXTS_EXPORT_MAX_BYTES);
    catalogAssert(
      artifact.schemaVersion === 1 &&
        artifact.locale === locale &&
        artifact.instanceId === release.scope.instanceId &&
        artifact.organizationId === release.scope.organizationId &&
        artifact.contractId === release.contractId &&
        artifact.catalogSetRevision === release.catalogSetRevision &&
        JSON.stringify(artifact.appCompatibility) === JSON.stringify(manifest.appCompatibility) &&
        artifact.fallbackKeys.length === 0 &&
        descriptors.some((entry) => entry.locale === locale && entry.checksum === checksum)
    );
    catalogAssert((await catalogDigest(payload)) === checksum);
    catalogAssert(
      Object.keys(artifact.values).sort().join('\n') ===
        Object.keys(manifest.keys).sort().join('\n')
    );
    for (const [key, value] of Object.entries(artifact.values))
      validateCatalogValue(manifest, key, value);
  }
  const catalogs: string[] = [];
  for (const locale of [...locales].sort()) {
    const tree: Tree = new Map();
    for (const key of Object.keys(manifest.keys).sort()) {
      const artifact = release.catalogs[locale];
      catalogAssert(artifact);
      const value = artifact.values[key];
      catalogAssert(value !== undefined);
      const args = Object.prototype.hasOwnProperty.call(signatures, key)
        ? signatures[key]
        : undefined;
      let expression: string;
      if (appNameKeys.has(key)) expression = 'appJson.expo.name';
      else if (args) {
        if (version === 2 && pluralKeys.has(key)) {
          catalogAssert(Array.isArray(value) && value.length === 2);
          expression = `(count)=>count===1?${interpolate(value[0]!, args, key)}:${interpolate(value[1]!, args, key)}`;
        } else {
          catalogAssert(typeof value === 'string');
          expression = `(${args.join(',')})=>${interpolate(value, args, key)}`;
        }
      } else expression = literal(value);
      // Segments are unambiguous only because this exact manifest is bound to the reviewed App tree.
      const path = key.split('.');
      let parent = tree;
      for (const segment of path.slice(0, -1)) {
        catalogAssert(!['__proto__', 'constructor', 'prototype'].includes(segment));
        if (!parent.has(segment)) parent.set(segment, new Map());
        const child = parent.get(segment);
        catalogAssert(child instanceof Map);
        parent = child;
      }
      const leaf = path[path.length - 1];
      catalogAssert(leaf !== undefined);
      catalogAssert(!['__proto__', 'constructor', 'prototype'].includes(leaf) && !parent.has(leaf));
      parent.set(leaf, expression);
    }
    catalogs.push(`${literal(locale)}:(()=>{const catalog=${renderTree(tree)};return catalog;})()`);
  }
  const source = `// Studio texts.js format ${version}; sealed revision ${release.catalogSetRevision}\nimport appJson from '../../app.json';\nexport const textsByLocale={${catalogs.join(',')}};\nexport let texts=textsByLocale.de;\nexport function setTextsLocale(locale){const selected=typeof locale==='string'&&Object.prototype.hasOwnProperty.call(textsByLocale,locale)?locale:'de';texts=textsByLocale[selected];return selected;}\n`;
  catalogAssert(new TextEncoder().encode(source).length <= CATALOG_TEXTS_EXPORT_MAX_BYTES);
  return source;
};
