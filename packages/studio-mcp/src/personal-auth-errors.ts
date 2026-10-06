export class PersonalMcpAuthError extends Error {
  constructor(readonly code: 'context_not_configured' | 'context_login_required' | 'context_already_authenticated' | 'context_login_pending' | 'login_callback_unavailable' | 'oidc_provider_unavailable' | 'oidc_login_failed' | 'oidc_token_refresh_failed' | 'oidc_logout_revocation_failed') {
    super(code);
  }
}
