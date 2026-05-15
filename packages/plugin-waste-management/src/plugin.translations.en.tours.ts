export const wasteManagementPluginTranslationsENTours = {
  "tours": {
    "actions": {
      "openCreate": "Create tour",
      "edit": "Edit",
      "cancel": "Cancel",
      "create": "Save tour",
      "save": "Save changes",
      "saving": "Saving…"
    },
    "fields": {
      "name": "Name",
      "description": "Description",
      "recurrence": "Recurrence",
      "recurrenceUnset": "No recurrence",
      "firstDate": "First date",
      "endDate": "End date",
      "customDates": "Custom dates",
      "customDatesPlaceholder": "2026-05-12 | Special pickup\n2026-05-26",
      "wasteFractions": "Waste fractions",
      "noFractionsAvailable": "No waste fractions are available yet.",
      "active": "Status"
    },
    "dialog": {
      "createTitle": "Create tour",
      "createDescription": "Create the first editable tour including fractions and date logic.",
      "editTitle": "Edit tour",
      "editDescription": "Adjust fractions, recurrence and date logic for the tour."
    },
    "meta": {
      "count": "{{value}} tours",
      "recurrence": "Recurrence: {{value}}",
      "fractionCount": "Fractions: {{value}}",
      "locationCount": "Collection locations: {{value}}",
      "dateRange": "Date range: {{value}}",
      "tourId": "Tour ID: {{value}}"
    },
    "table": {
      "ariaLabel": "Waste tours",
      "caption": "Table of waste tours with status, assignments, and actions.",
      "name": "Tour",
      "status": "Status",
      "recurrence": "Recurrence",
      "fractions": "Fractions",
      "locations": "Collection locations",
      "dateRange": "Date range",
      "assignments": "Assignments",
      "customDates": "Custom dates",
      "tourId": "Tour ID",
      "actions": "Actions",
      "loadingAssignments": "Loading assignments",
      "noAssignments": "No assignments",
      "noCustomDates": "No custom dates"
    },
    "recurrence": {
      "weekly": "Weekly",
      "biweekly": "Biweekly",
      "fourweekly": "Every four weeks",
      "yearly": "Yearly",
      "onDemand": "On demand",
      "custom": "Custom"
    },
    "customDates": {
      "title": "Custom dates"
    },
    "messages": {
      "loading": "Loading tours.",
      "loadError": "Waste tours could not be loaded.",
      "loadForbidden": "Missing permission for waste tours.",
      "emptyTitle": "No tours found",
      "emptyBody": "Adjust the filters or provide tours in the waste data source.",
      "createSuccess": "The waste tour was created.",
      "updateSuccess": "The waste tour was updated.",
      "saveError": "The waste tour could not be saved.",
      "saveForbidden": "Missing permission to save waste tours."
    }
  }
} as const;
