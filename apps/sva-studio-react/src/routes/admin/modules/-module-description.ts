import { modulePublicCode } from 'virtual:studio-module-publiccode';
import { getActiveLocale, t } from '../../../i18n';

export const resolveModuleName = (moduleId: string): string => {
  const metadata = modulePublicCode[moduleId];
  const localizedName = metadata?.description[getActiveLocale()]?.localisedName?.trim();
  return localizedName || metadata?.name || moduleId;
};

export const resolveModuleDescription = (moduleId: string, descriptionKey?: string): string => {
  const metadataDescription =
    modulePublicCode[moduleId]?.description[getActiveLocale()]?.shortDescription?.trim();
  if (metadataDescription) return metadataDescription;
  if (!descriptionKey) return t('admin.instances.instanceModules.detail.descriptionFallback');
  const translatedDescription = t(descriptionKey).trim();

  if (!translatedDescription || translatedDescription === descriptionKey) {
    return t('admin.instances.instanceModules.detail.descriptionFallback');
  }

  return translatedDescription;
};
