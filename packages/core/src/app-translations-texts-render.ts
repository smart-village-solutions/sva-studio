/** Render the reviewed App key tree and function signatures without evaluating code. */
import {
  catalogAssert,
  type CatalogValue,
  type CatalogRelease,
  type CatalogManifest,
} from './app-translations.js';
export const manifestDigest = '3239ba0e6210114ef53b8cffb98830233c4f9f318052ddce92bc4b34971421d8';
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
export const manifestV2Digest = '5ead916a8b42364d87252736d481268076132044efb0cd962ce3448717ce62d1';
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

const literal = (value: unknown) =>
  JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
type Tree = Map<string, Tree | string>;
const renderTree = (tree: Tree): string =>
  `{${[...tree].map(([key, value]) => `${literal(key)}:${typeof value === 'string' ? value : renderTree(value)}`).join(',')}}`;

const renderValue = (key: string, value: CatalogValue, version: number): string => {
  const signatures = version === 2 ? functionsV2 : functions;
  const appNameKeys = new Set(
    version === 2 ? ['screenTitles.home'] : ['screenTitles.home', 'screenTitles.events']
  );
  const args = Object.prototype.hasOwnProperty.call(signatures, key) ? signatures[key] : undefined;
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
  return expression;
};
const insertValue = (tree: Tree, key: string, expression: string): void => {
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
};
export const renderCatalogTrees = (
  release: CatalogRelease,
  manifest: CatalogManifest,
  locales: string[],
  version: number
): string[] => {
  const catalogs: string[] = [];
  for (const locale of [...locales].sort()) {
    const tree: Tree = new Map();
    for (const key of Object.keys(manifest.keys).sort()) {
      const artifact = release.catalogs[locale];
      catalogAssert(artifact);
      const value = artifact.values[key];
      catalogAssert(value !== undefined);
      const expression = renderValue(key, value, version);
      insertValue(tree, key, expression);
    }
    catalogs.push(`${literal(locale)}:(()=>{const catalog=${renderTree(tree)};return catalog;})()`);
  }
  return catalogs;
};
