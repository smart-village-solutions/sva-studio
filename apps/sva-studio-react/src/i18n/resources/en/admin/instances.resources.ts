import { actionsInstancesAdminENResources } from './instances/actions.resources.js';
import { adminBootstrapInstancesAdminENResources } from './instances/adminBootstrap.resources.js';
import { auditInstancesAdminENResources } from './instances/audit.resources.js';
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
import { keycloakPanelInstancesAdminENResources } from './instances/keycloakPanel.resources.js';
import { keycloakStatusInstancesAdminENResources } from './instances/keycloakStatus.resources.js';
import { messagesInstancesAdminENResources } from './instances/messages.resources.js';
import { operationsInstancesAdminENResources } from './instances/operations.resources.js';
import { pageInstancesAdminENResources } from './instances/page.resources.js';
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
  keycloakPanel: keycloakPanelInstancesAdminENResources,
  keycloakStatus: keycloakStatusInstancesAdminENResources,
  messages: messagesInstancesAdminENResources,
  operations: operationsInstancesAdminENResources,
  page: pageInstancesAdminENResources,
  setup: setupInstancesAdminENResources,
  status: statusInstancesAdminENResources,
  success: successInstancesAdminENResources,
  table: tableInstancesAdminENResources,
  tenantIam: tenantIamInstancesAdminENResources,
  wizard: wizardInstancesAdminENResources,
  workflow: workflowInstancesAdminENResources,
} as const;
