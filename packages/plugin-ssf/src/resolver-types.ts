import type { SsfResolvedMedia } from './contracts.js';
import type { SsfProductDefaults } from './defaults.js';

export interface SsfTenantProfile {
  readonly id: string;
  readonly displayName: string;
  readonly timeZone: string;
}
export interface SsfServerSettings {
  readonly defaultLocale?: string | null;
  readonly conversationContentStorageAllowed?: boolean | null;
  readonly conversationContentStorageMode?: 'ask' | 'disabled' | null;
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
export interface SsfTenantSettings extends SsfServerSettings {
  readonly customBrandingAllowed?: boolean | null;
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
