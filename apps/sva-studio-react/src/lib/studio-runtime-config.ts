/** Öffentliche, nicht geheime Laufzeitkonfiguration des Studio-Hosts. */
export const STUDIO_PARENT_DOMAIN_META_NAME = 'sva-studio-parent-domain';
export const FALLOW_BROWSER_BEACON_META_NAME = 'sva-fallow-browser-beacon-key';

export const normalizeStudioParentDomain = (value: string | undefined) =>
  value?.trim().toLowerCase() ?? '';

export const readDocumentStudioParentDomain = () => {
  if (typeof document === 'undefined') {
    return '';
  }

  return normalizeStudioParentDomain(
    document
      .querySelector<HTMLMetaElement>(`meta[name="${STUDIO_PARENT_DOMAIN_META_NAME}"]`)
      ?.getAttribute('content') ?? undefined
  );
};

export const readDocumentFallowBrowserBeaconKey = () =>
  typeof document === 'undefined'
    ? ''
    : document
        .querySelector<HTMLMetaElement>(`meta[name="${FALLOW_BROWSER_BEACON_META_NAME}"]`)
        ?.getAttribute('content') ?? '';
