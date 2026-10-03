import type { UseFormReturn } from 'react-hook-form';
import { isPersistableManualContentMediaUrl, type ContentMediaUsage } from '@sva/studio-ui-react';
import {
  mapPoiDetailFormValuesToInput,
  parsePoiPayloadText,
  type PoiDetailFormValues,
} from './poi.detail-form.js';
import type { PoiDetailTabId } from './poi.detail-tabs.js';
import { validatePoiForm } from './poi.validation.js';

type ValidationInput = Readonly<{
  methods: UseFormReturn<PoiDetailFormValues>;
  values: PoiDetailFormValues;
  mediaUsages: readonly ContentMediaUsage[];
  setActiveTab: (tab: PoiDetailTabId) => void;
  focusFieldById: (id: string) => void;
}>;

const applyPoiBasisErrors = (
  { methods, setActiveTab, focusFieldById }: ValidationInput,
  validationErrors: readonly string[]
) => {
  if (validationErrors.includes('name')) {
    methods.setError('name', { type: 'manual', message: 'name' });
    methods.setFocus('name');
    setActiveTab('basis');
  }
  if (validationErrors.includes('categories')) {
    methods.setError('basis.categories', { type: 'manual', message: 'categories' });
    if (!validationErrors.includes('name')) methods.setFocus('basis.categories');
    setActiveTab('basis');
  }
  if (validationErrors.includes('webUrls')) {
    methods.setError('content.webUrls.0.url', { type: 'manual', message: 'webUrls' });
    if (!validationErrors.includes('name') && !validationErrors.includes('categories')) {
      methods.setFocus('content.webUrls.0.url');
    }
    setActiveTab('content');
  }
  if (validationErrors.includes('contact.webUrls')) {
    methods.setError('content.contact.webUrls.0.url', { type: 'manual', message: 'webUrls' });
    setActiveTab('content');
    focusFieldById('poi-contact-url');
  }
};

const applyPoiContentErrors = (
  { methods, values, mediaUsages, setActiveTab, focusFieldById }: ValidationInput,
  validationErrors: readonly string[]
) => {
  if (validationErrors.includes('addresses')) {
    methods.setError('content.addresses.0.geoLocation.latitude', {
      type: 'manual',
      message: 'addresses',
    });
    setActiveTab('content');
  }
  if (validationErrors.includes('location')) {
    methods.setError('content.location.geoLocation.latitude', {
      type: 'manual',
      message: 'location',
    });
    setActiveTab('content');
  }
  if (validationErrors.includes('priceInformations')) {
    methods.setError('content.prices.0.amount', { type: 'manual', message: 'priceInformations' });
    setActiveTab('content');
  }
  if (validationErrors.includes('mediaContents')) {
    const invalidMediaIndex = values.content.mediaContents.findIndex((entry) => {
      const url = entry.sourceUrl?.url?.trim() ?? '';
      return url.length > 0 && !isPersistableManualContentMediaUrl(url);
    });
    const mediaIndex = invalidMediaIndex >= 0 ? invalidMediaIndex : 0;
    methods.setError(`content.mediaContents.${mediaIndex}.sourceUrl.url`, {
      type: 'manual',
      message: 'webUrls',
    });
    setActiveTab('content');
    const invalidUsage = mediaUsages[mediaIndex];
    if (invalidUsage) focusFieldById(`content-media-${invalidUsage.uiId}-url`);
  }
  if (validationErrors.includes('operatingCompany.address')) {
    methods.setError('content.operator.address.geoLocation.latitude', {
      type: 'manual',
      message: 'geoLocation',
    });
    methods.setError('content.operator.address.geoLocation.longitude', {
      type: 'manual',
      message: 'geoLocation',
    });
    setActiveTab('content');
    focusFieldById('poi-operator-latitude');
  }
  if (validationErrors.includes('operatingCompany.contact.webUrls')) {
    methods.setError('content.operator.contact.webUrls.0.url', {
      type: 'manual',
      message: 'webUrls',
    });
    setActiveTab('content');
    focusFieldById('poi-operator-url');
  }
};

export const validatePoiSubmission = ({
  methods,
  values,
  mediaUsages,
  setActiveTab,
  focusFieldById,
}: ValidationInput) => {
  const payload = parsePoiPayloadText(values.content.payloadText);
  if (payload === undefined) {
    methods.setError('content.payloadText', { type: 'manual', message: 'payload' });
    setActiveTab('settings');
    methods.setFocus('content.payloadText');
    return { valid: false as const, payloadError: true as const };
  }

  const validationErrors = validatePoiForm(mapPoiDetailFormValuesToInput(values, payload));
  if (validationErrors.length === 0) return { valid: true as const, payload };

  applyPoiBasisErrors(
    { methods, values, mediaUsages, setActiveTab, focusFieldById },
    validationErrors
  );
  applyPoiContentErrors(
    { methods, values, mediaUsages, setActiveTab, focusFieldById },
    validationErrors
  );
  return { valid: false as const };
};
