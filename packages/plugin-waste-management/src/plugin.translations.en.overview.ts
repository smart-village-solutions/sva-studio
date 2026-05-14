export const wasteManagementPluginTranslationsENOverview = {
  "overview": {
    "messages": {
      "loading": "Loading waste history.",
      "loadError": "Waste history could not be loaded.",
      "loadForbidden": "Missing permission for waste history.",
      "emptyTitle": "No history entries yet",
      "emptyBody": "The central audit trail does not yet contain waste events for this search or page."
    },
    "sections": {
      "technical": "Technical history",
      "audit": "Audit history"
    },
    "technical": {
      "table": {
        "ariaLabel": "Table of technical waste history entries",
        "caption": "Table of technical history entries for waste.",
        "eventType": "Event type",
        "outcome": "Outcome",
        "occurredAt": "Occurred at",
        "jobId": "Job",
        "jobTypeId": "Job type",
        "reasonCode": "Reason code",
        "requestId": "Request ID"
      }
    },
    "audit": {
      "table": {
        "ariaLabel": "Table of waste audit history",
        "caption": "Table of audit history entries for waste.",
        "actionId": "Action ID",
        "outcome": "Outcome",
        "occurredAt": "Occurred at",
        "resource": "Resource",
        "reasonCode": "Reason code",
        "requestId": "Request ID"
      }
    },
    "meta": {
      "total": "{{value}} history entries total",
      "visible": "{{value}} entries on this page",
      "occurredAt": "Occurred at: {{value}}",
      "jobId": "Job: {{value}}",
      "jobTypeId": "Job type: {{value}}",
      "resourceType": "Resource type: {{value}}",
      "resourceId": "Resource: {{value}}",
      "reasonCode": "Reason code: {{value}}",
      "requestId": "Request ID: {{value}}"
    },
    "outcome": {
      "started": "Started",
      "success": "Success",
      "failure": "Failure",
      "denied": "Denied"
    }
  }
} as const;
