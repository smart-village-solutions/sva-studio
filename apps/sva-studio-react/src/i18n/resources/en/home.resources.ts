export const homeENResources = {
  devAuth: {
    prompt: 'Local dev auth is active. Keycloak is bypassed for this session.',
  },
  hero: {
    eyebrow: 'Studio workspace',
    openSourcePrefix: 'Open Source Software made with',
    openSourceLoveLabel: 'love',
    openSourceSuffix: 'in Bad Belzig',
    subtitle: 'Smart Village App self-service platform for content, modules, and extensions.',
    body: 'Manage content, account context, and connected modules in one shared interface with server-side authentication and authorization checks.',
    primaryAction: 'Open content',
    secondaryAction: 'Open account',
  },
  session: {
    loading: 'Session is loading ...',
  },
  sections: {
    overviewTitle: 'Direct entry points',
    overviewBody:
      'Use the key areas directly from the home page. Details about roles, guards, and technical decisions remain within their dedicated feature areas.',
  },
  cards: {
    content: {
      title: 'Content',
      description:
        'Manage editorial content, metadata, and publication states in the central content area.',
      action: 'Open content',
    },
    account: {
      title: 'Account',
      description:
        'Review your profile, privacy context, and other self-service account capabilities.',
      action: 'Open account',
    },
    interfaces: {
      title: 'Interfaces',
      description: 'Review connected integrations and open the managed interface sections.',
      action: 'Open interfaces',
    },
  },
  changelog: {
    title: 'Latest changes',
    description:
      'See the most recent Studio improvements and fixes here immediately after they are merged into main.',
    empty: 'No changes are available yet.',
    error: 'The latest changes could not be loaded right now.',
    entryTitle: 'Change from PR #{{prNumber}}',
  },
  authError: {
    loginFailed: 'Login failed. Please try again.',
    stateExpired: 'Login was cancelled or expired. Please sign in again.',
    sessionExpired: 'Your session has expired. Please sign in again.',
    insufficientRole:
      'You do not have permission to access this page. Please contact an administrator.',
    sessionLoadFailed: 'Session could not be loaded. Please sign in again.',
    requestId: 'Request ID: {{requestId}}',
    authFlowId: 'Auth flow: {{authFlowId}}',
    loginAction: 'Sign in again',
  },
} as const;
