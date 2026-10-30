import { actionsInstancesAdminENResources } from './instances/actions.resources.js';
import { adminBootstrapInstancesAdminENResources } from './instances/adminBootstrap.resources.js';
import { auditInstancesAdminENResources } from './instances/audit.resources.js';
import { busKeysInstancesAdminENResources } from './instances/busKeys.resources.js';
import { cockpitInstancesAdminENResources } from './instances/cockpit.resources.js';
import { configurationInstancesAdminENResources } from './instances/configuration.resources.js';
import { detailInstancesAdminENResources } from './instances/detail.resources.js';
import { diagnosticsInstancesAdminENResources } from './instances/diagnostics.resources.js';
import { doctorInstancesAdminENResources } from './instances/doctor.resources.js';
import { errorsInstancesAdminENResources } from './instances/errors.resources.js';
import { feedbackInstancesAdminENResources } from './instances/feedback.resources.js';
import { filtersInstancesAdminENResources } from './instances/filters.resources.js';
import { flowInstancesAdminENResources } from './instances/flow.resources.js';
import { formInstancesAdminENResources } from './instances/form.resources.js';
import { guidanceInstancesAdminENResources } from './instances/guidance.resources.js';
import { helpInstancesAdminENResources } from './instances/help.resources.js';
import { historyInstancesAdminENResources } from './instances/history.resources.js';
import { instanceModulesInstancesAdminENResources } from './instances/instanceModules.resources.js';
import { invitationInstancesAdminENResources } from './instances/invitation.resources.js';
import { keycloakPanelInstancesAdminENResources } from './instances/keycloakPanel.resources.js';
import { keycloakStatusInstancesAdminENResources } from './instances/keycloakStatus.resources.js';
import { mainserverInstancesAdminENResources } from './instances/mainserver.resources.js';
import { messagesInstancesAdminENResources } from './instances/messages.resources.js';
import { operationsInstancesAdminENResources } from './instances/operations.resources.js';
import { pageInstancesAdminENResources } from './instances/page.resources.js';
import { pluginReadinessInstancesAdminENResources } from './instances/pluginReadiness.resources.js';
import { setupInstancesAdminENResources } from './instances/setup.resources.js';
import { statusInstancesAdminENResources } from './instances/status.resources.js';
import { successInstancesAdminENResources } from './instances/success.resources.js';
import { tableInstancesAdminENResources } from './instances/table.resources.js';
import { tenantIamInstancesAdminENResources } from './instances/tenantIam.resources.js';
import { wizardInstancesAdminENResources } from './instances/wizard.resources.js';
import { workflowInstancesAdminENResources } from './instances/workflow.resources.js';

export const instancesAdminENResources = {
  actions: actionsInstancesAdminENResources,
  adminBootstrap: adminBootstrapInstancesAdminENResources,
  audit: auditInstancesAdminENResources,
  busKeys: busKeysInstancesAdminENResources,
  cockpit: cockpitInstancesAdminENResources,
  configuration: configurationInstancesAdminENResources,
  detail: detailInstancesAdminENResources,
  diagnostics: diagnosticsInstancesAdminENResources,
  doctor: doctorInstancesAdminENResources,
  errors: errorsInstancesAdminENResources,
  feedback: feedbackInstancesAdminENResources,
  filters: filtersInstancesAdminENResources,
  flow: flowInstancesAdminENResources,
  form: formInstancesAdminENResources,
  guidance: guidanceInstancesAdminENResources,
  help: helpInstancesAdminENResources,
  history: historyInstancesAdminENResources,
  instanceModules: instanceModulesInstancesAdminENResources,
  mailSync: {
    remedy: 'Open invitation template and Keycloak comparison',
    "title": "Keycloak template synchronization",
    "blocked": "Invitation delivery is blocked until the invitation template is synchronized.",
    "compare": "Compare Studio and Keycloak",
    "studio": "Saved Studio version",
    "keycloak": "Current Keycloak version",
    "unavailable": "Keycloak is currently unavailable.",
    "unsupported": "The Keycloak version cannot be imported without losing formatting. Review its HTML and explicitly transfer the desired Studio version.",
    "adopt": "Adopt Keycloak version",
    "transfer": "Transfer Studio version",
    "adoptConfirm": "Replace the saved Studio version with the displayed Keycloak version?",
    "transferConfirm": "Replace the displayed Keycloak messages with the Studio version?",
    "open": "Open / refresh Keycloak comparison",
    "loadFailed": "Could not load the comparison. Please try again.",
    "conflict": "The version has changed or could not be confirmed. Reopen the comparison. Your draft is retained.",
    "savedPending": "Saved in Studio, but not synchronized. Please check the Keycloak comparison.",
    "status": {
        "unreviewed": "Not yet reconciled",
        "pending": "Not synchronized",
        "synced": "Synchronized and confirmed by readback",
        "failed": "Synchronization not confirmed",
        "drift": "External changes detected"
    }
},
  emailVerification: {
    serverTitle: 'General email verification template',
    serverDescription: 'This standard applies to instances without an override. Saving synchronizes inheriting instances only; custom templates are retained. No email is sent.',
    serverSaved: 'General template saved. Inheriting instances have been compared and synchronized.',
    resetServerConfirm: 'Reset the general verification template to the neutral built-in standard?',
    resetInstance: 'Use general template',

    reauthRequired: 'Sign in again, then reopen the template. Your draft is retained until then.',
    currentTexts: 'Messages saved in the meantime',
    title: 'Verify email address',
    open: 'Edit verification template',
    description:
      'These German texts apply to registration and email address changes. Saving takes immediate effect in this municipality’s Keycloak realm. No email is sent.',
    realm: 'Target realm: {{realm}}',
    tokens:
      'Body placeholders: {{tenantName}}, {{verificationLink}}, {{linkExpiresIn}}. Include exactly one verification link. No subject placeholders, HTML or free URLs.',
    previewLink: '[Verify email address]',
    htmlWarning:
      'The existing HTML differs from the generated layout. Saving regenerates it from the message body.',
    existingHtml: 'View existing HTML',
    replaceHtml: 'Explicitly replace existing HTML',
    loadFailed: 'Could not load the effective verification messages. Close and reopen to retry.',
    invalid:
      'Check the template: exactly one verification link, no unknown placeholders, HTML or free URLs.',
    saved: 'The template was saved in Keycloak and read back successfully.',
    conflict:
      'The messages changed in the meantime. Your draft is preserved. The current messages are shown for comparison. Review them before saving again.',
    saveFailed:
      'Saving was not confirmed. Keycloak may already have received the change. Your draft is preserved; close, reopen and check the current messages.',
    reset: 'Apply neutral default',
    resetConfirm: 'Remove this instance override and use the current general verification template?',
  },
  invitation: invitationInstancesAdminENResources,
  keycloakPanel: keycloakPanelInstancesAdminENResources,
  keycloakStatus: keycloakStatusInstancesAdminENResources,
  mainserver: mainserverInstancesAdminENResources,
  messages: messagesInstancesAdminENResources,
  operations: operationsInstancesAdminENResources,
  page: pageInstancesAdminENResources,
  pluginReadiness: pluginReadinessInstancesAdminENResources,
  setup: setupInstancesAdminENResources,
  status: statusInstancesAdminENResources,
  success: successInstancesAdminENResources,
  table: tableInstancesAdminENResources,
  tenantIam: tenantIamInstancesAdminENResources,
  wizard: wizardInstancesAdminENResources,
  workflow: workflowInstancesAdminENResources,
} as const;
