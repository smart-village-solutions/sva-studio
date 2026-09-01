import type { SsfResolvedMedia } from './contracts.js';

export interface SsfProductLocaleDefault {
  readonly locale: string;
  readonly authenticatedHomeExplanationHtml: string;
  readonly guestExplanationHtml: string;
  readonly conversationContentStorageQuestionHtml: string;
}

export interface SsfProductDefaults {
  readonly defaultLocale: string;
  readonly locales: readonly SsfProductLocaleDefault[];
  readonly branding: {
    readonly logo: SsfResolvedMedia | null;
    readonly icon: SsfResolvedMedia | null;
  };
  readonly conversationContentStorageMode: 'ask' | 'disabled';
  readonly customBrandingAllowed: boolean;
  readonly conversationContentStorageAllowed: boolean;
}

export const SSF_PRODUCT_DEFAULTS_V1: SsfProductDefaults = {
  defaultLocale: 'de-DE',
  locales: [
    {
      locale: 'de-DE',
      authenticatedHomeExplanationHtml:
        '<p>Willkommen bei Smart Speech Flow. Hier können Sie ein neues Gespräch beginnen.</p>',
      guestExplanationHtml:
        '<p>Willkommen bei Smart Speech Flow. Sie nutzen den Dienst als Gast.</p>',
      conversationContentStorageQuestionHtml:
        '<p>Dürfen Ihre Gesprächsinhalte gespeichert und verarbeitet werden?</p>',
    },
    {
      locale: 'en',
      authenticatedHomeExplanationHtml:
        '<p>Welcome to Smart Speech Flow. You can start a new conversation here.</p>',
      guestExplanationHtml:
        '<p>Welcome to Smart Speech Flow. You are using the service as a guest.</p>',
      conversationContentStorageQuestionHtml:
        '<p>May your conversation content be stored and processed?</p>',
    },
  ],
  branding: {
    logo: null,
    icon: null,
  },
  conversationContentStorageMode: 'disabled',
  customBrandingAllowed: false,
  conversationContentStorageAllowed: false,
};
