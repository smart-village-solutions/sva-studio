/** Metadata stays server-safe; browser views are connected by the browser entry. */
import {
  definePluginActions,
  definePluginPermissions,
  definePluginModuleIamContract,
  type PluginDescriptor,
} from '@sva/plugin-sdk';

export const APP_TRANSLATIONS_CATALOG_JOB = 'app-translations.catalog-translate';
export const APP_TRANSLATIONS_LIFECYCLE_JOB = 'app-translations.lifecycle';
const tenantPermissionIds = [
  'app-translations.catalog.read',
  'app-translations.catalog.write',
  'app-translations.catalog.publish',
] as const;
const permissions = definePluginPermissions(
  'app-translations',
  tenantPermissionIds.map((id) => ({
    id,
    titleKey: `appTranslations.permissions.${id.split('.').slice(1).join('.')}`,
  }))
);
const actions = definePluginActions(
  'app-translations',
  permissions.map(({ id, titleKey }) => ({
    id,
    titleKey,
    accessRequirement: {
      kind: 'tenant' as const,
      moduleId: 'app-translations',
      actions: { mode: 'allOf' as const, values: [id] },
    },
  }))
);
export const appTranslationsPlugin: PluginDescriptor = {
  id: 'app-translations',
  displayName: 'Mehrsprachigkeit',
  routes: [
    {
      id: 'app-translations.catalogs',
      path: '/plugins/app-translations',
      documentation: { kind: 'page', id: 'app-translations.catalogs', pageType: 'overview' },
      actionId: 'app-translations.catalog.read',
      accessRequirement: {
        kind: 'tenant',
        moduleId: 'app-translations',
        actions: { mode: 'allOf', values: ['app-translations.catalog.read'] },
      },
    },
  ],
  navigation: [
    {
      id: 'app-translations.navigation',
      to: '/plugins/app-translations',
      titleKey: 'appTranslations.ui.title',
      section: 'applications',
      requiredAction: 'app-translations.catalog.read',
      accessRequirement: {
        kind: 'tenant',
        moduleId: 'app-translations',
        actions: { mode: 'allOf', values: ['app-translations.catalog.read'] },
      },
    },
  ],
  permissions,
  actions,
  moduleIam: definePluginModuleIamContract('app-translations', {
    moduleId: 'app-translations',
    permissionIds: tenantPermissionIds,
    systemRoles: [{ roleName: 'system_admin', permissionIds: tenantPermissionIds }],
  }),
  jobTypes: [
    {
      jobTypeId: APP_TRANSLATIONS_CATALOG_JOB,
      supportsCancellation: true,
      queue: 'app-translations',
      displayName: 'DeepL',
      descriptionKey: 'appTranslations.ui.translateMissing',
      startPolicy: 'dedicated',
    },
    {
      jobTypeId: APP_TRANSLATIONS_LIFECYCLE_JOB,
      queue: 'plugin-operations',
      displayName: 'Mehrsprachigkeit',
      descriptionKey: 'appTranslations.readiness.local',
      startPolicy: 'dedicated',
    },
  ],
  tenantLifecycle: {
    contractVersion: 1,
    operations: (['provision', 'reconcile', 'readiness', 'suspend', 'reactivate'] as const).map(
      (operation) => ({
        operation,
        jobTypeId: APP_TRANSLATIONS_LIFECYCLE_JOB,
      })
    ),
    readinessChecks: [
      {
        checkId: 'app-translations.schema',
        titleKey: 'appTranslations.readiness.schema',
        required: true,
        repairOperation: 'reconcile',
      },
      {
        checkId: 'app-translations.provider',
        titleKey: 'appTranslations.readiness.provider',
        required: false,
      },
    ],
  },
  contentHistory: { mode: 'none', reasonCode: 'infrastructure_only' },
  translations: {
    de: {
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
          deepl_rate_limited:
            'DeepL begrenzt die Anfragen. Ein begrenzter Wiederholungsversuch folgt.',
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
          saved: 'App-Texte in Studio gespeichert. Noch nicht an Apps ausgeliefert.',
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
          catalog_unavailable:
            'Die App-Texte sind gerade nicht erreichbar. Bitte erneut versuchen.',
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
    },
    en: {
      appTranslations: {
        ui: {
          translateMissing: 'Create missing translations',
          nothingToTranslate: 'No missing or outdated translations. No job was started.',
          translationPlan: '{{count}} texts to translate. Target languages:',
          translationProgress:
            'Saved: {{translated}} · Skipped: {{skipped}} · Still pending: {{pending}}',
          translateHelp:
            'Translate missing or outdated standard texts from the pinned German source using this instance’s DeepL account. Manual corrections are retained. DeepL charges may apply. No app delivery.',
          translateKey: 'Translate this text again',
          machine: 'Machine translated',
          replaceManual: 'Explicitly replace the manual correction for this language',
          transferMunicipal: 'Translate this German text',
          transferHelp:
            'Uses DeepL to translate this saved municipal German text into the selected languages. Overwriting manual corrections requires separate confirmation for each affected language. DeepL charges may apply.',
          replaceManualTargets: 'Confirm overwriting manual corrections',
          jobStatus: {
            queued: 'Translation queued',
            running: 'Translation running',
            retrying: 'Retry queued',
            succeeded: 'Translation completed',
            failed: 'Translation stopped — resolve the cause and start again',
            cancelled: 'Translation cancelled',
          },
          deepl_auth_failed: 'DeepL rejected the credentials. Check the API key.',
          deepl_quota_exceeded: 'The DeepL quota has been exhausted.',
          deepl_rate_limited: 'DeepL is limiting requests. A bounded retry will follow.',
          deepl_unavailable: 'DeepL is currently unavailable. Please try again later.',
          deepl_invalid_response:
            'DeepL returned an invalid response. The affected batch was not saved.',
          deepl_text_too_large: 'A text exceeds the request size limit and needs review.',
          title: 'Multilingual content',
          languageTag: 'en',
          sourceTitle: 'App texts',
          setupTitle: 'Set up the DeepL interface',
          setupReady: 'DeepL interface ready',
          setupLink: 'Open interfaces',
          setupAdmin:
            'Ask an instance administrator with interface management permission to complete setup.',
          setupReasons: {
            not_configured: 'First configure a dedicated DeepL account for this instance.',
            disabled: 'The DeepL interface is disabled.',
            secret_missing: 'A readable DeepL API key is missing.',
            check_required: 'Check the connection and load available languages.',
            languages_required:
              'Select and save at least one target language in the verified interface.',
            ready:
              'Verified and selected languages are available for local catalog editing. Automatic translations can be started explicitly. App delivery will follow later.',
          },
          catalog_setup_required:
            'First complete and verify DeepL setup. Existing texts are retained.',
          sourceRequired: 'First create the German source under App → App texts.',
          sourceDescription:
            'Customize German app texts for your municipality without the multilingual module.',
          configureLanguages: 'Apply current language selection',
          configureLanguagesHelp:
            'Apply the languages enabled for this instance to the draft. Existing translations are retained. Edit German texts under App → App texts.',
          standardsTitle: 'Shared app texts',
          description: 'Customize fixed app labels and messages for your municipality.',
          standardsDescription:
            'Manage shared labels, buttons and messages for the apps of all municipalities.',
          importFile: 'App text file (JSON)',
          locales: {
            de: 'German',
            en: 'English',
            uk: 'Ukrainian',
            es: 'Spanish',
            it: 'Italian',
            'pt-PT': 'Portuguese (Portugal)',
            el: 'Greek',
            ko: 'Korean',
            id: 'Indonesian',
            'zh-Hans': 'Chinese (simplified)',
            ja: 'Japanese',
            th: 'Thai',
            tr: 'Turkish',
            pl: 'Polish',
            da: 'Danish',
            sv: 'Swedish',
            fi: 'Finnish',
            ru: 'Russian',
            lv: 'Latvian',
            ro: 'Romanian',
          },
          editor: 'Edit texts',
          language: 'Language',
          key: 'Text key',
          search: 'Search keys or text',
          matches: '{{count}} of {{total}} texts',
          noMatches: 'No matching texts found. Adjust your search.',
          emptyValue: 'Empty text',
          keyPages: 'Browse text keys',
          page: 'Page {{page}} of {{total}}',
          previous: 'Previous',
          next: 'Next',
          type: 'Value type',
          placeholders: 'Placeholders',
          none: 'None',
          origin: 'Origin',
          own: 'Own value',
          inherited: 'Inherited standard',
          status: 'Status',
          reviewRequired: 'Confirmation required',
          complete: 'Available',
          missing: 'Missing',
          value: 'Text value',
          arrayHelp: 'Enter the text list as a JSON array. Preserve every required placeholder.',
          emptyAllowed: 'An empty text is explicitly allowed for this key.',
          valueHelp: 'Preserve every required placeholder unchanged.',
          save: 'Save draft',
          reset: 'Reset to standard',
          confirm: 'Confirm correction',
          unsaved: 'Unsaved input. Save or explicitly discard it before switching.',
          source: 'Actual German source',
          standard: 'Pinned standard',
          reload: 'Reload',
          discard: 'Discard input',
          saved: 'App texts saved in Studio. Not delivered to apps yet.',
          loading: 'Loading catalogs …',
          scope: 'Applies to',
          global: 'For all municipalities',
          import: 'Import app texts from development',
          importHelp:
            'Select the JSON file supplied by app development with text identifiers, German source texts and placeholder rules (up to 1 MiB). Selecting the file imports an editable draft into Studio. It does not change any app yet.',
          languages: 'Languages',
          manifest: 'Text definition version',
          catalogs: 'App text collections',
          empty: 'No app texts yet. Start by importing the text file supplied by app development.',
          catalog: 'App text collection',
          basis: 'Shared starting point',
          chooseBasis: 'Select a shared text snapshot',
          choose: 'Please select',
          changeBasis: 'Use this starting point',
          currentBasis: 'Current central starting point',
          switchBasis: 'Change starting point',
          cancelBasisChange: 'Cancel',
          create: 'Create a municipal app text draft',
          draftRevision: 'Draft revision',
          seal: 'Save text snapshot',
          sealBlocked:
            'The text snapshot was not saved. Review the following texts; click an entry to open it. Manual corrections are preserved.',
          releases: 'Saved text snapshots',
          preview: 'View text snapshot',
          noReleases: 'No complete text snapshot saved yet.',
          localOnly:
            'This text snapshot is saved in Studio and cannot be changed. It is not delivered to apps yet.',
          catalog_conflict:
            'The draft or organization context has changed. Your input is preserved. Explicitly reload and compare.',
          catalog_incomplete:
            'Valid app texts are still missing for one or more selected languages. Complete them before saving a snapshot.',
          catalog_review_required:
            'The German source or target variant has changed. Review and confirm a manual correction or explicitly translate the affected text again.',
          catalog_forbidden:
            'Permission, organization or module readiness is missing for this catalog access.',
          catalog_not_found: 'This catalog version was not found.',
          invalid_catalog:
            'Invalid file or text value. Check type, size and required placeholders.',
          catalog_unavailable: 'The catalog is currently unavailable. Please try again.',
        },
        permissions: {
          catalog: {
            read: 'Read catalogs',
            write: 'Edit catalog drafts',
            publish: 'Prepare catalog sets',
          },
        },
        readiness: {
          local: 'Check local catalog basis — app integration is not available yet',
          schema: 'Local catalog basis',
          provider: 'Central DeepL credential configured',
          invalidContext: 'Invalid module lifecycle request',
        },
      },
    },
  },
};
