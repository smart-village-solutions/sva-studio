import { pluginSurveysContentEnTranslations } from './plugin.translations.content.en.js';
import { pluginSurveysContentTranslations } from './plugin.translations.content.js';
import { pluginSurveysMetaEnTranslations } from './plugin.translations.meta.en.js';
import { pluginSurveysMetaTranslations } from './plugin.translations.meta.js';
import { pluginSurveysStructureEnTranslations } from './plugin.translations.structure.en.js';
import { pluginSurveysStructureTranslations } from './plugin.translations.structure.js';

export const pluginSurveysTranslations = {
  de: {
    surveys: {
      ...pluginSurveysStructureTranslations,
      ...pluginSurveysContentTranslations,
      ...pluginSurveysMetaTranslations,
    },
  },
  en: {
    surveys: {
      ...pluginSurveysStructureEnTranslations,
      ...pluginSurveysContentEnTranslations,
      ...pluginSurveysMetaEnTranslations,
    },
  },
};
