/** Existing catalogue and locale-membership checks for SSF administration writes. */
import { ssfSupportedLanguagesCatalogSchema } from '../content-v2-admin-contracts.js';
import type { SsfLegalTexts } from '../content-v2-contracts.js';
import { effectiveSsfRuntimeFieldsV2 } from '../content-v2-overrides.js';
import type { SsfSystemContentV2, SsfTenantContentV2 } from '../content-v2-repository.js';

export const readSsfLanguageCatalog = async (read: (() => Promise<unknown>) | undefined) => {
  if (!read) return null;
  try {
    const parsed = ssfSupportedLanguagesCatalogSchema.safeParse(await read());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

const localeIsAllowed = (
  locale: string,
  previous: string | undefined,
  catalog: Awaited<ReturnType<typeof readSsfLanguageCatalog>>
) => locale === previous || Boolean(catalog?.languages[locale]);

const legalLocalesAreAllowed = (
  next: SsfLegalTexts | undefined,
  previous: SsfLegalTexts | undefined,
  catalog: Awaited<ReturnType<typeof readSsfLanguageCatalog>>
): boolean => {
  if (!next) return true;
  const saved = new Set(previous?.localizations.map((entry) => entry.locale) ?? []);
  if (!catalog)
    return (
      next.sourceLocale === previous?.sourceLocale &&
      next.localizations.length === saved.size &&
      next.localizations.every((entry) => saved.has(entry.locale))
    );
  return next.localizations.every(
    ({ locale }) =>
      saved.has(locale) ||
      Boolean(catalog.languages[locale] ?? catalog.languages[locale.split('-')[0] ?? ''])
  );
};

const systemGuestLocalesAreAllowed = (
  runtime: NonNullable<SsfSystemContentV2['runtimeTemplate']>,
  previousRuntime: SsfSystemContentV2['runtimeTemplate'],
  catalog: Awaited<ReturnType<typeof readSsfLanguageCatalog>>
): boolean => {
  if (!catalog && previousRuntime && runtime) {
    const previousGuests = previousRuntime.guestLanguages.map(({ locale }) => locale).sort();
    const requestedGuests = runtime.guestLanguages.map(({ locale }) => locale).sort();
    if (
      previousGuests.length !== requestedGuests.length ||
      previousGuests.some((locale, index) => locale !== requestedGuests[index])
    )
      return false;
  }
  const previousGuestLocales = new Set(
    previousRuntime?.guestLanguages.map(({ locale }) => locale) ?? []
  );
  return runtime.guestLanguages.every(
    ({ locale }) => previousGuestLocales.has(locale) || Boolean(catalog?.languages[locale])
  );
};

export const systemLocalesAreAllowed = (
  input: {
    installation: SsfSystemContentV2['installation'];
    runtimeTemplate: SsfSystemContentV2['runtimeTemplate'];
  },
  previous: SsfSystemContentV2,
  catalog: Awaited<ReturnType<typeof readSsfLanguageCatalog>>
): boolean => {
  if (
    input.installation &&
    !localeIsAllowed(
      input.installation.localization.locale,
      previous.installation?.localization.locale,
      catalog
    )
  )
    return false;
  const previousRuntime = previous.runtimeTemplate;
  if (!input.runtimeTemplate) return true;
  if (
    !legalLocalesAreAllowed(input.runtimeTemplate.legalTexts, previousRuntime?.legalTexts, catalog)
  )
    return false;
  if (!localeIsAllowed(input.runtimeTemplate.staff.locale, previousRuntime?.staff.locale, catalog))
    return false;
  return systemGuestLocalesAreAllowed(input.runtimeTemplate, previousRuntime, catalog);
};

const tenantGuestChangesAreAllowed = (
  input: Record<string, unknown>,
  previous: SsfTenantContentV2,
  catalog: Awaited<ReturnType<typeof readSsfLanguageCatalog>>
): boolean => {
  if (catalog) return true;
  const guestLanguages = input['guestLanguages'];
  if (guestLanguages === undefined) return true;
  if (!Array.isArray(guestLanguages)) return false;
  const templateLocales = new Set(
    previous.runtimeTemplate?.guestLanguages.map(({ locale }) => locale) ?? []
  );
  return guestLanguages.every((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return false;
    const value = entry as Record<string, unknown>;
    return (
      typeof value['locale'] === 'string' &&
      templateLocales.has(value['locale']) &&
      value['enabled'] === undefined
    );
  });
};

const tenantLegalChangesAreAllowed = (
  input: Record<string, unknown>,
  previous: SsfTenantContentV2,
  catalog: Awaited<ReturnType<typeof readSsfLanguageCatalog>>
): boolean => {
  if (input['legalTexts'] === undefined || !previous.runtimeTemplate) return true;
  const next = effectiveSsfRuntimeFieldsV2(previous.runtimeTemplate, input);
  const saved = effectiveSsfRuntimeFieldsV2(previous.runtimeTemplate, previous.overrides);
  return legalLocalesAreAllowed(next.legalTexts, saved.legalTexts, catalog);
};

const tenantStaffLocale = (
  value: Record<string, unknown> | null | undefined
): string | undefined => {
  const staff = value?.staff;
  if (typeof staff !== 'object' || staff === null || Array.isArray(staff)) return undefined;
  const locale = (staff as Record<string, unknown>).locale;
  return typeof locale === 'string' ? locale : undefined;
};

const SUPPORTED_LANGUAGES_CACHE_TTL_MS = 5 * 60 * 1000;
let supportedLanguagesCache: { expiresAt: number; value: Promise<unknown> } | null = null;

export const readSupportedLanguages = (): Promise<unknown> => {
  const now = Date.now();
  if (
    supportedLanguagesCache &&
    (supportedLanguagesCache.expiresAt === 0 || supportedLanguagesCache.expiresAt > now)
  ) {
    return supportedLanguagesCache.value;
  }

  const value = fetch('https://api.dialog.kassel.de/api/languages/supported', {
    signal: AbortSignal.timeout(5_000),
    headers: { accept: 'application/json' },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error('ssf_supported_languages_unavailable');
      return response.json();
    })
    .then((catalog) => {
      supportedLanguagesCache = {
        expiresAt: Date.now() + SUPPORTED_LANGUAGES_CACHE_TTL_MS,
        value: Promise.resolve(catalog),
      };
      return catalog;
    })
    .catch((error: unknown) => {
      supportedLanguagesCache = null;
      throw error;
    });
  supportedLanguagesCache = { expiresAt: 0, value };
  return value;
};

export const assertTenantLocalesAreAllowed = (
  input: Record<string, unknown>,
  previous: SsfTenantContentV2,
  catalog: Awaited<ReturnType<typeof readSsfLanguageCatalog>>
): void => {
  const requestedLocale = tenantStaffLocale(input);
  if (
    !tenantLegalChangesAreAllowed(input, previous, catalog) ||
    !tenantGuestChangesAreAllowed(input, previous, catalog)
  )
    throw new Error('ssf_v2_locale_invalid');
  const previousLocale =
    tenantStaffLocale(previous.overrides) ?? previous.runtimeTemplate?.staff.locale;
  if (requestedLocale && !localeIsAllowed(requestedLocale, previousLocale, catalog))
    throw new Error('ssf_v2_locale_invalid');
};
