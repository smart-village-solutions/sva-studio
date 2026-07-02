export const adminBootstrapInstancesAdminENResources = {
  title: 'Admin structure',
  subtitlePending:
    'This section stays visible in the happy path but only becomes actionable after the registry create succeeded.',
  subtitleReady:
    'Optionally select modules and then synchronize `system_admin` together with the IAM baseline for the assigned modules.',
  moduleHint: 'Initially grants: {{value}}',
  conflictHint:
    'A repeated bootstrap only restores the protected `system_admin` role to the target state. Existing custom roles stay untouched.',
  action: 'Create tenant admin structure now',
  actionHintPending: 'Create the instance first, then this step becomes active.',
  actionHintReady:
    'Without selecting modules, only `system_admin` is synchronized as the tenant-wide full-access role.',
  success:
    'The tenant admin structure was synchronized successfully. This setup step is now complete.',
  modules: {
    categories: 'Categories',
    news: 'News',
    events: 'Events',
    poi: 'POI',
    media: 'Media',
    surveys: 'Surveys',
    wasteManagement: 'Waste management',
  },
} as const;
