import { createWasteManagementOverviewTranslations } from './plugin.translations.shared.sections.js';

export const wasteManagementPluginTranslationsDEOverview = createWasteManagementOverviewTranslations({
  messages: {
    loading: 'Abfall-Historie wird geladen.',
    loadError: 'Die Abfall-Historie konnte nicht geladen werden.',
    loadForbidden: 'Für die Abfall-Historie fehlt die Berechtigung.',
    emptyTitle: 'Noch keine Historieneinträge',
    emptyBody: 'Die zentrale Auditspur enthält für diese Suche oder Seite noch keine Abfall-Ereignisse.',
  },
  sections: {
    technical: 'Technische Historie',
    audit: 'Audit-Historie',
  },
  technicalTable: {
    ariaLabel: 'Tabelle technischer Abfall-Historieneinträge',
    caption: 'Tabelle technischer Historieneinträge für Abfall.',
    eventType: 'Ereignistyp',
    outcome: 'Ergebnis',
    occurredAt: 'Zeitpunkt',
    jobId: 'Job',
    jobTypeId: 'Jobtyp',
    reasonCode: 'Reason-Code',
    requestId: 'Request-ID',
  },
  auditTable: {
    ariaLabel: 'Tabelle der Abfall-Audit-Historie',
    caption: 'Tabelle der Audit-Historie für Abfall.',
    actionId: 'Action-ID',
    outcome: 'Ergebnis',
    occurredAt: 'Zeitpunkt',
    resource: 'Ressource',
    reasonCode: 'Reason-Code',
    requestId: 'Request-ID',
  },
  meta: {
    total: '{{value}} Historieneinträge gesamt',
    visible: '{{value}} Einträge auf dieser Seite',
    occurredAt: 'Zeitpunkt: {{value}}',
    jobId: 'Job: {{value}}',
    jobTypeId: 'Jobtyp: {{value}}',
    resourceType: 'Ressourcentyp: {{value}}',
    resourceId: 'Ressource: {{value}}',
    reasonCode: 'Reason-Code: {{value}}',
    requestId: 'Request-ID: {{value}}',
  },
  outcome: {
    started: 'Gestartet',
    success: 'Erfolg',
    failure: 'Fehler',
    denied: 'Verweigert',
  },
});
