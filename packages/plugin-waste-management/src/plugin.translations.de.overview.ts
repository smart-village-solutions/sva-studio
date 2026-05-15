import { createWasteManagementOverviewTranslations } from './plugin.translations.shared.sections.js';

export const wasteManagementPluginTranslationsDEOverview = createWasteManagementOverviewTranslations({
  messages: {
    loading: 'Waste-Historie wird geladen.',
    loadError: 'Die Waste-Historie konnte nicht geladen werden.',
    loadForbidden: 'Für die Waste-Historie fehlt die Berechtigung.',
    emptyTitle: 'Noch keine Historieneinträge',
    emptyBody: 'Die zentrale Auditspur enthält für diese Suche oder Seite noch keine Waste-Ereignisse.',
  },
  sections: {
    technical: 'Technische Historie',
    audit: 'Audit-Historie',
  },
  technicalTable: {
    ariaLabel: 'Tabelle technischer Waste-Historieneinträge',
    caption: 'Tabelle technischer Historieneinträge für Waste.',
    eventType: 'Ereignistyp',
    outcome: 'Ergebnis',
    occurredAt: 'Zeitpunkt',
    jobId: 'Job',
    jobTypeId: 'Jobtyp',
    reasonCode: 'Reason-Code',
    requestId: 'Request-ID',
  },
  auditTable: {
    ariaLabel: 'Tabelle der Waste-Audit-Historie',
    caption: 'Tabelle der Audit-Historie für Waste.',
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
