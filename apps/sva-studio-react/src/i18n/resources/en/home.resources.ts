export const homeENResources = {
  devAuth: {
    prompt: 'Local dev auth is active. Keycloak is bypassed for this session.',
  },
  hero: {
    anonymousEyebrow: 'Welcome',
    anonymousSubtitle: 'The shared workshop for content, modules, and organizations.',
    anonymousBody:
      'Sign in to open the right building blocks, shape content, and continue directly in your working context.',
    eyebrow: 'Studio workspace',
    openSourcePrefix: 'Open Source Software made with',
    openSourceLoveLabel: 'love',
    openSourceSuffix: 'in Bad Belzig',
    subtitle: 'Smart Village App self-service platform for content, modules, and extensions.',
    body: 'Manage content, account context, and connected modules in one shared interface with server-side authentication and authorization checks.',
  },
  session: {
    loading: 'Session is loading ...',
  },
  cards: {
    news: {
      title: 'Create news item',
      description: 'Write a new news item and prepare it for publication.',
    },
    events: {
      title: 'Create event',
      description: 'Add a new event with its date, location, and further details.',
    },
    media: {
      title: 'Upload media',
      description: 'Upload a new image or document to the central media library.',
    },
    users: {
      title: 'Open user management',
      description: 'Manage user accounts and their access to Studio.',
    },
  },
  changelog: {
    title: 'Latest changes',
    description:
      'See the most recent Studio improvements and fixes here immediately after they are merged into main.',
    loading: 'Latest changes are loading ...',
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
