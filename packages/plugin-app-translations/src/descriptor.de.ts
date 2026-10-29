export const germanTranslations = {
  appTranslations: {
    ui: {
      translateMissing: 'Fehlende Übersetzungen erstellen',
      nothingToTranslate:
        'Keine fehlenden oder veralteten Übersetzungen. Es wurde kein Auftrag gestartet.',
      translationPlan: '{{count}} zu übersetzende Texte. Zielsprachen:',
      translationProgress:
        'Gespeichert: {{translated}} · Übersprungen: {{skipped}} · Noch offen: {{pending}}',
      translateHelp:
        'Übersetzt fehlende oder veraltete Standardtexte aus dem gepinnten deutschen Ausgangsstand mit dem DeepL-Zugang dieser Instanz. Manuelle Korrekturen bleiben erhalten. Es können DeepL-Kosten entstehen. Keine App-Auslieferung.',
      translateKey: 'Diesen Text neu übersetzen',
      machine: 'Maschinell übersetzt',
      replaceManual: 'Manuelle Korrektur für diese Sprache ausdrücklich ersetzen',
      transferMunicipal: 'Diesen deutschen Text übersetzen',
      transferHelp:
        'Übersetzt diesen gespeicherten eigenen deutschen Text per DeepL in die ausgewählten Sprachen. Das Überschreiben manueller Korrekturen muss für jede betroffene Sprache gesondert bestätigt werden. Es können DeepL-Kosten entstehen.',
      replaceManualTargets: 'Manuelle Korrekturen überschreiben',
      jobStatus: {
        queued: 'Übersetzung vorgemerkt',
        running: 'Übersetzung läuft',
        retrying: 'Wiederholungsversuch vorgemerkt',
        succeeded: 'Übersetzung abgeschlossen',
        failed: 'Übersetzung gestoppt — Ursache beheben und erneut starten',
        cancelled: 'Übersetzung abgebrochen',
      },
      deepl_auth_failed: 'DeepL hat den Zugang abgelehnt. API-Key prüfen.',
      deepl_quota_exceeded: 'Das DeepL-Kontingent ist ausgeschöpft.',
      deepl_rate_limited: 'DeepL begrenzt die Anfragen. Ein begrenzter Wiederholungsversuch folgt.',
      deepl_unavailable: 'DeepL ist gerade nicht erreichbar. Bitte später erneut versuchen.',
      deepl_invalid_response:
        'Die DeepL-Antwort war ungültig. Der betroffene Batch wurde nicht gespeichert.',
      deepl_text_too_large:
        'Ein Text überschreitet die zulässige Anfragegröße und muss geprüft werden.',
      title: 'Mehrsprachigkeit',
      languageTag: 'de',
      sourceTitle: 'App-Texte',
      setupTitle: 'DeepL-Schnittstelle einrichten',
      setupReady: 'DeepL-Schnittstelle bereit',
      setupLink: 'Schnittstellen öffnen',
      setupAdmin:
        'Bitte einen Instanzadministrator mit dem Recht zur Schnittstellenverwaltung um Einrichtung bitten.',
      setupReasons: {
        not_configured:
          'Für diese Instanz muss zuerst ein eigener DeepL-Zugang eingerichtet werden.',
        disabled: 'Die DeepL-Schnittstelle ist deaktiviert.',
        secret_missing: 'Ein lesbarer DeepL-API-Key fehlt.',
        check_required: 'Verbindung prüfen und verfügbare Sprachen laden.',
        languages_required:
          'In der geprüften Schnittstelle mindestens eine Zielsprache auswählen und speichern.',
        ready:
          'Die geprüften und ausgewählten Sprachen sind für die lokale Katalogbearbeitung verfügbar. Automatische Übersetzungen können ausdrücklich gestartet werden. Die App-Auslieferung folgt später.',
      },
      catalog_setup_required:
        'Bitte zuerst die DeepL-Schnittstelle vollständig einrichten und prüfen. Vorhandene Texte bleiben erhalten.',
      sourceRequired: 'Lege zuerst unter App → App-Texte einen deutschen Ausgangsbestand an.',
      sourceDescription:
        'Deutsche App-Texte für deine Kommune anpassen. Dafür wird das Modul Mehrsprachigkeit nicht benötigt.',
      configureLanguages: 'Aktuelle Sprachauswahl übernehmen',
      configureLanguagesHelp:
        'Übernimmt die zentral für diese Instanz aktivierten Sprachen in den Entwurf. Vorhandene Übersetzungen bleiben erhalten. Deutsche Texte werden unter App → App-Texte bearbeitet.',
      standardsTitle: 'Gemeinsame App-Texte',
      description: 'Feste Beschriftungen und Hinweise der App für deine Kommune anpassen.',
      standardsDescription:
        'Gemeinsame Beschriftungen, Schaltflächen und Hinweise für die Apps aller Kommunen pflegen.',
      importFile: 'App-Textdatei (JSON)',
      locales: {
        de: 'Deutsch',
        en: 'Englisch',
        uk: 'Ukrainisch',
        es: 'Spanisch',
        it: 'Italienisch',
        'pt-PT': 'Portugiesisch (Portugal)',
        el: 'Griechisch',
        ko: 'Koreanisch',
        id: 'Indonesisch',
        'zh-Hans': 'Chinesisch (vereinfacht)',
        ja: 'Japanisch',
        th: 'Thailändisch',
        tr: 'Türkisch',
        pl: 'Polnisch',
        da: 'Dänisch',
        sv: 'Schwedisch',
        fi: 'Finnisch',
        ru: 'Russisch',
        lv: 'Lettisch',
        ro: 'Rumänisch',
      },
      editor: 'Texte bearbeiten',
      language: 'Sprache',
      key: 'Textschlüssel',
      search: 'Schlüssel oder Text suchen',
      matches: '{{count}} von {{total}} Texten',
      noMatches: 'Keine passenden Texte gefunden. Suche anpassen.',
      emptyValue: 'Leerer Text',
      keyPages: 'Textschlüssel durchblättern',
      page: 'Seite {{page}} von {{total}}',
      previous: 'Zurück',
      next: 'Weiter',
      type: 'Werttyp',
      placeholders: 'Platzhalter',
      none: 'Keine',
      origin: 'Herkunft',
      own: 'Eigener Wert',
      inherited: 'Geerbter Standard',
      status: 'Status',
      reviewRequired: 'Bestätigung erforderlich',
      complete: 'Vorhanden',
      missing: 'Fehlt',
      value: 'Textwert',
      arrayHelp: 'Textliste als JSON-Array eingeben. Alle erforderlichen Platzhalter erhalten.',
      emptyAllowed: 'Ein leerer Text ist für diesen Schlüssel ausdrücklich erlaubt.',
      valueHelp: 'Alle erforderlichen Platzhalter unverändert erhalten.',
      save: 'Entwurf speichern',
      reset: 'Auf Standard zurücksetzen',
      confirm: 'Korrektur bestätigen',
      unsaved: 'Ungespeicherte Eingabe. Vor dem Wechsel speichern oder ausdrücklich verwerfen.',
      source: 'Tatsächliche deutsche Quelle',
      standard: 'Gepinnter Standard',
      reload: 'Neu laden',
      discard: 'Eingabe verwerfen',
      saved: 'Entwurf in Studio gespeichert. Noch nicht an Apps ausgeliefert.',
      sealed:
        'Textstand gesichert. Der Entwurf bleibt weiter bearbeitbar. Noch nicht an Apps ausgeliefert.',
      draftTitle: 'Aktueller Entwurf',
      currentStateTitle: 'Aktueller Stand',
      draftUnsaved:
        'Ungespeicherte Eingaben. Zuerst den Entwurf speichern, danach den Textstand sichern.',
      draftUnsealed:
        'Dieser Entwurf ist in Studio gespeichert, aber noch nicht als Textstand gesichert.',
      draftSealed:
        'Dieser Bearbeitungsstand ist als Textstand {{revision}} gesichert. Neue Änderungen erfolgen weiterhin im Entwurf.',
      draftTranslating:
        'Der Entwurf wird gerade übersetzt. Den abgeschlossenen Stand anschließend als Textstand sichern.',
      loading: 'Kataloge werden geladen …',
      scope: 'Gültigkeit',
      global: 'Für alle Kommunen',
      import: 'App-Texte aus der Entwicklung übernehmen',
      importHelp:
        'Wähle die von der App-Entwicklung bereitgestellte JSON-Datei mit Textkennungen, deutschen Ausgangstexten und Platzhalterregeln aus (maximal 1 MiB). Die Dateiauswahl importiert einen bearbeitbaren Entwurf in Studio. In den Apps ändert sich dadurch noch nichts.',
      languages: 'Sprachen',
      manifest: 'Textdefinition (Version)',
      catalogs: 'App-Textbestände',
      empty:
        'Noch keine App-Texte vorhanden. Übernimm zuerst die Textdatei aus der App-Entwicklung.',
      catalog: 'App-Textbestand',
      basis: 'Gemeinsamer Ausgangsstand',
      chooseBasis: 'Gemeinsamen Textstand auswählen',
      choose: 'Bitte auswählen',
      changeBasis: 'Ausgangsstand übernehmen',
      currentBasis: 'Aktuell verwendete zentrale Basis',
      switchBasis: 'Ausgangsstand wechseln',
      cancelBasisChange: 'Abbrechen',
      create: 'Eigenen App-Textentwurf anlegen',
      draftRevision: 'Bearbeitungsstand',
      seal: 'Textstand sichern',
      sealBlocked:
        'Der Textstand wurde nicht gesichert. Prüfe die folgenden Texte; ein Klick öffnet den betroffenen Eintrag. Manuelle Korrekturen bleiben erhalten.',
      releases: 'Gesicherte Textstände',
      preview: 'Textstand ansehen',
      downloadTexts: 'texts.js herunterladen',
      downloadingTexts: 'texts.js wird erstellt …',
      downloadedTexts: 'texts.js heruntergeladen. Noch nicht an Apps ausgeliefert.',
      catalog_export_incompatible:
        'Dieser Textstand ist nicht mit dem unterstützten texts.js-Format kompatibel.',
      noReleases: 'Noch kein vollständiger Textstand gesichert.',
      localOnly:
        'Dieser Textstand ist in Studio gesichert und unveränderlich. Er wird noch nicht an Apps ausgeliefert.',
      catalog_conflict:
        'Der Entwurf oder Organisationskontext hat sich geändert. Die Eingabe bleibt erhalten. Bitte bewusst neu laden und abgleichen.',
      catalog_incomplete:
        'Zum Sichern fehlen noch gültige App-Texte in einer oder mehreren ausgewählten Sprachen.',
      catalog_review_required:
        'Die deutsche Quelle oder Zielvariante hat sich geändert. Manuelle Korrektur prüfen und bestätigen oder den betroffenen Text ausdrücklich neu übersetzen.',
      catalog_forbidden:
        'Für diesen Katalogzugriff fehlen Berechtigung, Organisation oder Modulbereitschaft.',
      catalog_not_found: 'Dieser App-Textbestand wurde nicht gefunden.',
      invalid_catalog:
        'Datei oder Textwert ist ungültig. Typ, Größe und erforderliche Platzhalter prüfen.',
      catalog_unavailable: 'Die App-Texte sind gerade nicht erreichbar. Bitte erneut versuchen.',
    },
    permissions: {
      catalog: {
        read: 'Kataloge lesen',
        write: 'Katalogentwürfe bearbeiten',
        publish: 'Katalogsätze vorbereiten',
      },
    },
    readiness: {
      local: 'Lokale Katalogbasis prüfen — App-Integration noch nicht verfügbar',
      schema: 'Lokale Katalogbasis',
      provider: 'Zentraler DeepL-Zugang konfiguriert',
      invalidContext: 'Ungültiger Modulauftrag',
    },
  },
};
