import { actionsAccountDEResources } from './account/actions.resources.js';
import { diagnosticsAccountDEResources } from './account/diagnostics.resources.js';
import { fieldsAccountDEResources } from './account/fields.resources.js';
import { messagesAccountDEResources } from './account/messages.resources.js';
import { privacyAccountDEResources } from './account/privacy.resources.js';
import { profileAccountDEResources } from './account/profile.resources.js';
import { projectionAccountDEResources } from './account/projection.resources.js';
import { rulesAccountDEResources } from './account/rules.resources.js';
import { statusAccountDEResources } from './account/status.resources.js';
import { validationAccountDEResources } from './account/validation.resources.js';

export const accountDEResources = {
  actions: actionsAccountDEResources,
  diagnostics: diagnosticsAccountDEResources,
  fields: fieldsAccountDEResources,
  messages: messagesAccountDEResources,
  privacy: privacyAccountDEResources,
  profile: profileAccountDEResources,
  projection: projectionAccountDEResources,
  rules: rulesAccountDEResources,
  status: statusAccountDEResources,
  validation: validationAccountDEResources,
} as const;
