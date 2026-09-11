/** Öffentliche, nicht geheime Laufzeitkonfiguration des Studio-Hosts. */
export const STUDIO_PARENT_DOMAIN_META_NAME = 'sva-studio-parent-domain';

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
