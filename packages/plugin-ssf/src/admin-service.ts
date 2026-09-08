import type {
  SsfSystemConfigurationInput,
  SsfTenantConfigurationInput,
  SsfTenantConfigurationView,
} from './admin-contracts.js';
import { SSF_PRODUCT_DEFAULTS_V1 } from './defaults.js';
import type { SsfConfigurationOverrides } from './repository.js';

export const createSsfSystemConfigurationView = (
  overrides: Pick<SsfConfigurationOverrides, 'serverSettings' | 'serverLocales'>
): SsfSystemConfigurationInput => {
  const settings = overrides.serverSettings;
  return {
    defaultLocale: settings?.defaultLocale ?? SSF_PRODUCT_DEFAULTS_V1.defaultLocale,
    conversationContentStorageMode:
      settings?.conversationContentStorageAllowed === false
        ? 'disabled'
        : (settings?.conversationContentStorageMode ??
          SSF_PRODUCT_DEFAULTS_V1.conversationContentStorageMode),
    locales: SSF_PRODUCT_DEFAULTS_V1.locales.map((defaults) => {
      const stored = overrides.serverLocales.find((entry) => entry.locale === defaults.locale);
      return {
        locale: defaults.locale,
        available: stored?.available ?? true,
        authenticatedHomeExplanationHtml:
          stored?.authenticatedHomeExplanationHtml ?? defaults.authenticatedHomeExplanationHtml,
        guestExplanationHtml: stored?.guestExplanationHtml ?? defaults.guestExplanationHtml,
        conversationContentStorageQuestionHtml:
          stored?.conversationContentStorageQuestionHtml ??
          defaults.conversationContentStorageQuestionHtml,
      };
    }),
  };
};

export const createSsfTenantConfigurationView = (
  overrides: SsfConfigurationOverrides
): SsfTenantConfigurationView => {
  const system = createSsfSystemConfigurationView(overrides);
  const settings = overrides.tenantSettings;
  const tenantOverrides: SsfTenantConfigurationInput = {
    defaultLocale: settings?.defaultLocale ?? null,
    conversationContentStorageMode:
      settings?.conversationContentStorageAllowed === false
        ? 'disabled'
        : (settings?.conversationContentStorageMode ?? null),
    locales: system.locales.map((entry) => {
      const stored = overrides.tenantLocales.find((locale) => locale.locale === entry.locale);
      return {
        locale: entry.locale,
        enabled: stored?.enabled ?? null,
        authenticatedHomeExplanationHtml: stored?.authenticatedHomeExplanationHtml ?? null,
        guestExplanationHtml: stored?.guestExplanationHtml ?? null,
        conversationContentStorageQuestionHtml:
          stored?.conversationContentStorageQuestionHtml ?? null,
      };
    }),
  };
  return {
    system,
    overrides: tenantOverrides,
    effective: {
      defaultLocale: tenantOverrides.defaultLocale ?? system.defaultLocale,
      conversationContentStorageMode:
        tenantOverrides.conversationContentStorageMode ?? system.conversationContentStorageMode,
      locales: system.locales.map((entry) => {
        const stored = tenantOverrides.locales.find((locale) => locale.locale === entry.locale);
        return {
          locale: entry.locale,
          available: entry.available && stored?.enabled !== false,
          authenticatedHomeExplanationHtml:
            stored?.authenticatedHomeExplanationHtml ?? entry.authenticatedHomeExplanationHtml,
          guestExplanationHtml: stored?.guestExplanationHtml ?? entry.guestExplanationHtml,
          conversationContentStorageQuestionHtml:
            stored?.conversationContentStorageQuestionHtml ??
            entry.conversationContentStorageQuestionHtml,
        };
      }),
    },
  };
};
