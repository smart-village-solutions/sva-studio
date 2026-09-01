import {
  normalizeSsfLocale,
  ssfRuntimeConfigurationWithoutRevisionsSchema,
  type SsfResolvedMedia,
  type SsfRuntimeConfigurationWithoutRevisions,
  type SsfRuntimeLocale,
} from './contracts.js';
import { SSF_PRODUCT_DEFAULTS_V1, type SsfProductDefaults } from './defaults.js';
import { sanitizeSsfHtmlV1 } from './html.js';

type OptionalOverride<T> = T | null | undefined;

export interface SsfTenantProfile {
  readonly id: string;
  readonly displayName: string;
  readonly timeZone: string;
}

export interface SsfServerSettings {
  readonly defaultLocale?: string | null;
  readonly logoMediaReference?: string | null;
  readonly iconMediaReference?: string | null;
}

export interface SsfServerLocaleOverride {
  readonly locale: string;
  readonly available?: boolean | null;
  readonly authenticatedHomeExplanationHtml?: string | null;
  readonly guestExplanationHtml?: string | null;
  readonly conversationContentStorageQuestionHtml?: string | null;
}

export interface SsfTenantSettings {
  readonly defaultLocale?: string | null;
  readonly customBrandingAllowed?: boolean | null;
  readonly conversationContentStorageAllowed?: boolean | null;
  readonly conversationContentStorageMode?: 'ask' | 'disabled' | null;
  readonly logoMediaReference?: string | null;
  readonly iconMediaReference?: string | null;
}

export interface SsfTenantLocaleOverride {
  readonly locale: string;
  readonly enabled?: boolean | null;
  readonly authenticatedHomeExplanationHtml?: string | null;
  readonly guestExplanationHtml?: string | null;
  readonly conversationContentStorageQuestionHtml?: string | null;
}

export interface SsfMediaResolutionRequest {
  readonly instanceId: string;
  readonly reference: string;
  readonly purpose: 'logo' | 'icon';
}

export interface SsfMediaResolver {
  resolve(request: SsfMediaResolutionRequest): Promise<SsfResolvedMedia>;
}

export interface ResolveSsfRuntimeConfigurationInput {
  readonly tenant: SsfTenantProfile;
  readonly serverSettings?: SsfServerSettings | null;
  readonly serverLocales?: readonly SsfServerLocaleOverride[];
  readonly tenantSettings?: SsfTenantSettings | null;
  readonly tenantLocales?: readonly SsfTenantLocaleOverride[];
  readonly productDefaults?: SsfProductDefaults;
  readonly mediaResolver: SsfMediaResolver;
}

export class SsfRuntimeConfigurationValidationError extends Error {
  readonly code = 'runtime_configuration_unavailable';

  constructor(message: string) {
    super(message);
    this.name = 'SsfRuntimeConfigurationValidationError';
  }
}

const override = <T>(...values: readonly OptionalOverride<T>[]): T => {
  const value = values.find(
    (candidate): candidate is T => candidate !== null && candidate !== undefined
  );
  if (value === undefined) {
    throw new SsfRuntimeConfigurationValidationError(
      'A required SSF configuration value is missing.'
    );
  }
  return value;
};

const indexByLocale = <T extends { readonly locale: string }>(
  values: readonly T[],
  source: string
): ReadonlyMap<string, T> => {
  const indexed = new Map<string, T>();
  for (const value of values) {
    let locale: string;
    try {
      locale = normalizeSsfLocale(value.locale);
    } catch (error) {
      throw new SsfRuntimeConfigurationValidationError(
        `Invalid locale in ${source}: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
    if (indexed.has(locale)) {
      throw new SsfRuntimeConfigurationValidationError(`Duplicate locale ${locale} in ${source}.`);
    }
    indexed.set(locale, value);
  }
  return indexed;
};

const resolveMedia = async (
  tenantId: string,
  purpose: 'logo' | 'icon',
  customBrandingAllowed: boolean,
  tenantReference: OptionalOverride<string>,
  serverReference: OptionalOverride<string>,
  productDefault: SsfResolvedMedia | null,
  mediaResolver: SsfMediaResolver
): Promise<SsfResolvedMedia | null> => {
  const effectiveReference = customBrandingAllowed
    ? (tenantReference ?? serverReference)
    : serverReference;

  if (effectiveReference) {
    return mediaResolver.resolve({ instanceId: tenantId, reference: effectiveReference, purpose });
  }

  return productDefault;
};

const resolveLocales = (
  defaults: SsfProductDefaults,
  serverLocales: ReadonlyMap<string, SsfServerLocaleOverride>,
  tenantLocales: ReadonlyMap<string, SsfTenantLocaleOverride>,
  effectiveStorageMode: 'ask' | 'disabled'
): readonly SsfRuntimeLocale[] =>
  [...indexByLocale(defaults.locales, 'product defaults').entries()]
    .filter(([locale]) => serverLocales.get(locale)?.available !== false)
    .filter(([locale]) => tenantLocales.get(locale)?.enabled !== false)
    .map(([locale, productLocale]) => {
      const serverLocale = serverLocales.get(locale);
      const tenantLocale = tenantLocales.get(locale);
      return {
        locale,
        authenticatedHomeExplanationHtml: sanitizeSsfHtmlV1(
          override(
            tenantLocale?.authenticatedHomeExplanationHtml,
            serverLocale?.authenticatedHomeExplanationHtml,
            productLocale.authenticatedHomeExplanationHtml
          )
        ),
        guestExplanationHtml: sanitizeSsfHtmlV1(
          override(
            tenantLocale?.guestExplanationHtml,
            serverLocale?.guestExplanationHtml,
            productLocale.guestExplanationHtml
          )
        ),
        conversationContentStorageQuestionHtml:
          effectiveStorageMode === 'disabled'
            ? null
            : sanitizeSsfHtmlV1(
                override(
                  tenantLocale?.conversationContentStorageQuestionHtml,
                  serverLocale?.conversationContentStorageQuestionHtml,
                  productLocale.conversationContentStorageQuestionHtml
                )
              ),
      };
    })
    .sort((left, right) => left.locale.localeCompare(right.locale));

export const resolveSsfRuntimeConfiguration = async (
  input: ResolveSsfRuntimeConfigurationInput
): Promise<SsfRuntimeConfigurationWithoutRevisions> => {
  const defaults = input.productDefaults ?? SSF_PRODUCT_DEFAULTS_V1;
  const serverSettings = input.serverSettings ?? {};
  const tenantSettings = input.tenantSettings ?? {};
  const serverLocales = indexByLocale(input.serverLocales ?? [], 'server locale overrides');
  const tenantLocales = indexByLocale(input.tenantLocales ?? [], 'tenant locale overrides');

  const customBrandingAllowed = override(
    tenantSettings.customBrandingAllowed,
    defaults.customBrandingAllowed
  );
  const conversationContentStorageAllowed = override(
    tenantSettings.conversationContentStorageAllowed,
    defaults.conversationContentStorageAllowed
  );
  const desiredStorageMode = override(
    tenantSettings.conversationContentStorageMode,
    defaults.conversationContentStorageMode
  );
  const effectiveStorageMode = conversationContentStorageAllowed ? desiredStorageMode : 'disabled';

  const locales = resolveLocales(defaults, serverLocales, tenantLocales, effectiveStorageMode);

  const defaultLocale = normalizeSsfLocale(
    override(tenantSettings.defaultLocale, serverSettings.defaultLocale, defaults.defaultLocale)
  );
  if (!locales.some((entry) => entry.locale === defaultLocale)) {
    throw new SsfRuntimeConfigurationValidationError(
      `The effective default locale ${defaultLocale} is not active.`
    );
  }

  const [logo, icon] = await Promise.all([
    resolveMedia(
      input.tenant.id,
      'logo',
      customBrandingAllowed,
      tenantSettings.logoMediaReference,
      serverSettings.logoMediaReference,
      defaults.branding.logo,
      input.mediaResolver
    ),
    resolveMedia(
      input.tenant.id,
      'icon',
      customBrandingAllowed,
      tenantSettings.iconMediaReference,
      serverSettings.iconMediaReference,
      defaults.branding.icon,
      input.mediaResolver
    ),
  ]);

  const parsed = ssfRuntimeConfigurationWithoutRevisionsSchema.safeParse({
    contractVersion: '1.0',
    tenant: input.tenant,
    branding: { logo, icon },
    localization: { defaultLocale, locales },
    conversationContentStorage: { mode: effectiveStorageMode },
  });
  if (!parsed.success) {
    throw new SsfRuntimeConfigurationValidationError(
      `The effective SSF runtime configuration violates V1: ${parsed.error.message}`
    );
  }

  return parsed.data;
};
