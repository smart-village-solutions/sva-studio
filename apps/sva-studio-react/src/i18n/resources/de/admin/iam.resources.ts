export const iamAdminDEResources = {
  page: {
    title: 'IAM Transparenz-Cockpit',
    subtitle:
      'Rechte, Governance-Fälle und Datenschutzvorgänge mit typisierten Read-Modellen prüfen.',
  },
  tabs: {
    ariaLabel: 'IAM Transparenz Tabs',
    rights: 'Rechte',
    governance: 'Governance',
    dsr: 'Datenschutz',
    deletionRules: 'Löschregeln',
  },
  tabHelp: {
    optionsLabel: 'Das können Sie hier tun',
    rights: {
      title: 'Rechte verständlich prüfen',
      description:
        'Hier sehen Sie, welche Berechtigungen für einen Benutzer im aktuellen Kontext wirksam sind. So können Sie leichter nachvollziehen, warum etwas erlaubt oder verboten ist.',
      options: {
        first:
          'Nach Organisation, Nutzerkontext oder Begriffen filtern, um die Liste einzugrenzen.',
        second:
          'Mit "Authorize prüfen" einen konkreten Zugriff testen, zum Beispiel für eine Aktion auf einem Inhalt.',
        third:
          'Quellrollen, Gruppen und Herkunft ansehen, um die Ursache einer Berechtigung besser zu verstehen.',
      },
    },
    governance: {
      title: 'Governance-Fälle einordnen',
      description:
        'Hier finden Sie Freigaben, Delegationen und ähnliche IAM-Vorgänge. Der Bereich hilft dabei, offene Fälle zu sichten und deren Status nachzuvollziehen.',
      options: {
        first:
          'Nach Suchbegriff, Falltyp oder Status filtern, um schneller den passenden Fall zu finden.',
        second: 'Einen Fall öffnen, um Beteiligte, Ticketbezug und weitere Details anzusehen.',
        third: 'Bei vorhandener Berechtigung die aktuelle Sicht als CSV exportieren.',
      },
    },
    dsr: {
      title: 'Datenschutzfälle im Blick behalten',
      description:
        'Hier sehen Sie Vorgänge rund um Datenschutzanfragen, Exporte und rechtliche Sperren. So erkennen Sie schneller, was schon erledigt ist und wo noch Handlungsbedarf besteht.',
      options: {
        first:
          'Nach Art und Status filtern, um offene oder abgeschlossene Fälle gezielt anzuzeigen.',
        second:
          'Betroffene und anfragende Personen vergleichen, um den Fall fachlich richtig einzuordnen.',
        third:
          'Einen Eintrag öffnen, um Blocker, Metadaten und den genauen Bearbeitungsstand zu prüfen.',
      },
    },
    deletionRules: {
      title: 'Löschregeln tenantweit verwalten',
      description:
        'Hier legen Sie fest, nach welchen Fristen Konten und Inhalte behandelt werden. Die Einstellungen gelten tenantweit und steuern die Standardlogik für Deaktivierung, Pseudonymisierung und Löschung.',
      options: {
        first:
          'Fristen in Tagen für Deaktivierung, Pseudonymisierung und Löschung prüfen oder anpassen.',
        second:
          'Festlegen, ob Inhalte standardmäßig erhalten bleiben oder mit dem Besitzer-Lebenszyklus mitlaufen.',
        third:
          'Steuern, ob Nutzer diese Standardregel für eigene Inhalte selbst überschreiben dürfen.',
      },
    },
  },
  messages: {
    initializing: 'IAM Transparenz-Cockpit wird initialisiert ...',
    disabled: 'Das IAM Transparenz-Cockpit ist derzeit deaktiviert.',
    forbidden: 'Für dieses IAM Transparenz-Cockpit fehlen die erforderlichen Rollen.',
  },
  shared: {
    all: 'Alle',
    createdAt: 'Erstellt: {{value}}',
    type: 'Typ: {{value}}',
    ticket: 'Ticket: {{value}}',
    target: 'Ziel: {{value}}',
    status: 'Status',
    actor: 'Auslöser',
    targetLabel: 'Zielkonto',
    requester: 'Anfragende Person',
    requestNote: 'Anfragebeschreibung',
    meta: 'Metadaten',
    selectPrompt: 'Wählen Sie links einen Eintrag aus, um Details anzuzeigen.',
  },
  rights: {
    empty: 'Keine effektiven Berechtigungen gefunden.',
    tableAriaLabel: 'Tabelle effektiver Berechtigungen',
    noOrganization: 'Keine Organisation',
    columns: {
      action: 'Aktion',
      area: 'Bereich',
      resourceType: 'Ressourcentyp',
      resourceId: 'Ressourcen-ID',
      organization: 'Organisation',
      effect: 'Effekt',
      scope: 'Scope',
      sourceRoles: 'Quellrollen',
      sourceGroups: 'Quellgruppen',
      origin: 'Herkunft',
    },
    filters: {
      organization: 'Organisation',
      actingAs: 'Handeln als',
      search: 'Suche',
    },
    subject: {
      title: 'Subjekt',
      impersonating: 'Impersonation durch {{actor}}',
      self: 'Eigener Kontext',
    },
    messages: {
      error: 'Berechtigungen konnten nicht geladen werden: {{value}}',
    },
    authorize: {
      action: 'Aktion',
      resourceType: 'Ressourcentyp',
      resourceId: 'Ressourcen-ID',
      organizationId: 'Organisation',
      run: 'Authorize prüfen',
      running: 'Authorize wird geprüft ...',
      allowed: 'Erlaubt',
      denied: 'Verweigert',
      instanceRequired: 'Instanz-ID fehlt.',
      summary: {
        action: 'Geprüfte Aktion',
        resource: 'Ressource',
        organization: 'Kontext-Organisation',
        cause: 'Ursache',
        origin: 'Herleitung',
      },
    },
    permissionSource: {
      user: 'Nutzer',
      role: 'Rolle',
      group: 'Gruppe',
      delegation: 'Delegation',
    },
    permissionResources: {
      content: 'Inhalte',
      iam: 'IAM',
      users: 'Benutzer',
      roles: 'Rollen',
      groups: 'Gruppen',
      organizations: 'Organisationen',
      legal: 'Rechtstexte',
      app: 'App',
      cockpit: 'Cockpit',
      interfaces: 'Schnittstellen',
      instance: 'Instanz-Registry',
      integration: 'Integrationen',
      feature: 'Feature-Flags',
      media: 'Medien',
      news: 'News',
      events: 'Events',
      poi: 'POI',
      wasteManagement: 'Abfallmanagement',
    },
  },
  governance: {
    tableAriaLabel: 'Governance-Fälle',
    tableCaption: 'Tabelle der Governance-Fälle',
    detailLink: 'Governance-Detail öffnen',
    actions: {
      exportCsv: 'CSV exportieren',
    },
    columns: {
      case: 'Fall',
      status: 'Status',
      actors: 'Beteiligte',
      ticket: 'Ticket',
      createdAt: 'Erstellt',
      updatedAt: 'Aktualisiert',
    },
    filters: {
      search: 'Suche',
      type: 'Typ',
      status: 'Status',
    },
    detail: {
      title: 'Governance-Detail',
      subtitle: 'Prüfen Sie Status, Beteiligte, Ticketbezug und Metadaten des Governance-Falls.',
      back: 'Zur Governance-Übersicht',
      loading: 'Governance-Detail wird geladen ...',
      notFound: 'Der Governance-Fall wurde nicht gefunden.',
    },
    messages: {
      exportHint:
        'Die aktuelle Governance-Ansicht kann als Compliance-Export heruntergeladen werden.',
      loading: 'Governance-Fälle werden geladen ...',
      empty: 'Keine Governance-Fälle gefunden.',
    },
    types: {
      permission_change: 'Rechteänderung',
      delegation: 'Delegation',
      impersonation: 'Impersonation',
      legal_acceptance: 'Rechtstext-Akzeptanz',
    },
  },
  dsr: {
    tableAriaLabel: 'Datenschutzfälle',
    tableCaption: 'Tabelle der Datenschutzfälle',
    detailLink: 'Datenschutzfall-Detail öffnen',
    columns: {
      case: 'Fall',
      status: 'Status',
      people: 'Betroffene / Anfragende',
      blocker: 'Blocker',
      createdAt: 'Erstellt',
      completedAt: 'Abgeschlossen',
    },
    filters: {
      search: 'Suche',
      type: 'Typ',
      status: 'Kanonischer Status',
    },
    detail: {
      title: 'Datenschutzfall-Detail',
      subtitle: 'Prüfen Sie Status, betroffene Person, Blocker und Fallmetadaten.',
      back: 'Zur Datenschutz-Übersicht',
      loading: 'Datenschutzfall-Detail wird geladen ...',
      notFound: 'Der Datenschutzfall wurde nicht gefunden.',
    },
    messages: {
      loading: 'Datenschutzfälle werden geladen ...',
      empty: 'Keine Datenschutzfälle gefunden.',
    },
    status: {
      queued: 'Eingeplant',
      inProgress: 'In Bearbeitung',
      completed: 'Abgeschlossen',
      blocked: 'Blockiert',
      failed: 'Fehlgeschlagen',
    },
    types: {
      request: 'Betroffenenanfrage',
      export_job: 'Export-Job',
      legal_hold: 'Rechtliche Sperre',
      profile_correction: 'Profilkorrektur',
      recipient_notification: 'Empfängerbenachrichtigung',
    },
  },
  deletionRules: {
    title: 'Tenant-Löschregeln',
    subtitle:
      'Verwalten Sie die tenantweiten Fristen für Deaktivierung, Pseudonymisierung und Soft-Delete sowie die Standardregel für Inhalte.',
    fields: {
      deactivateAfterDays: 'Deaktivierung nach Tagen',
      pseudonymizeAfterDays: 'Pseudonymisierung nach Tagen',
      deleteAfterDays: 'Löschung nach Tagen',
      defaultContentStrategy: 'Standardregel für Inhalte',
      allowContentPreferenceOverride:
        'Nutzer dürfen die Standardregel für eigene Inhalte überschreiben',
      allowContentPreferenceOverrideHint:
        'Wenn deaktiviert, wird im Datenschutz-Cockpit keine persönliche Überschreibung angeboten.',
    },
    actions: {
      save: 'Löschregeln speichern',
      saving: 'Löschregeln werden gespeichert ...',
    },
    messages: {
      loading: 'Tenant-Löschregeln werden geladen ...',
      instanceMissing: 'Instanzkontext fehlt für Tenant-Löschregeln.',
      readOnly: 'Diese Löschregeln sind nur lesbar.',
    },
    strategies: {
      retain: 'Inhalte beibehalten',
      with_owner_lifecycle: 'Inhalte mitbehandeln',
    },
  },
} as const;
