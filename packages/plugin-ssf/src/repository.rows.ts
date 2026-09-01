export interface ServerSettingsRow {
  readonly default_locale: string | null;
  readonly logo_media_reference: string | null;
  readonly icon_media_reference: string | null;
}

export interface ServerLocaleRow {
  readonly locale: string;
  readonly available: boolean | null;
  readonly authenticated_home_explanation_html: string | null;
  readonly guest_explanation_html: string | null;
  readonly conversation_content_storage_question_html: string | null;
}

export interface TenantSettingsRow {
  readonly default_locale: string | null;
  readonly custom_branding_allowed: boolean | null;
  readonly conversation_content_storage_allowed: boolean | null;
  readonly conversation_content_storage_mode: 'ask' | 'disabled' | null;
  readonly logo_media_reference: string | null;
  readonly icon_media_reference: string | null;
}

export interface TenantLocaleRow {
  readonly locale: string;
  readonly enabled: boolean | null;
  readonly authenticated_home_explanation_html: string | null;
  readonly guest_explanation_html: string | null;
  readonly conversation_content_storage_question_html: string | null;
}
