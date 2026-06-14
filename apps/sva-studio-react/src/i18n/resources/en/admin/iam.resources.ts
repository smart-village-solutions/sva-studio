export const iamAdminENResources = {
  page: {
    title: 'IAM transparency cockpit',
    subtitle: 'Inspect rights, governance cases, and privacy workflows with typed read models.',
  },
  tabs: {
    ariaLabel: 'IAM transparency tabs',
    rights: 'Rights',
    governance: 'Governance',
    dsr: 'Privacy',
    deletionRules: 'Deletion rules',
  },
  tabHelp: {
    optionsLabel: 'What you can do here',
    rights: {
      title: 'Check rights in plain language',
      description:
        'This area shows which permissions are currently effective for a user in the selected context. It helps explain why something is allowed or denied.',
      options: {
        first: 'Filter by organization, user context, or search terms to narrow the list.',
        second:
          'Use "Check authorize" to test a specific access decision for an action and resource.',
        third:
          'Review source roles, groups, and origin to understand where a permission comes from.',
      },
    },
    governance: {
      title: 'Understand governance cases',
      description:
        'This area lists approvals, delegations, and similar IAM processes. It helps you review open cases and understand their current status.',
      options: {
        first: 'Filter by search term, case type, or status to find the relevant case faster.',
        second: 'Open a case to inspect involved people, ticket context, and additional details.',
        third: 'Export the current view as CSV if your role includes that permission.',
      },
    },
    dsr: {
      title: 'Track privacy cases',
      description:
        'This area shows requests and workflows related to privacy, exports, and legal holds. It helps you see what is done already and where action is still needed.',
      options: {
        first: 'Filter by type and status to focus on open or completed cases.',
        second: 'Compare affected and requesting people to understand the case correctly.',
        third: 'Open an entry to inspect blockers, metadata, and the exact processing state.',
      },
    },
    deletionRules: {
      title: 'Manage tenant-wide deletion rules',
      description:
        'This area defines how account and content cleanup works over time. The settings apply across the tenant and control the default lifecycle for deactivation, pseudonymization, and deletion.',
      options: {
        first:
          'Review or change the day-based time limits for deactivation, pseudonymization, and deletion.',
        second: 'Choose whether content is kept by default or follows the owner lifecycle.',
        third: 'Control whether users may override the default rule for their own content.',
      },
    },
  },
  messages: {
    initializing: 'Initializing IAM transparency cockpit ...',
    disabled: 'The IAM transparency cockpit is currently disabled.',
    forbidden: 'The required roles for this IAM transparency cockpit are missing.',
  },
  shared: {
    all: 'All',
    createdAt: 'Created: {{value}}',
    type: 'Type: {{value}}',
    ticket: 'Ticket: {{value}}',
    target: 'Target: {{value}}',
    status: 'Status',
    actor: 'Actor',
    targetLabel: 'Target account',
    requester: 'Requester',
    requestNote: 'Request description',
    meta: 'Metadata',
    selectPrompt: 'Select an entry on the left to inspect details.',
  },
  rights: {
    empty: 'No effective permissions found.',
    tableAriaLabel: 'Table of effective permissions',
    noOrganization: 'No organization',
    columns: {
      action: 'Action',
      area: 'Area',
      resourceType: 'Resource type',
      resourceId: 'Resource ID',
      organization: 'Organization',
      effect: 'Effect',
      scope: 'Scope',
      sourceRoles: 'Source roles',
      sourceGroups: 'Source groups',
      origin: 'Origin',
    },
    filters: {
      organization: 'Organization',
      actingAs: 'Acting as',
      search: 'Search',
    },
    subject: {
      title: 'Subject',
      impersonating: 'Impersonated by {{actor}}',
      self: 'Own context',
    },
    messages: {
      error: 'Permissions could not be loaded: {{value}}',
    },
    authorize: {
      action: 'Action',
      resourceType: 'Resource type',
      resourceId: 'Resource ID',
      organizationId: 'Organization',
      run: 'Check authorize',
      running: 'Checking authorize ...',
      allowed: 'Allowed',
      denied: 'Denied',
      instanceRequired: 'Instance ID is missing.',
      summary: {
        action: 'Checked action',
        resource: 'Resource',
        organization: 'Context organization',
        cause: 'Cause',
        origin: 'Derivation',
      },
    },
    permissionSource: {
      user: 'User',
      role: 'Role',
      group: 'Group',
      delegation: 'Delegation',
    },
    permissionResources: {
      content: 'Content',
      iam: 'IAM',
      users: 'Users',
      roles: 'Roles',
      groups: 'Groups',
      organizations: 'Organizations',
      legal: 'Legal texts',
      app: 'App',
      cockpit: 'Cockpit',
      interfaces: 'Interfaces',
      instance: 'Instance registry',
      integration: 'Integrations',
      feature: 'Feature flags',
      media: 'Media',
      news: 'News',
      events: 'Events',
      poi: 'POI',
      wasteManagement: 'Waste management',
    },
  },
  governance: {
    tableAriaLabel: 'Governance cases',
    tableCaption: 'Governance cases table',
    detailLink: 'Open governance detail',
    actions: {
      exportCsv: 'Export CSV',
    },
    columns: {
      case: 'Case',
      status: 'Status',
      actors: 'People',
      ticket: 'Ticket',
      createdAt: 'Created',
      updatedAt: 'Updated',
    },
    filters: {
      search: 'Search',
      type: 'Type',
      status: 'Status',
    },
    detail: {
      title: 'Governance detail',
      subtitle: 'Inspect status, involved identities, ticket context, and governance metadata.',
      back: 'Back to governance overview',
      loading: 'Loading governance detail ...',
      notFound: 'The governance case was not found.',
    },
    messages: {
      exportHint: 'Download the current governance view as a compliance export.',
      loading: 'Loading governance cases ...',
      empty: 'No governance cases found.',
    },
    types: {
      permission_change: 'Permission change',
      delegation: 'Delegation',
      impersonation: 'Impersonation',
      legal_acceptance: 'Legal acceptance',
    },
  },
  dsr: {
    tableAriaLabel: 'Privacy cases',
    tableCaption: 'Privacy cases table',
    detailLink: 'Open privacy case detail',
    columns: {
      case: 'Case',
      status: 'Status',
      people: 'Affected / requester',
      blocker: 'Blocker',
      createdAt: 'Created',
      completedAt: 'Completed',
    },
    filters: {
      search: 'Search',
      type: 'Type',
      status: 'Canonical status',
    },
    detail: {
      title: 'Privacy case detail',
      subtitle: 'Inspect status, affected person, blockers, and case metadata.',
      back: 'Back to privacy overview',
      loading: 'Loading privacy case detail ...',
      notFound: 'The privacy case was not found.',
    },
    messages: {
      loading: 'Loading privacy cases ...',
      empty: 'No privacy cases found.',
    },
    status: {
      queued: 'Queued',
      inProgress: 'In progress',
      completed: 'Completed',
      blocked: 'Blocked',
      failed: 'Failed',
    },
    types: {
      request: 'Request',
      export_job: 'Export job',
      legal_hold: 'Legal hold',
      profile_correction: 'Profile correction',
      recipient_notification: 'Recipient notification',
    },
  },
  deletionRules: {
    title: 'Tenant deletion rules',
    subtitle:
      'Manage the tenant-wide deadlines for deactivation, pseudonymization, and soft delete as well as the default content rule.',
    fields: {
      deactivateAfterDays: 'Deactivation after days',
      pseudonymizeAfterDays: 'Pseudonymization after days',
      deleteAfterDays: 'Deletion after days',
      defaultContentStrategy: 'Default content rule',
      allowContentPreferenceOverride: 'Users may override the default rule for their own content',
      allowContentPreferenceOverrideHint:
        'If disabled, no personal override is shown in the privacy cockpit.',
    },
    actions: {
      save: 'Save deletion rules',
      saving: 'Saving deletion rules ...',
    },
    messages: {
      loading: 'Loading tenant deletion rules ...',
      instanceMissing: 'Tenant deletion rules require an instance context.',
      readOnly: 'These deletion rules are read-only.',
    },
    strategies: {
      retain: 'Keep content',
      with_owner_lifecycle: 'Handle content together with the owner lifecycle',
    },
  },
} as const;
