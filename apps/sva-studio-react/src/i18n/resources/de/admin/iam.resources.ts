export const iamAdminDEResources = {
  page: {
    title: 'Rechte und Vorgänge prüfen',
    subtitle: 'Prüfen Sie Zugriffsrechte, Freigaben und Datenschutzvorgänge.',
  },
  tabs: {
    ariaLabel: 'Bereiche für Rechte und Vorgänge',
    rights: 'Rechte',
    governance: 'Freigaben und Vorgänge',
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
          'Mit „Zugriff prüfen“ testen, ob eine bestimmte Aktion auf einem Inhalt erlaubt ist.',
        third:
          'Quellrollen, Gruppen und Herkunft ansehen, um die Ursache einer Berechtigung besser zu verstehen.',
      },
    },
    governance: {
      title: 'Freigaben und weitere Vorgänge prüfen',
      description:
        'Hier finden Sie Freigaben, übertragene Rechte und ähnliche Vorgänge. Sie sehen, welche Fälle noch offen sind.',
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
          'Einen Eintrag öffnen, um Hindernisse, weitere Angaben und den Bearbeitungsstand zu prüfen.',
      },
    },
    deletionRules: {
      title: 'Regeln für ungenutzte Konten verwalten',
      description:
        'Legen Sie fest, was nach längerer Zeit ohne Anmeldung mit Konten und ihren Inhalten geschieht. Die Regeln gelten für nichttechnische Konten dieser Instanz.',
      options: {
        first:
          'Festlegen, wann Konten deaktiviert, persönliche Angaben entfernt und Konten als gelöscht markiert werden.',
        second:
          'Festlegen, ob Inhalte erhalten bleiben oder dem Status des zugehörigen Kontos folgen.',
        third:
          'Steuern, ob Nutzer diese Standardregel für eigene Inhalte selbst überschreiben dürfen.',
      },
    },
  },
  messages: {
    initializing: 'Rechte und Vorgänge werden geladen ...',
    disabled: 'Die Prüfung von Rechten und Vorgängen ist derzeit deaktiviert.',
    forbidden: 'Sie haben keinen Zugriff auf die Prüfung von Rechten und Vorgängen.',
  },
  shared: {
    all: 'Alle',
    notAvailable: 'Nicht verfügbar',
    pagination: {
      ariaLabel: 'Seitennavigation',
      results: '{{count}} Einträge',
      pageSize: 'Einträge pro Seite',
      page: 'Seite {{page}} von {{totalPages}}',
      previous: 'Zurück',
      next: 'Weiter',
    },
    createdAt: 'Erstellt: {{value}}',
    type: 'Typ: {{value}}',
    ticket: 'Ticket: {{value}}',
    target: 'Ziel: {{value}}',
    status: 'Status',
    actor: 'Auslöser',
    targetLabel: 'Zielkonto',
    requester: 'Anfragende Person',
    requestNote: 'Anfragebeschreibung',
    meta: 'Weitere Angaben',
    selectPrompt: 'Wählen Sie links einen Eintrag aus, um Details anzuzeigen.',
  },
  rights: {
    empty: 'Keine derzeit gültigen Rechte gefunden.',
    tableAriaLabel: 'Tabelle der derzeit gültigen Rechte',
    noOrganization: 'Keine Organisation',
    columns: {
      action: 'Aktion',
      area: 'Bereich',
      resourceType: 'Ressourcentyp',
      resourceId: 'Ressourcen-ID',
      organization: 'Organisation',
      scope: 'Geltungsbereich',
      sourceRoles: 'Zugehörige Rollen',
      sourceGroups: 'Zugehörige Gruppen',
      origin: 'Herkunft',
    },
    filters: {
      organization: 'Organisation',
      actingAs: 'Rechte prüfen für',
      search: 'Suche',
    },
    subject: {
      title: 'Geprüfte Person',
      impersonating: 'Prüfung ausgelöst von {{actor}}',
      self: 'Eigene Rechte',
    },
    messages: {
      error: 'Berechtigungen konnten nicht geladen werden: {{value}}',
    },
    authorize: {
      action: 'Aktion',
      resourceType: 'Ressourcentyp',
      resourceId: 'Ressourcen-ID',
      organizationId: 'Organisation',
      run: 'Zugriff prüfen',
      running: 'Zugriff wird geprüft ...',
      allowed: 'Erlaubt',
      denied: 'Verweigert',
      instanceRequired: 'Instanz-ID fehlt.',
      summary: {
        action: 'Geprüfte Aktion',
        resource: 'Ressource',
        organization: 'Gewählte Organisation',
        cause: 'Ursache',
        origin: 'Woher das Recht stammt',
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
      news: 'Nachrichten',
      events: 'Veranstaltungen',
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
    title: 'Regeln für ungenutzte Konten',
    subtitle:
      'Legen Sie fest, nach wie vielen Tagen ohne erfolgreiche Anmeldung Konten deaktiviert, persönliche Angaben entfernt und Konten als gelöscht markiert werden. Die Regel für Inhalte wählen Sie darunter.',
    fields: {
      deactivateAfterDays: 'Konto deaktivieren nach Tagen ohne Anmeldung',
      pseudonymizeAfterDays: 'Persönliche Angaben entfernen nach Tagen ohne Anmeldung',
      deleteAfterDays: 'Konto als gelöscht markieren nach Tagen ohne Anmeldung',
      defaultContentStrategy: 'Was soll mit zugehörigen Inhalten geschehen?',
      allowContentPreferenceOverride: 'Personen dürfen für eigene Inhalte eine andere Regel wählen',
      allowContentPreferenceOverrideHint:
        'Wenn diese Option ausgeschaltet ist, können Personen die Regel für ihre Inhalte nicht selbst ändern.',
    },
    actions: {
      save: 'Löschregeln speichern',
      saving: 'Wird gespeichert…',
      saved: 'Gespeichert',
    },
    messages: {
      loading: 'Regeln für ungenutzte Konten werden geladen ...',
      instanceMissing: 'Wählen Sie eine Instanz, um ihre Regeln für ungenutzte Konten anzusehen.',
      readOnly: 'Diese Löschregeln sind nur lesbar.',
    },
    strategies: {
      retain: 'Inhalte beibehalten',
      with_owner_lifecycle: 'Inhalte entsprechend dem Kontostatus behandeln',
    },
  },
} as const;
