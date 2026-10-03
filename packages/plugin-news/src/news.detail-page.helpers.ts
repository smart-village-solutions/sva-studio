import {
  fromDatetimeLocalValue,
  getHostMediaAssetFileName,
  readHostMediaAssetFileName as readAssetFileName,
  readHostMediaAssetTitle as readAssetTitle,
  translatePluginKey,
  type HostMediaAssetDetail,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';
import type {
  StudioMediaPickerAssetDetail,
  StudioMediaPickerAssetSummary,
} from '@sva/studio-ui-react';
import { NewsApiError } from './news.api.js';
import { getPluginNewsActionDefinition, pluginNewsActionIds } from './plugin.js';

export type StatusMessage = Readonly<{
  source: 'load' | 'save' | 'delete' | 'reference' | 'navigation';
  text: string;
}>;

export type PluginTranslator = (
  key: string,
  variables?: Readonly<Record<string, string | number>>
) => string;

const errorMessageTranslationKeys: Record<string, string> = {
  config_not_found: 'messages.errors.configNotFound',
  integration_disabled: 'messages.errors.integrationDisabled',
  invalid_config: 'messages.errors.invalidConfig',
  missing_credentials: 'messages.errors.missingCredentials',
  organization_mainserver_credentials_missing:
    'messages.errors.organizationMainserverCredentialsMissing',
  token_request_failed: 'messages.errors.tokenRequestFailed',
  unauthorized: 'messages.errors.unauthorized',
  forbidden: 'messages.errors.forbidden',
  graphql_error: 'messages.errors.graphqlError',
  invalid_response: 'messages.errors.invalidResponse',
  invalid_request: 'messages.errors.invalidRequest',
  csrf_validation_failed: 'messages.errors.csrfValidationFailed',
  idempotency_key_required: 'messages.errors.idempotencyKeyRequired',
  idempotency_key_reuse: 'messages.errors.idempotencyKeyReuse',
  missing_instance: 'messages.errors.missingInstance',
  network_error: 'messages.errors.networkError',
  not_found: 'messages.missingContent',
};

const detailFriendlyErrorCodes = new Set([
  'config_not_found',
  'integration_disabled',
  'invalid_config',
  'invalid_request',
  'missing_credentials',
  'missing_instance',
  'organization_mainserver_credentials_missing',
  'forbidden',
]);

export const resolvePluginActionLabel = (
  pt: PluginTranslator,
  actionId: (typeof pluginNewsActionIds)[keyof typeof pluginNewsActionIds]
) => {
  const definition = getPluginNewsActionDefinition(actionId);
  const titleKey = definition?.titleKey;
  if (!titleKey) {
    return actionId;
  }

  const localTitleKey = titleKey.startsWith('news.') ? titleKey.slice('news.'.length) : undefined;
  return localTitleKey ? pt(localTitleKey) : translatePluginKey('news', titleKey);
};

export const resolveNewsErrorMessage = (
  pt: PluginTranslator,
  error: unknown,
  fallbackKey: string
) => {
  if (error instanceof NewsApiError) {
    const key = errorMessageTranslationKeys[error.code];
    if (key) {
      const genericMessage = pt(key);
      const detail = error.message.trim();
      const hasMeaningfulDetail =
        detailFriendlyErrorCodes.has(error.code) &&
        detail.length > 0 &&
        detail !== error.code &&
        detail.startsWith('http_') === false &&
        detail !== genericMessage;

      if (hasMeaningfulDetail) {
        return `${genericMessage} ${pt('messages.errors.details', { message: detail })}`;
      }

      return genericMessage;
    }
  }
  return pt(fallbackKey);
};

export const parseDatetimeLocalInput = (value: string, referenceValue?: string) => {
  if (value.trim().length === 0) {
    return { isInvalid: false, normalizedValue: '' };
  }

  const normalizedValue = fromDatetimeLocalValue(value, referenceValue);
  return {
    isInvalid: normalizedValue.length === 0,
    normalizedValue,
  };
};

export type NewsMediaPickerAsset = StudioMediaPickerAssetDetail;

export const toNewsMediaPickerSummary = (
  asset: HostMediaAssetListItem
): StudioMediaPickerAssetSummary => ({
  id: asset.id,
  title: readAssetTitle(asset),
  fileName: readAssetFileName(asset),
  previewUrl: asset.previewUrl,
  mimeType: asset.mimeType,
  visibility: asset.visibility,
});

export const toNewsMediaPickerDetail = (
  asset: HostMediaAssetDetail,
  summary?: HostMediaAssetListItem,
  persistentUrl?: string | null
): NewsMediaPickerAsset => {
  const fileName = summary ? readAssetFileName(summary) : getHostMediaAssetFileName(asset);
  const title = asset.metadata.title?.trim() || (summary ? readAssetTitle(summary) : fileName);

  return {
    id: asset.id,
    title,
    fileName,
    previewUrl: asset.previewUrl?.trim() || summary?.previewUrl?.trim() || null,
    mimeType: asset.mimeType,
    visibility: asset.visibility,
    persistentUrl,
    metadata: {
      title,
      altText: asset.metadata.altText?.trim() ?? '',
      description: asset.metadata.description?.trim() ?? '',
      copyright: asset.metadata.copyright?.trim() ?? '',
      license: asset.metadata.license?.trim() ?? '',
    },
  };
};
