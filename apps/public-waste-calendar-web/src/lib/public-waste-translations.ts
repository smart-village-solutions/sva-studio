import {
  translateResource,
  type TranslationResourceKey,
  type TranslationVariables,
} from '@sva/core';

import { publicWasteDE } from './public-waste-translations.de.resources.js';
import { publicWasteEN } from './public-waste-translations.en.resources.js';

export type PublicWasteTranslationKey = TranslationResourceKey<typeof publicWasteDE>;

export const createPublicWasteTranslator =
  (locale: string) => (key: PublicWasteTranslationKey, variables?: TranslationVariables) =>
    translateResource(
      /^en(?:-|$)/i.test(locale) ? publicWasteEN : publicWasteDE,
      publicWasteDE,
      key,
      variables
    );
