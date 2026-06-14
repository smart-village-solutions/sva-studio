import { actionsAccountENResources } from './account/actions.resources.js';
import { diagnosticsAccountENResources } from './account/diagnostics.resources.js';
import { fieldsAccountENResources } from './account/fields.resources.js';
import { messagesAccountENResources } from './account/messages.resources.js';
import { privacyAccountENResources } from './account/privacy.resources.js';
import { profileAccountENResources } from './account/profile.resources.js';
import { projectionAccountENResources } from './account/projection.resources.js';
import { rulesAccountENResources } from './account/rules.resources.js';
import { statusAccountENResources } from './account/status.resources.js';
import { validationAccountENResources } from './account/validation.resources.js';

export const accountENResources = {
  actions: actionsAccountENResources,
  diagnostics: diagnosticsAccountENResources,
  fields: fieldsAccountENResources,
  messages: messagesAccountENResources,
  privacy: privacyAccountENResources,
  profile: profileAccountENResources,
  projection: projectionAccountENResources,
  rules: rulesAccountENResources,
  status: statusAccountENResources,
  validation: validationAccountENResources,
} as const;
