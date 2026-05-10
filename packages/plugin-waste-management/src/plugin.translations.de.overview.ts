export const wasteManagementPluginTranslationsDEOverview = {
  "overview": {
    "messages": {
      "loading": "Waste-Historie wird geladen.",
      "loadError": "Die Waste-Historie konnte nicht geladen werden.",
      "loadForbidden": "Für die Waste-Historie fehlt die Berechtigung.",
      "emptyTitle": "Noch keine Historieneinträge",
      "emptyBody": "Die zentrale Auditspur enthält für diese Suche oder Seite noch keine Waste-Ereignisse."
    },
    "sections": {
      "technical": "Technische Historie",
      "audit": "Audit-Historie"
    },
    "meta": {
      "total": "{{value}} Historieneinträge gesamt",
      "visible": "{{value}} Einträge auf dieser Seite",
      "occurredAt": "Zeitpunkt: {{value}}",
      "jobId": "Job: {{value}}",
      "jobTypeId": "Jobtyp: {{value}}",
      "resourceType": "Ressourcentyp: {{value}}",
      "resourceId": "Ressource: {{value}}",
      "reasonCode": "Reason-Code: {{value}}",
      "requestId": "Request-ID: {{value}}"
    },
    "outcome": {
      "started": "Gestartet",
      "success": "Erfolg",
      "failure": "Fehler",
      "denied": "Verweigert"
    }
  }
} as const;
