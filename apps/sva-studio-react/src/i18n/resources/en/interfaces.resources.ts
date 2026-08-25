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
    configured: 'Configured',
    error: 'Error',
    disabled: 'Disabled',
    unknown: 'Unknown',
    healthcheck: {
      disabled: 'The map and geocoding interface is disabled by its kill switch.',
      secretMissing: 'The API key for this map and geocoding interface is missing.',
      mapGeocodingProviderUnsupported:
        'Automated connection checks currently support Geoapify only.',
      mapGeocodingAuthFailed: 'The Geoapify API key is invalid or not authorized.',
      mapGeocodingRateLimited: 'Geoapify rate-limited the connection check.',
      mapGeocodingUnreachable: 'Geoapify cannot be reached for the connection check.',
      mapGeocodingProviderError: 'Geoapify could not complete the connection check.',
    },
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
    postgresql: {
      label: 'PostgreSQL',
      description: 'Direct PostgreSQL datasource with a schema and encrypted database credentials.',
    },
    mailTransport: {
      label: 'Mail transport',
      description: 'Central technical SMTP integration for transactional delivery.',
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
    postgresql: {
      schemaName: 'Schema name',
      databaseUrl: 'Database URL',
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
      setup: {
        title: 'Recommended setup with Geoapify',
        description: 'A Geoapify API key is required for automatic postal code enrichment.',
        createProject: 'Sign in to Geoapify and create a project',
        copyApiKey: 'Copy the generated API key and enter it in the API key field below',
        keepDefaults:
          'Leave the endpoint fields empty, enable geocoding, and keep the kill switch disabled',
        openGeoapify: 'Create a Geoapify project and API key',
      },
      provider: 'Provider',
      providerOptions: {
        custom: 'Custom',
      },
      styleUrl: 'Style URL',
      suggestEndpoint: 'Suggest endpoint',
      geocodeEndpoint: 'Geocode endpoint',
      reverseGeocodeEndpoint: 'Reverse geocode endpoint',
      apiKey: 'API key',
      apiKeyReplacementPlaceholder: 'Enter a new API key',
      apiKeyConfiguredStatus: 'An API key is already configured',
      apiKeyConfiguredHint: 'Leave blank to keep the existing API key',
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
    saving: 'Saving…',
    saved: 'Saved',
    retry: 'Try again',
    reload: 'Reload',
    dismiss: 'Dismiss',
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
    deletePending: 'Deleting…',
    cancel: 'Cancel',
    commonName: 'Name',
    commonEnabled: 'Enabled',
  },
  messages: {
    loading: 'Loading interfaces ...',
    loadError: 'Interfaces could not be loaded.',
    saveSuccess: 'Interface settings were saved.',
    saveError: 'Interface settings could not be saved.',
    refreshAfterSaveError:
      'The settings were submitted but could not be reloaded. Please try again.',
    deleteSuccessTitle: 'Interface deleted',
    deleteSuccess: 'The interface “{{name}}” was permanently deleted.',
    deleteError: 'The interface could not be deleted.',
    refreshAfterDeleteError:
      'The interface was deleted, but the list could not be refreshed. Please reload.',
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
    interfaceTypeNotRegistered:
      'The interface type is not registered in this installation yet. Please run the Studio database migrations and try again.',
    supabaseRequiresWasteManagementModule:
      'Supabase can only be created for instances that have the waste-management module assigned.',
    secretUnreadable:
      'The stored interface secret could no longer be read on the server. Please enter the secret value again and save once more.',
    networkError: 'The connection status could not be loaded.',
    graphqlError: 'The mainserver returned a GraphQL error.',
    invalidResponse: 'The mainserver returned an unexpected response.',
  },
} as const;
