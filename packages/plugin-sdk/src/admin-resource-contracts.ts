import type { UiAccessRequirement } from '@sva/iam-core';
import type {
  AdminResourceGuard,
  AdminResourceViews,
  AdminResourceListCapabilities,
} from './admin-resource-list-contracts.js';

export type AdminResourceDetailCapabilities = {
  readonly history?: {
    readonly bindingKey: string;
    readonly titleKey: string;
  };
  readonly revisions?: {
    readonly bindingKey: string;
    readonly restoreActionId: string;
    readonly titleKey: string;
  };
};

export type AdminResourceCapabilities = {
  readonly list?: AdminResourceListCapabilities;
  readonly detail?: AdminResourceDetailCapabilities;
};

export type AdminResourceViewPermissions = {
  readonly list?: readonly string[];
  readonly create?: readonly string[];
  readonly detail?: readonly string[];
  readonly history?: readonly string[];
};

export type AdminResourceViewAccessRequirements = {
  readonly list?: UiAccessRequirement;
  readonly create?: UiAccessRequirement;
  readonly detail?: UiAccessRequirement;
  readonly history?: UiAccessRequirement;
};

export type ContentResourceViewBindingDefinition = {
  readonly bindingKey: string;
};

export type AdminResourceContentUiBindings = {
  readonly list?: ContentResourceViewBindingDefinition;
  readonly detail?: ContentResourceViewBindingDefinition;
  readonly editor?: ContentResourceViewBindingDefinition;
};

export type AdminResourceContentUiDefinition = {
  readonly contentType: string;
  readonly bindings?: AdminResourceContentUiBindings;
};

export type AdminResourceDefinition = {
  readonly resourceId: string;
  readonly basePath: string;
  readonly titleKey: string;
  readonly guard: AdminResourceGuard;
  readonly moduleId?: string;
  readonly views: AdminResourceViews;
  readonly permissions?: AdminResourceViewPermissions;
  readonly accessRequirements?: AdminResourceViewAccessRequirements;
  readonly capabilities?: AdminResourceCapabilities;
  readonly contentUi?: AdminResourceContentUiDefinition;
};
