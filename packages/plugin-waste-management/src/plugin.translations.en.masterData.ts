export const wasteManagementPluginTranslationsENMasterData = {
  "masterData": {
    "meta": {
      "fractionCount": "{{value}} fractions",
      "regionCount": "{{value}} regions",
      "cityCount": "{{value}} cities",
      "streetCount": "{{value}} streets",
      "houseNumberCount": "{{value}} house numbers",
      "collectionLocationCount": "{{value}} collection locations"
    },
    "messages": {
      "loading": "Loading master data.",
      "loadError": "Waste master data could not be loaded.",
      "loadForbidden": "Missing permission for waste master data.",
      "emptyTitle": "No master data found",
      "emptyBody": "Adjust the filters or create the first waste fraction."
    },
    "fractions": {
      "title": "Waste fractions",
      "description": "Maintain visible fractions as the first real mutation path of the plugin.",
      "color": "Color: {{value}}",
      "containerSize": "Container: {{value}}",
      "actions": {
        "openCreate": "Create fraction",
        "edit": "Edit",
        "cancel": "Cancel",
        "create": "Save fraction",
        "save": "Save changes",
        "saving": "Saving…"
      },
      "fields": {
        "name": "Name",
        "translationDe": "Label (DE)",
        "translationEn": "Label (EN)",
        "color": "Color",
        "containerSize": "Container size",
        "description": "Description",
        "active": "Status"
      },
      "translationBadge": "{{locale}}: {{value}}",
      "dialog": {
        "createTitle": "Create waste fraction",
        "createDescription": "Create a new fraction for further tour and calendar maintenance.",
        "editTitle": "Edit waste fraction",
        "editDescription": "Change name, color and visibility of the fraction."
      },
      "messages": {
        "createSuccess": "The waste fraction was created.",
        "updateSuccess": "The waste fraction was updated.",
        "saveError": "The waste fraction could not be saved.",
        "saveForbidden": "Missing permission to save waste fractions."
      }
    },
    "regions": {
      "title": "Regions",
      "description": "Maintain regions as the second small master-data path with its own dialog.",
      "regionId": "Region ID: {{value}}",
      "actions": {
        "openCreate": "Create region",
        "edit": "Edit",
        "cancel": "Cancel",
        "create": "Save region",
        "save": "Save changes",
        "saving": "Saving…"
      },
      "fields": {
        "name": "Name"
      },
      "dialog": {
        "createTitle": "Create region",
        "createDescription": "Create a new region for the geographic hierarchy.",
        "editTitle": "Edit region",
        "editDescription": "Change the region name."
      },
      "messages": {
        "createSuccess": "The waste region was created.",
        "updateSuccess": "The waste region was updated.",
        "saveError": "The waste region could not be saved.",
        "saveForbidden": "Missing permission to save waste regions."
      }
    },
    "cities": {
      "title": "Cities",
      "description": "Maintain cities with optional region assignment as the first relational master-data path.",
      "cityId": "City ID: {{value}}",
      "regionId": "Region ID: {{value}}",
      "actions": {
        "openCreate": "Create city",
        "edit": "Edit",
        "cancel": "Cancel",
        "create": "Save city",
        "save": "Save changes",
        "saving": "Saving…"
      },
      "fields": {
        "name": "Name",
        "regionId": "Region",
        "regionUnset": "No region"
      },
      "dialog": {
        "createTitle": "Create city",
        "createDescription": "Create a city and assign it to a region when needed.",
        "editTitle": "Edit city",
        "editDescription": "Change the city name or region assignment."
      },
      "messages": {
        "createSuccess": "The waste city was created.",
        "updateSuccess": "The waste city was updated.",
        "saveError": "The waste city could not be saved.",
        "saveForbidden": "Missing permission to save waste cities."
      }
    },
    "streets": {
      "title": "Streets",
      "description": "Maintain streets as a dedicated address path below cities.",
      "streetId": "Street ID: {{value}}",
      "cityId": "City ID: {{value}}",
      "actions": {
        "openCreate": "Create street",
        "edit": "Edit",
        "cancel": "Cancel",
        "create": "Save street",
        "save": "Save changes",
        "saving": "Saving…"
      },
      "fields": {
        "name": "Name",
        "cityId": "City",
        "cityUnset": "Select city"
      },
      "dialog": {
        "createTitle": "Create street",
        "createDescription": "Create a street and assign it to a city.",
        "editTitle": "Edit street",
        "editDescription": "Adjust the street name or its linked city."
      },
      "messages": {
        "createSuccess": "The waste street was created.",
        "updateSuccess": "The waste street was updated.",
        "saveError": "The waste street could not be saved.",
        "saveForbidden": "Missing permission to save waste streets."
      }
    },
    "houseNumbers": {
      "title": "House numbers",
      "description": "Maintain house numbers as the final direct path of the address hierarchy.",
      "houseNumberId": "House number ID: {{value}}",
      "streetId": "Street ID: {{value}}",
      "actions": {
        "openCreate": "Create house number",
        "edit": "Edit",
        "cancel": "Cancel",
        "create": "Save house number",
        "save": "Save changes",
        "saving": "Saving…"
      },
      "fields": {
        "number": "House number",
        "streetId": "Street",
        "streetUnset": "Select street"
      },
      "dialog": {
        "createTitle": "Create house number",
        "createDescription": "Create a house number and assign it to a street.",
        "editTitle": "Edit house number",
        "editDescription": "Adjust the house number or its linked street."
      },
      "messages": {
        "createSuccess": "The waste house number was created.",
        "updateSuccess": "The waste house number was updated.",
        "saveError": "The waste house number could not be saved.",
        "saveForbidden": "Missing permission to save waste house numbers."
      }
    },
    "collectionLocations": {
      "title": "Collection locations",
      "description": "Maintain concrete collection locations with geographic selection down to house-number level.",
      "actions": {
        "openCreate": "Create collection location",
        "edit": "Edit",
        "cancel": "Cancel",
        "create": "Save collection location",
        "save": "Save changes",
        "saving": "Saving…"
      },
      "fields": {
        "regionId": "Region",
        "regionUnset": "All regions",
        "cityId": "City",
        "cityUnset": "Select city",
        "streetId": "Street",
        "streetUnset": "All streets",
        "houseNumberId": "House number",
        "houseNumberUnset": "All house numbers",
        "active": "Status"
      },
      "dialog": {
        "createTitle": "Create collection location",
        "createDescription": "Create a new collection location from region, city, street and house number.",
        "editTitle": "Edit collection location",
        "editDescription": "Adjust the geographic assignment and visibility of the collection location."
      },
      "meta": {
        "locationId": "Location ID: {{value}}",
        "allStreets": "All streets",
        "allHouseNumbers": "All house numbers"
      },
      "messages": {
        "createSuccess": "The waste collection location was created.",
        "updateSuccess": "The waste collection location was updated.",
        "saveError": "The waste collection location could not be saved.",
        "saveForbidden": "Missing permission to save waste collection locations."
      },
      "bulk": {
        "actions": {
          "openAssign": "Assign tour to {{value}} selected",
          "selectAllFiltered": "Select all filtered collection locations",
          "cancel": "Cancel",
          "assign": "Assign tour",
          "saving": "Saving…"
        },
        "fields": {
          "tourId": "Tour",
          "tourUnset": "Select tour",
          "startDate": "Start date",
          "endDate": "End date"
        },
        "dialog": {
          "title": "Bulk assign tour",
          "description": "Assign a tour to {{value}} selected collection locations."
        },
        "selectedTitle": "Selected collection locations",
        "meta": {
          "selectedCount": "{{value}} selected"
        },
        "messages": {
          "assignSuccess": "The waste tour assignments were created in bulk.",
          "assignError": "The waste tour assignments could not be created in bulk.",
          "assignForbidden": "Missing permission to create waste tour assignments in bulk."
        }
      }
    }
  }
} as const;
