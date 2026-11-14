export const mailSyncInstancesAdminDEResources = {
  serverSaved: 'Allgemeine Vorlage gespeichert. Erbende Instanzen wurden abgeglichen.',
  remedy: 'Einladungsvorlage und Keycloak-Abgleich öffnen',
  title: 'Vorlagenabgleich mit Keycloak',
  blocked: 'Einladungsversand ist gesperrt, bis die Einladungsvorlage abgeglichen ist.',
  compare: 'Studio und Keycloak vergleichen',
  studio: 'Gespeicherter Studio-Stand',
  keycloak: 'Aktueller Keycloak-Stand',
  unavailable: 'Keycloak ist derzeit nicht erreichbar.',
  unsupported:
    'Die Keycloak-Fassung lässt sich nicht verlustfrei in den Texteditor übernehmen. Bitte die HTML-Fassung prüfen und den gewünschten Studio-Stand ausdrücklich übertragen.',
  adopt: 'Keycloak-Stand übernehmen',
  transfer: 'Studio-Stand übertragen',
  adoptConfirm: 'Den gespeicherten Studio-Stand durch den angezeigten Keycloak-Stand ersetzen?',
  transferConfirm: 'Die angezeigten Keycloak-Texte durch den Studio-Stand ersetzen?',
  open: 'Keycloak-Abgleich öffnen / aktualisieren',
  loadFailed: 'Der Abgleich konnte nicht geladen werden. Bitte erneut versuchen.',
  conflict:
    'Der Stand hat sich geändert oder konnte nicht bestätigt werden. Bitte den Abgleich neu öffnen. Ihr Entwurf bleibt erhalten.',
  savedPending:
    'Im Studio gespeichert, aber nicht synchronisiert. Bitte den Keycloak-Abgleich prüfen.',
  status: {
    unreviewed: 'Noch nicht abgeglichen',
    pending: 'Nicht synchronisiert',
    synced: 'Synchronisiert und durch Rücklesen bestätigt',
    failed: 'Synchronisierung nicht bestätigt',
    drift: 'Externe Abweichung erkannt',
  },
} as const;
