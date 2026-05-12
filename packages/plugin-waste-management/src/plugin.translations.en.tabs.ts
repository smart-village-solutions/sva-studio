export const wasteManagementPluginTranslationsENTabs = {
  "tabs": {
    "ariaLabel": "Waste management areas",
    "fractions": {
      "title": "Waste types",
      "body": "Manage fractions, colors, and translations as a dedicated waste management workspace.",
      "emptyTitle": "No waste types yet",
      "emptyBody": "Create the first fraction to make collection types available for tours and pickup locations."
    },
    "tours": {
      "title": "Tours",
      "body": "Tours, assignments and tour-specific maintenance get their own focused work area.",
      "emptyTitle": "Tours coming next",
      "emptyBody": "The first route already preserves shareable tab and filter state for this area."
    },
    "locations": {
      "title": "Pickup locations",
      "body": "Manage regions, cities, streets, house numbers, and concrete pickup locations in one shared location context.",
      "emptyTitle": "No pickup locations yet",
      "emptyBody": "As soon as regions and address data exist, pickup locations will appear in this area."
    },
    "scheduling": {
      "title": "Schedule deviations",
      "body": "Global and tour-related shifts remain visible as an explicit scheduling context.",
      "emptyTitle": "Schedule deviations coming next",
      "emptyBody": "Calendar, bulk and conflict surfaces will be added here later."
    },
    "tools": {
      "title": "Data tools",
      "body": "Import, migration, seed and reset are started through the host generic job capability.",
      "emptyTitle": "Tools coming next",
      "emptyBody": "Job starters and progress views will be attached to the host endpoints in the next slice."
    },
    "settings": {
      "title": "Settings",
      "body": "The instance-specific waste data source remains reachable and reconfigurable even during error states.",
      "emptyTitle": "Settings coming next",
      "emptyBody": "The existing settings facade will be integrated directly into this tab afterwards."
    }
  }
} as const;
