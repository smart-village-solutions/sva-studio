/** Reviewed texts.js formats: v1 for mobile-app ca0eb0375; source SHA-256 f213f1b08a758c555931734391b0733be2ba380aeded557e1a2618972511e114.
 * v2 targets mobile-app 5.0.0 (master 608c01b5a plus the central locale controls).
 * Function signatures and key segmentation were checked against the GPL-3.0 App reference.
 */
import {
  catalogAssert,
  catalogDigest,
  validateCatalogManifest,
  type CatalogManifest,
  type CatalogRelease,
} from './app-translations.js';

import {
  manifestDigest,
  manifestV2Digest,
  renderCatalogTrees,
} from './app-translations-texts-render.js';
import {
  CATALOG_TEXTS_EXPORT_MAX_BYTES,
  verifyTextsRelease,
} from './app-translations-texts-verify.js';
export { CATALOG_TEXTS_EXPORT_MAX_BYTES } from './app-translations-texts-verify.js';
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
  const locales = await verifyTextsRelease(release, manifest);
  const catalogs = renderCatalogTrees(release, manifest, locales, version);
  const source = `// Studio texts.js format ${version}; sealed revision ${release.catalogSetRevision}\nimport appJson from '../../app.json';\nexport const textsByLocale={${catalogs.join(',')}};\nexport let texts=textsByLocale.de;\nexport function setTextsLocale(locale){const selected=typeof locale==='string'&&Object.prototype.hasOwnProperty.call(textsByLocale,locale)?locale:'de';texts=textsByLocale[selected];return selected;}\n`;
  catalogAssert(new TextEncoder().encode(source).length <= CATALOG_TEXTS_EXPORT_MAX_BYTES);
  return source;
};
