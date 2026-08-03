export const pluginsENResources = {
  news: {
    description: 'Publishes news and editorial updates for the tenant.',
  },
  events: {
    description: 'Publishes events and scheduling data for the tenant.',
  },
  poi: {
    description: 'Publishes places and related location information for the tenant.',
  },
  'generic-items': {
    description: 'Publishes flexible generic items for the tenant.',
  },
  faq: {
    description: 'Publishes multilingual questions and answers for the tenant.',
  },
  'cockpit-cards': {
    description: 'Publishes categorized cockpit cards with text, images, and a related link.',
  },
  projects: {
    description: 'Publishes featured projects with editorial text and an ordered image gallery.',
  },
  categories: {
    description:
      'Provides Mainserver categories as an editorial companion module for news, events, and places.',
  },
  'waste-management': {
    description:
      'Enables waste management with master data, route planning, and operations tooling.',
  },
  empty: {
    description: '',
  },
} as const;
