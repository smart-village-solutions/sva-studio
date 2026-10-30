import { actionsInstancesAdminDEResources } from './instances/actions.resources.js';
import { adminBootstrapInstancesAdminDEResources } from './instances/adminBootstrap.resources.js';
import { auditInstancesAdminDEResources } from './instances/audit.resources.js';
import { busKeysInstancesAdminDEResources } from './instances/busKeys.resources.js';
import { cockpitInstancesAdminDEResources } from './instances/cockpit.resources.js';
import { configurationInstancesAdminDEResources } from './instances/configuration.resources.js';
import { detailInstancesAdminDEResources } from './instances/detail.resources.js';
import { diagnosticsInstancesAdminDEResources } from './instances/diagnostics.resources.js';
import { doctorInstancesAdminDEResources } from './instances/doctor.resources.js';
import { errorsInstancesAdminDEResources } from './instances/errors.resources.js';
import { feedbackInstancesAdminDEResources } from './instances/feedback.resources.js';
import { filtersInstancesAdminDEResources } from './instances/filters.resources.js';
import { flowInstancesAdminDEResources } from './instances/flow.resources.js';
import { formInstancesAdminDEResources } from './instances/form.resources.js';
import { guidanceInstancesAdminDEResources } from './instances/guidance.resources.js';
import { helpInstancesAdminDEResources } from './instances/help.resources.js';
import { historyInstancesAdminDEResources } from './instances/history.resources.js';
import { instanceModulesInstancesAdminDEResources } from './instances/instanceModules.resources.js';
import { invitationInstancesAdminDEResources } from './instances/invitation.resources.js';
import { keycloakPanelInstancesAdminDEResources } from './instances/keycloakPanel.resources.js';
import { keycloakStatusInstancesAdminDEResources } from './instances/keycloakStatus.resources.js';
import { mainserverInstancesAdminDEResources } from './instances/mainserver.resources.js';
import { messagesInstancesAdminDEResources } from './instances/messages.resources.js';
import { operationsInstancesAdminDEResources } from './instances/operations.resources.js';
import { pageInstancesAdminDEResources } from './instances/page.resources.js';
import { pluginReadinessInstancesAdminDEResources } from './instances/pluginReadiness.resources.js';
import { setupInstancesAdminDEResources } from './instances/setup.resources.js';
import { statusInstancesAdminDEResources } from './instances/status.resources.js';
import { successInstancesAdminDEResources } from './instances/success.resources.js';
import { tableInstancesAdminDEResources } from './instances/table.resources.js';
import { tenantIamInstancesAdminDEResources } from './instances/tenantIam.resources.js';
import { wizardInstancesAdminDEResources } from './instances/wizard.resources.js';
import { workflowInstancesAdminDEResources } from './instances/workflow.resources.js';

export const instancesAdminDEResources = {
  actions: actionsInstancesAdminDEResources,
  adminBootstrap: adminBootstrapInstancesAdminDEResources,
  audit: auditInstancesAdminDEResources,
  busKeys: busKeysInstancesAdminDEResources,
  cockpit: cockpitInstancesAdminDEResources,
  configuration: configurationInstancesAdminDEResources,
  detail: detailInstancesAdminDEResources,
  diagnostics: diagnosticsInstancesAdminDEResources,
  doctor: doctorInstancesAdminDEResources,
  errors: errorsInstancesAdminDEResources,
  feedback: feedbackInstancesAdminDEResources,
  filters: filtersInstancesAdminDEResources,
  flow: flowInstancesAdminDEResources,
  form: formInstancesAdminDEResources,
  guidance: guidanceInstancesAdminDEResources,
  help: helpInstancesAdminDEResources,
  history: historyInstancesAdminDEResources,
  instanceModules: instanceModulesInstancesAdminDEResources,
  mailSync: {
    remedy: 'Einladungsvorlage und Keycloak-Abgleich öffnen',
    "title": "Vorlagenabgleich mit Keycloak",
    "blocked": "Einladungsversand ist gesperrt, bis die Einladungsvorlage abgeglichen ist.",
    "compare": "Studio und Keycloak vergleichen",
    "studio": "Gespeicherter Studio-Stand",
    "keycloak": "Aktueller Keycloak-Stand",
    "unavailable": "Keycloak ist derzeit nicht erreichbar.",
    "unsupported": "Die Keycloak-Fassung lässt sich nicht verlustfrei in den Texteditor übernehmen. Bitte die HTML-Fassung prüfen und den gewünschten Studio-Stand ausdrücklich übertragen.",
    "adopt": "Keycloak-Stand übernehmen",
    "transfer": "Studio-Stand übertragen",
    "adoptConfirm": "Den gespeicherten Studio-Stand durch den angezeigten Keycloak-Stand ersetzen?",
    "transferConfirm": "Die angezeigten Keycloak-Texte durch den Studio-Stand ersetzen?",
    "open": "Keycloak-Abgleich öffnen / aktualisieren",
    "loadFailed": "Der Abgleich konnte nicht geladen werden. Bitte erneut versuchen.",
    "conflict": "Der Stand hat sich geändert oder konnte nicht bestätigt werden. Bitte den Abgleich neu öffnen. Ihr Entwurf bleibt erhalten.",
    "savedPending": "Im Studio gespeichert, aber nicht synchronisiert. Bitte den Keycloak-Abgleich prüfen.",
    "status": {
        "unreviewed": "Noch nicht abgeglichen",
        "pending": "Nicht synchronisiert",
        "synced": "Synchronisiert und durch Rücklesen bestätigt",
        "failed": "Synchronisierung nicht bestätigt",
        "drift": "Externe Abweichung erkannt"
    }
},
  emailVerification: {
    serverTitle: 'Allgemeine E-Mail-Bestätigung',
    serverDescription: 'Dieser Standard gilt für Instanzen ohne eigenen Override. Speichern synchronisiert nur erbende Instanzen; eigene Vorlagen bleiben erhalten. Es wird keine E-Mail versendet.',
    serverSaved: 'Allgemeine Vorlage gespeichert. Erbende Instanzen wurden abgeglichen.',
    resetServerConfirm: 'Die allgemeine Bestätigungsvorlage auf den neutralen eingebauten Standard zurücksetzen?',
    resetInstance: 'Allgemeine Vorlage verwenden',

    reauthRequired:
      'Bitte erneut anmelden und die Vorlage danach neu öffnen. Ihr Entwurf bleibt bis dahin erhalten.',
    currentTexts: 'Zwischenzeitlich gespeicherte Texte',
    title: 'E-Mail-Adresse bestätigen',
    open: 'Bestätigungsvorlage anpassen',
    description:
      'Diese deutschen Texte gelten für Registrierung und Adressänderung. Die Vorlage wird im Studio gespeichert und mit dem Keycloak-Realm abgeglichen. Es wird keine E-Mail versendet.',
    realm: 'Ziel-Realm: {{realm}}',
    tokens:
      'Im Nachrichtentext: {{tenantName}}, {{verificationLink}}, {{linkExpiresIn}}. Der Bestätigungslink muss genau einmal vorkommen. Keine Platzhalter im Betreff, kein HTML und keine freien URLs.',
    previewLink: '[E-Mail-Adresse bestätigen]',
    htmlWarning:
      'Die vorhandene HTML-Fassung weicht von der automatisch erzeugten Darstellung ab. Beim Speichern wird sie aus dem Nachrichtentext neu erzeugt.',
    existingHtml: 'Vorhandene HTML-Fassung ansehen',
    replaceHtml: 'Vorhandene HTML-Fassung bewusst ersetzen',
    loadFailed:
      'Die wirksamen Bestätigungstexte konnten nicht geladen werden. Bitte schließen und erneut öffnen.',
    invalid:
      'Bitte prüfen Sie die Vorlage: genau ein Bestätigungslink, keine unbekannten Platzhalter, kein HTML und keine freien URLs.',
    saved: 'Die Vorlage wurde in Keycloak gespeichert und zurückgelesen.',
    conflict:
      'Die Texte wurden zwischenzeitlich geändert. Ihr Entwurf bleibt erhalten. Die aktuellen Texte werden zum Vergleich angezeigt. Prüfen Sie diese vor dem erneuten Speichern.',
    saveFailed:
      'Speichern wurde nicht bestätigt. Die Änderung kann bereits in Keycloak angekommen sein. Ihr Entwurf bleibt erhalten; bitte schließen, neu öffnen und den aktuellen Stand prüfen.',
    reset: 'Neutralen Standard übernehmen',
    resetConfirm: 'Den Instanz-Override entfernen und wieder die aktuelle allgemeine Bestätigungsvorlage verwenden?',
  },
  invitation: invitationInstancesAdminDEResources,
  keycloakPanel: keycloakPanelInstancesAdminDEResources,
  keycloakStatus: keycloakStatusInstancesAdminDEResources,
  mainserver: mainserverInstancesAdminDEResources,
  messages: messagesInstancesAdminDEResources,
  operations: operationsInstancesAdminDEResources,
  page: pageInstancesAdminDEResources,
  pluginReadiness: pluginReadinessInstancesAdminDEResources,
  setup: setupInstancesAdminDEResources,
  status: statusInstancesAdminDEResources,
  success: successInstancesAdminDEResources,
  table: tableInstancesAdminDEResources,
  tenantIam: tenantIamInstancesAdminDEResources,
  wizard: wizardInstancesAdminDEResources,
  workflow: workflowInstancesAdminDEResources,
} as const;
