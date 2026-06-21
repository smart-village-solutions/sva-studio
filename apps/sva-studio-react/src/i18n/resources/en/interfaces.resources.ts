export const interfacesENResources = {
  page: {
    title: 'Interfaces',
    subtitle: 'Manage SVA Mainserver endpoints and check connection status',
  },
  status: {
    cardTitle: 'Connection status',
    instanceLabel: 'Instance',
    currentLabel: 'Status',
    lastCheckedLabel: 'Last checked',
    connected: 'Connected',
    error: 'Error',
    disabled: 'Disabled',
    unknown: 'Unknown',
  },
  table: {
    ariaLabel: 'Interfaces table',
    caption: 'Configured interfaces for the selected instance',
    headerName: 'Name',
    headerType: 'Type',
    headerEndpoint: 'Endpoint',
    headerStatus: 'Status',
    headerLastChecked: 'Last checked',
    emptyState: 'No interfaces are configured for this instance yet.',
    countLabel: '{{count}} interfaces',
  },
  types: {
    mainserver: {
      label: 'SVA Mainserver',
      description: 'Manage GraphQL and OAuth endpoints for the mainserver integration.',
    },
    s3: {
      label: 'S3 Storage',
      description: 'Manage object storage settings for uploads and exports.',
    },
    supabase: {
      label: 'Supabase',
      description:
        'Waste datasource with project URL, schema, database access, and service role key.',
    },
    mailTransport: {
      label: 'Mail transport',
      description:
        'Central technical SMTP integration for transactional delivery.',
    },
    mapGeocoding: {
      label: 'Map & geocoding',
      description:
        'Tenant-owned map and geocoding configuration for address input, coordinates, and map styling.',
    },
  },
  form: {
    sectionTitle: 'Mainserver settings',
    graphqlBaseUrl: 'GraphQL base URL',
    oauthTokenUrl: 'OAuth token URL',
    enabled: 'Integration enabled',
  },
  forms: {
    s3: {
      endpoint: 'Endpoint URL',
      region: 'Region',
      bucket: 'Bucket',
      accessKeyId: 'Access key ID',
      secretAccessKey: 'Secret access key',
      forcePathStyle: 'Force path-style URLs',
      notImplemented:
        'This interface is already persisted on the server. Automated status checks and connection probes are still pending.',
    },
    supabase: {
      projectUrl: 'Project URL',
      schemaName: 'Schema name',
      databaseUrl: 'Direct DB URL',
      serviceRoleKey: 'Service role key',
      notImplemented:
        'This interface is already persisted on the server. Automated status checks and connection probes are still pending.',
    },
    mailTransport: {
      transportId: 'Transport ID',
      host: 'SMTP host',
      port: 'Port',
      securityMode: 'Security mode',
      securityModeOptions: {
        none: 'None',
        starttls: 'STARTTLS',
        tls: 'TLS',
      },
      authMode: 'Authentication mode',
      authModeOptions: {
        none: 'None',
        basic: 'Basic auth',
      },
      username: 'Username',
      password: 'Password',
      defaultFromEmail: 'Default sender address',
      defaultFromName: 'Default sender name',
      defaultReplyToEmail: 'Default reply-to',
      maxBatchSize: 'Maximum batch size',
      rateLimitPerMinute: 'Rate limit per minute',
    },
    mapGeocoding: {
      provider: 'Provider',
      providerOptions: {
        custom: 'Custom',
      },
      styleUrl: 'Style URL',
      suggestEndpoint: 'Suggest endpoint',
      geocodeEndpoint: 'Geocode endpoint',
      reverseGeocodeEndpoint: 'Reverse geocode endpoint',
      apiKey: 'API key',
      requestTimeoutMs: 'Timeout in ms',
      rateLimitPerMinute: 'Rate limit per minute',
      autocompleteEnabled: 'Enable autocomplete',
      geocodeEnabled: 'Enable geocoding',
      reverseGeocodeEnabled: 'Enable reverse geocoding',
      killSwitchEnabled: 'Enable kill switch',
    },
  },
  actions: {
    save: 'Save settings',
    saving: 'Saving ...',
    reload: 'Reload',
  },
  create: {
    action: 'Create interface',
    dialogTitle: 'Create interface',
    dialogDescription: 'Choose the interface type you want to configure for this instance.',
    cancel: 'Cancel',
    continue: 'Continue',
  },
  edit: {
    title: 'Edit interface',
    deleteAction: 'Delete interface',
    deleteConfirmTitle: 'Delete interface?',
    deleteConfirmDescription: 'Do you really want to delete the interface "{{name}}"?',
    deleteConfirm: 'Delete',
    cancel: 'Cancel',
    commonName: 'Name',
    commonEnabled: 'Enabled',
  },
  messages: {
    loading: 'Loading interfaces ...',
    loadError: 'Interfaces could not be loaded.',
    saveSuccess: 'Interface settings were saved.',
    saveError: 'Interface settings could not be saved.',
  },
  errors: {
    configNotFound: 'No mainserver configuration exists for this instance yet.',
    integrationDisabled: 'The mainserver integration is currently disabled.',
    invalidConfig: 'The mainserver configuration is invalid.',
    invalidGraphqlBaseUrl: 'The GraphQL base URL is invalid.',
    invalidOauthTokenUrl: 'The OAuth token URL is invalid.',
    databaseUnavailable: 'The configuration could not be loaded because of a database problem.',
    identityProviderUnavailable: 'The identity provider is currently unavailable.',
    missingCredentials: 'Credentials for the mainserver connection are missing.',
    tokenRequestFailed: 'The access token for the mainserver could not be requested.',
    unauthorized: 'Your session is no longer valid. Please sign in again.',
    forbidden: 'You do not have permission to manage interfaces.',
    customInterfacesNotSupported:
      'Additional interfaces will be supported once the backend for these types is connected.',
    interfaceNotFound: 'The selected interface was not found or has already been removed.',
    interfaceInstanceMismatch:
      'The selected interface belongs to a different instance and could not be changed.',
    interfaceTypeChangeNotSupported:
      'The type of an existing interface cannot be changed afterwards.',
    supabaseRequiresWasteManagementModule:
      'Supabase can only be created for instances that have the waste-management module assigned.',
    secretUnreadable:
      'The stored interface secret could no longer be read on the server. Please enter the secret value again and save once more.',
    networkError: 'The connection status could not be loaded.',
    graphqlError: 'The mainserver returned a GraphQL error.',
    invalidResponse: 'The mainserver returned an unexpected response.',
  },
} as const;
