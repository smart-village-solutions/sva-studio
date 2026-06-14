import { actionsInstancesAdminDEResources } from './instances/actions.resources.js';
import { adminBootstrapInstancesAdminDEResources } from './instances/adminBootstrap.resources.js';
import { auditInstancesAdminDEResources } from './instances/audit.resources.js';
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
import { keycloakPanelInstancesAdminDEResources } from './instances/keycloakPanel.resources.js';
import { keycloakStatusInstancesAdminDEResources } from './instances/keycloakStatus.resources.js';
import { messagesInstancesAdminDEResources } from './instances/messages.resources.js';
import { operationsInstancesAdminDEResources } from './instances/operations.resources.js';
import { pageInstancesAdminDEResources } from './instances/page.resources.js';
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
  keycloakPanel: keycloakPanelInstancesAdminDEResources,
  keycloakStatus: keycloakStatusInstancesAdminDEResources,
  messages: messagesInstancesAdminDEResources,
  operations: operationsInstancesAdminDEResources,
  page: pageInstancesAdminDEResources,
  setup: setupInstancesAdminDEResources,
  status: statusInstancesAdminDEResources,
  success: successInstancesAdminDEResources,
  table: tableInstancesAdminDEResources,
  tenantIam: tenantIamInstancesAdminDEResources,
  wizard: wizardInstancesAdminDEResources,
  workflow: workflowInstancesAdminDEResources,
} as const;
