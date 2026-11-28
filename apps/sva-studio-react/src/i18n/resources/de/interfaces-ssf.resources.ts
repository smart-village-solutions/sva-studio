export const ssfInterfaceResources = {
  saveFirst: 'Speichere die Konfiguration vor der Verbindungsprüfung.',
  origin: 'HTTPS-Adresse des SSF-Servers',
  checking: 'Smart Speech Flow wird geprüft …',
  errors: {
    ssf_translation_disable_before_cutover:
      'Deaktiviere die SSF-Schnittstelle während der Pilotumstellung.',
    ssf_translation_origin_key_required:
      'Gib beim Wechsel des SSF-Servers dessen API-Schlüssel ein.',
    ssf_translation_invalid_config:
      'Prüfe die HTTPS-Adresse, den API-Schlüssel und die gewählten Sprachen.',
    ssf_translation_rejected:
      'Smart Speech Flow konnte nicht geprüft werden. Prüfe die Adresse und den API-Schlüssel.',
    ssf_translation_invalid_response: 'Smart Speech Flow hat eine ungültige Antwort gesendet.',
    ssf_translation_languages_unavailable:
      'Smart Speech Flow hat keine unterstützten Zielsprachen gemeldet.',
    ssf_translation_unavailable: 'Smart Speech Flow ist derzeit nicht erreichbar.',
  },
};

export const ssfInterfaceTypeResources = {
  label: 'Smart Speech Flow',
  description: 'App-Inhalte mit dem eigenen Smart-Speech-Flow-Server übersetzen.',
};
