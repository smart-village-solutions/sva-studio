export type Mode = 'optional' | 'required';
export type Policy = { mode: Mode; clientIds: readonly string[] };
export type Flow = { id: string; alias: string; description?: string; topLevel?: boolean };
export type Entry = {
  id: string;
  displayName: string;
  providerId?: string;
  flowId?: string;
  authenticationFlow?: boolean;
  authenticationConfig?: string;
  requirement: string;
  priority: number;
  level: number;
};
export type Config = { id: string; alias: string; config: Record<string, string> };
export type Realm = { realm: string; browserFlow?: string; attributes?: Record<string, string> };
export type Client = {
  id: string;
  authenticationFlowBindingOverrides?: Record<string, string>;
  attributes?: Record<string, string>;
};
export type Spec = {
  parent: string;
  name: string;
  provider?: string;
  requirement: string;
  priority: number;
  config?: Record<string, string>;
};
export const owner = 'Studio managed tenant login MFA v1';
export const rootFor = (mode: Mode) => `studio-login-mfa-v1-${mode}`;
const loa = (level: number) => ({
  'loa-condition-level': String(level),
  'loa-max-age': level === 1 ? '36000' : '0',
});
export const specsFor = (mode: Mode): Spec[] => {
  const root = rootFor(mode);
  const identity = `${root}-identity`,
    login = `${root}-login`,
    ordinary = `${root}-ordinary`,
    stepup = `${root}-stepup`,
    challenge = `${root}-challenge`;
  return [
    { parent: root, name: identity, requirement: 'CONDITIONAL', priority: 0 },
    {
      parent: identity,
      name: 'Condition - Level of Authentication',
      provider: 'conditional-level-of-authentication',
      requirement: 'REQUIRED',
      priority: 0,
      config: loa(1),
    },
    { parent: identity, name: login, requirement: 'REQUIRED', priority: 10 },
    {
      parent: login,
      name: 'Cookie',
      provider: 'auth-cookie',
      requirement: 'ALTERNATIVE',
      priority: 0,
    },
    {
      parent: login,
      name: 'Username Password Form',
      provider: 'auth-username-password-form',
      requirement: 'ALTERNATIVE',
      priority: 10,
    },
    {
      parent: root,
      name: ordinary,
      requirement: mode === 'required' ? 'REQUIRED' : 'CONDITIONAL',
      priority: 10,
    },
    ...(mode === 'optional'
      ? [
          {
            parent: ordinary,
            name: 'Condition - user configured',
            provider: 'conditional-user-configured',
            requirement: 'REQUIRED',
            priority: 0,
          },
        ]
      : []),
    {
      parent: ordinary,
      name: 'OTP Form',
      provider: 'auth-otp-form',
      requirement: 'REQUIRED',
      priority: 10,
    },
    { parent: root, name: stepup, requirement: 'CONDITIONAL', priority: 20 },
    {
      parent: stepup,
      name: 'Condition - Level of Authentication',
      provider: 'conditional-level-of-authentication',
      requirement: 'REQUIRED',
      priority: 0,
      config: loa(2),
    },
    { parent: stepup, name: challenge, requirement: 'CONDITIONAL', priority: 10 },
    // Keycloak considers a flow with only a disabled conditional child unsuccessful.
    // This completion marker runs after the required challenge, or after current-request OTP.
    {
      parent: stepup,
      name: 'Allow access',
      provider: 'allow-access-authenticator',
      requirement: 'REQUIRED',
      priority: 20,
    },
    {
      parent: challenge,
      name: 'Condition - credential',
      provider: 'conditional-credential',
      requirement: 'REQUIRED',
      priority: 0,
      config: { credentials: 'otp', included: 'false' },
    },
    {
      parent: challenge,
      name: 'OTP Form',
      provider: 'auth-otp-form',
      requirement: 'REQUIRED',
      priority: 10,
    },
  ];
};
