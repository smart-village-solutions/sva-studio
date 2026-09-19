import React from 'react';
import { translatePluginKey } from '@sva/plugin-sdk';

import type {
  CategoryDataTypeOption,
  CategoryManagementItem,
  CategorySaveInput,
} from './categories.types.js';

export type Translator = (
  key: string,
  variables?: Readonly<Record<string, string | number>>
) => string;
export type Draft = CategorySaveInput;
export type DraftField = 'name' | 'parentId' | 'position' | 'iconName' | 'email' | 'dataTypes';
export type DraftErrors = Partial<Record<DraftField, string>>;

export const useTranslator = (): Translator =>
  React.useCallback((key, variables) => translatePluginKey('categories', key, variables), []);

export const messageFor = (error: unknown, pt: Translator) => {
  const code =
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : '';
  switch (code) {
    case 'missing_credentials':
    case 'organization_mainserver_credentials_missing':
      return pt('messages.loadErrorMissingCredentials');
    case 'integration_disabled':
      return pt('messages.loadErrorIntegrationDisabled');
    case 'config_not_found':
      return pt('messages.loadErrorConfigMissing');
    case 'forbidden':
      return pt('messages.loadErrorForbidden');
    case 'category_management_invalid_response':
    case 'category_management_contract_unavailable':
      return pt('messages.contractError');
    default:
      return pt('messages.loadError');
  }
};

export const initialDraft = (parentId: string | null = null): Draft => ({
  name: '',
  active: true,
  parentId,
  position: null,
  iconName: null,
  email: null,
  dataTypes: [],
});

export const categoryDraft = (item: CategoryManagementItem): Draft => ({
  name: item.name,
  active: item.active,
  parentId: item.parent?.id ?? null,
  position: item.position ?? null,
  iconName: item.iconName ?? null,
  email: item.email ?? null,
  dataTypes: item.dataTypes,
});

export const selectableDataTypeOptions = (
  options: readonly CategoryDataTypeOption[],
  pt: Translator
): readonly CategoryDataTypeOption[] => {
  const legacy: readonly CategoryDataTypeOption[] = [
    { value: 'event_record', label: pt('dataTypes.eventRecord') },
    { value: 'news_item', label: pt('dataTypes.newsItem') },
    { value: 'point_of_interest', label: pt('dataTypes.pointOfInterest') },
    { value: 'tour', label: pt('dataTypes.tour') },
  ];
  return [...new Map([...options, ...legacy].map((option) => [option.value, option])).values()];
};

export const descendantsOf = (
  item: CategoryManagementItem,
  items: readonly CategoryManagementItem[]
): Set<string> => {
  const result = new Set<string>();
  const pending = [item.id];
  while (pending.length) {
    const parentId = pending.pop();
    for (const candidate of items) {
      if (candidate.parent?.id !== parentId || result.has(candidate.id)) continue;
      result.add(candidate.id);
      pending.push(candidate.id);
    }
  }
  return result;
};

export const normalizeDraft = (
  draft: Draft,
  pt: Translator
): Readonly<{ value: Draft; errors: DraftErrors }> => {
  const name = draft.name.trim();
  const email = draft.email?.trim() || null;
  const iconName = draft.iconName?.trim() || null;
  const errors: DraftErrors = {};
  if (!name) errors.name = pt('messages.nameRequired');
  if (draft.position !== null && (!Number.isInteger(draft.position) || draft.position < 0))
    errors.position = pt('messages.positionInvalid');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))
    errors.email = pt('messages.emailInvalid');
  const dataTypes = [...new Set(draft.dataTypes.map((value) => value.trim()).filter(Boolean))];
  return {
    value: { ...draft, name, email, iconName, dataTypes },
    errors,
  };
};
