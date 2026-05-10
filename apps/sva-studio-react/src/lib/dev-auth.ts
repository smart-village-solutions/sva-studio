export const DEV_AUTH_LOGIN_ENDPOINT = '/auth/dev-login';
export const DEV_AUTH_LOGOUT_ENDPOINT = '/auth/dev-logout';

export const isDevAuthAvailable = (): boolean => {
  return (
    import.meta.env.VITE_SVA_DEV_AUTH === true ||
    import.meta.env.VITE_SVA_DEV_AUTH === 'true' ||
    import.meta.env.VITE_MOCK_AUTH === true ||
    import.meta.env.VITE_MOCK_AUTH === 'true'
  );
};
