import { t } from '../../../i18n';

export const resolveModuleDescription = (descriptionKey: string): string => {
  const translatedDescription = t(descriptionKey).trim();

  if (!translatedDescription || translatedDescription === descriptionKey) {
    return t('admin.instances.instanceModules.detail.descriptionFallback');
  }

  return translatedDescription;
};
