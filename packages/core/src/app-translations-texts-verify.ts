/** Verify immutable catalog payloads and bounded per-language integrity before export. */
import {
  catalogAssert,
  catalogDigest,
  validateCatalogLocales,
  validateCatalogValue,
  type CatalogManifest,
  type CatalogRelease,
  type CatalogArtifact,
} from './app-translations.js';
export const CATALOG_TEXTS_EXPORT_MAX_BYTES = 8 * 1024 * 1024;
const verifyDescriptor = async (release: CatalogRelease, manifest: CatalogManifest) => {
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
  return { locales, descriptors };
};
const verifyArtifactIdentity = (
  artifact: CatalogArtifact,
  release: CatalogRelease,
  manifest: CatalogManifest,
  locale: string,
  descriptors: Record<string, unknown>[]
) => {
  catalogAssert(release.scope.kind === 'municipal');
  const checksum = artifact.checksum;
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
};
export const verifyTextsRelease = async (release: CatalogRelease, manifest: CatalogManifest) => {
  const { locales, descriptors } = await verifyDescriptor(release, manifest);
  let size = 0;
  for (const locale of locales) {
    const artifact = release.catalogs[locale];
    catalogAssert(artifact);
    const { checksum, ...payload } = artifact;
    size += new TextEncoder().encode(JSON.stringify(artifact)).length;
    catalogAssert(size <= CATALOG_TEXTS_EXPORT_MAX_BYTES);
    verifyArtifactIdentity(artifact, release, manifest, locale, descriptors);
    catalogAssert((await catalogDigest(payload)) === checksum);
    catalogAssert(
      Object.keys(artifact.values).sort().join('\n') ===
        Object.keys(manifest.keys).sort().join('\n')
    );
    for (const [key, value] of Object.entries(artifact.values))
      validateCatalogValue(manifest, key, value);
  }
  return locales;
};
