import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useNavigate } from '@tanstack/react-router';
import { listHostMediaAssets, uploadHostMediaFile, usePluginTranslation, type HostMediaAssetListItem } from '@sva/plugin-sdk';
import {
  Button,
  StudioFormSummaryErrors,
  StudioDetailPageTemplate,
  StudioFormSummary,
  StudioLoadingState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sva/studio-ui-react';
import React from 'react';

import {
  createGenericItem,
  deleteGenericItem,
  GenericItemsApiError,
  getGenericItem,
  listGenericItemCategories,
  updateGenericItem,
} from './generic-items.api.js';
import {
  createDefaultGenericItemsDetailFormValues,
  mapGenericItemsDetailFormValuesToInput,
  mapGenericItemToDetailFormValues,
} from './generic-items.detail-form.js';
import { GenericItemsDetailBasisTab } from './generic-items.detail-basis-tab.js';
import { GenericItemsDetailContentTab } from './generic-items.detail-content-tab.js';
import { GenericItemsDetailHistoryTab } from './generic-items.detail-history-tab.js';
import { GenericItemsDetailSettingsTab } from './generic-items.detail-settings-tab.js';
import { genericItemsDetailTabIds, type GenericItemsDetailTabId } from './generic-items.detail-tabs.js';
import type { GenericItemCategoryOption } from './generic-items.types.js';
import { genericItemsDetailFormSchema, type GenericItemsDetailFormValues } from './generic-items.validation.js';

type StatusMessage = Readonly<{
  kind: 'success' | 'error';
  text: string;
}>;

const renderTabPanel = (title: string, description: string, panel: React.JSX.Element) => (
  <div className="space-y-4 rounded-2xl border border-border/60 bg-[rgb(var(--waste-panel-surface))] p-5">
    <section className="space-y-1">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </section>
    {panel}
  </div>
);

const errorMessage = (
  pt: ReturnType<typeof usePluginTranslation>,
  error: unknown,
  fallbackKey: string
) => (error instanceof GenericItemsApiError ? error.message : pt(fallbackKey));

const createLabels = (pt: ReturnType<typeof usePluginTranslation>) => ({
  identityTitle: pt('cards.basis.identity.title'),
  identityDescription: pt('cards.basis.identity.description'),
  metaTitle: pt('cards.basis.meta.title'),
  metaDescription: pt('cards.basis.meta.description'),
  textTitle: pt('cards.content.text.title'),
  textDescription: pt('cards.content.text.description'),
  classificationTitle: pt('cards.content.classification.title'),
  classificationDescription: pt('cards.content.classification.description'),
  relationsTitle: pt('cards.content.relations.title'),
  relationsDescription: pt('cards.content.relations.description'),
  linksMediaTitle: pt('cards.content.linksMedia.title'),
  linksMediaDescription: pt('cards.content.linksMedia.description'),
  scheduleTitle: pt('cards.content.schedule.title'),
  scheduleDescription: pt('cards.content.schedule.description'),
  payloadTitle: pt('cards.settings.payload.title'),
  payloadDescription: pt('cards.settings.payload.description'),
  secondaryTitle: pt('cards.settings.secondary.title'),
  secondaryDescription: pt('cards.settings.secondary.description'),
  title: pt('fields.title'),
  genericType: pt('fields.genericType'),
  visible: pt('fields.visible'),
  author: pt('fields.author'),
  keywords: pt('fields.keywords'),
  externalId: pt('fields.externalId'),
  publicationDate: pt('fields.publicationDate'),
  publishedAt: pt('fields.publishedAt'),
  teaser: pt('fields.teaser'),
  categoryName: pt('fields.categoryName'),
  categories: pt('fields.categories'),
  categoriesHelp: pt('fields.categoriesHelp'),
  categoriesSearch: pt('fields.categoriesSearch'),
  categoriesSearchPlaceholder: pt('fields.categoriesSearchPlaceholder'),
  contacts: pt('fields.contacts'),
  webUrls: pt('fields.webUrls'),
  addresses: pt('fields.addresses'),
  addressAddition: pt('fields.addressAddition'),
  addressKind: pt('fields.addressKind'),
  street: pt('fields.street'),
  zip: pt('fields.zip'),
  city: pt('fields.city'),
  latitude: pt('fields.latitude'),
  longitude: pt('fields.longitude'),
  contentBlocks: pt('fields.contentBlocks'),
  intro: pt('fields.intro'),
  body: pt('fields.body'),
  openingHours: pt('fields.openingHours'),
  dateFrom: pt('fields.dateFrom'),
  dateTo: pt('fields.dateTo'),
  timeFrom: pt('fields.timeFrom'),
  timeTo: pt('fields.timeTo'),
  description: pt('fields.description'),
  open: pt('fields.open'),
  notAvailable: pt('values.notAvailable'),
  weekdayMO: pt('values.weekdays.MO'),
  weekdayTU: pt('values.weekdays.TU'),
  weekdayWE: pt('values.weekdays.WE'),
  weekdayTH: pt('values.weekdays.TH'),
  weekdayFR: pt('values.weekdays.FR'),
  weekdaySA: pt('values.weekdays.SA'),
  weekdaySU: pt('values.weekdays.SU'),
  mediaContents: pt('fields.mediaContents'),
  mediaCaption: pt('fields.mediaCaption'),
  mediaCopyright: pt('fields.mediaCopyright'),
  mediaContentType: pt('fields.mediaContentType'),
  imageSearch: pt('fields.imageSearch'),
  mediaTypeUnspecified: pt('values.mediaContentTypes.unspecified'),
  mediaTypeimage: pt('values.mediaContentTypes.image'),
  mediaTypeaudio: pt('values.mediaContentTypes.audio'),
  mediaTypevideo: pt('values.mediaContentTypes.video'),
  mediaTypelogo: pt('values.mediaContentTypes.logo'),
  mediaTypeattachment: pt('values.mediaContentTypes.attachment'),
  locations: pt('fields.locations'),
  locationName: pt('fields.locationName'),
  department: pt('fields.department'),
  district: pt('fields.district'),
  regionName: pt('fields.regionName'),
  state: pt('fields.state'),
  dates: pt('fields.dates'),
  accessibilityInformations: pt('fields.accessibilityInformations'),
  priceInformations: pt('fields.priceInformations'),
  payload: pt('fields.payload'),
  accessibilityTypes: pt('fields.accessibilityTypes'),
  accessibilityLinks: pt('fields.accessibilityLinks'),
  priceName: pt('fields.priceName'),
  priceAmount: pt('fields.priceAmount'),
  priceCategory: pt('fields.priceCategory'),
  priceDescription: pt('fields.priceDescription'),
  groupPrice: pt('fields.groupPrice'),
  ageFrom: pt('fields.ageFrom'),
  ageTo: pt('fields.ageTo'),
  minAdultCount: pt('fields.minAdultCount'),
  maxAdultCount: pt('fields.maxAdultCount'),
  minChildrenCount: pt('fields.minChildrenCount'),
  maxChildrenCount: pt('fields.maxChildrenCount'),
  addContentBlock: pt('actions.addContentBlock'),
  addCategory: pt('actions.addCategory'),
  addAddress: pt('actions.addAddress'),
  addOpeningHour: pt('actions.addOpeningHour'),
  addImage: pt('actions.addImage'),
  addLocation: pt('actions.addLocation'),
  addAccessibilityInformation: pt('actions.addAccessibilityInformation'),
  addPriceInformation: pt('actions.addPriceInformation'),
  uploadMedia: pt('actions.uploadMedia'),
  uploadingMedia: pt('actions.uploadingMedia'),
  addMediaManual: pt('actions.addMediaManual'),
  selectImage: pt('actions.selectImage'),
  contentBlockItem: pt('content.blockItem'),
  addressItem: pt('content.addressItem'),
  openingHourItem: pt('content.openingHourItem'),
  locationItem: pt('content.locationItem'),
  accessibilityInformationItem: pt('content.accessibilityInformationItem'),
  priceInformationItem: pt('content.priceInformationItem'),
  removeImage: pt('actions.removeImage'),
  removeCategory: pt('actions.removeCategory'),
  mediaLibraryDescription: pt('cards.content.linksMedia.description'),
  imagePickerEmpty: pt('messages.imagePickerEmpty'),
  categoryOptionsLoading: pt('messages.categoryOptionsLoading'),
  validationWebUrls: pt('validation.webUrls'),
  richTextBlockType: pt('richText.blockType'),
  richTextParagraph: pt('richText.paragraph'),
  richTextHeading2: pt('richText.heading2'),
  richTextHeading3: pt('richText.heading3'),
  richTextBlockquote: pt('richText.blockquote'),
  richTextBulletList: pt('richText.bulletList'),
  richTextOrderedList: pt('richText.orderedList'),
  richTextBold: pt('richText.bold'),
  richTextItalic: pt('richText.italic'),
  richTextUndo: pt('richText.undo'),
  richTextRedo: pt('richText.redo'),
  richTextApplyLink: pt('richText.applyLink'),
  richTextLinkInput: pt('richText.linkInput'),
  'fields.addressAddition': pt('fields.addressAddition'),
  'fields.street': pt('fields.street'),
  'fields.zip': pt('fields.zip'),
  'fields.city': pt('fields.city'),
  'fields.latitude': pt('fields.latitude'),
  'fields.longitude': pt('fields.longitude'),
  'fields.locationName': pt('fields.locationName'),
  'fields.department': pt('fields.department'),
  'fields.district': pt('fields.district'),
  'fields.regionName': pt('fields.regionName'),
  'fields.state': pt('fields.state'),
  'actions.geocodeAddress': pt('actions.geocodeAddress'),
  'actions.geocodingAddress': pt('actions.geocodingAddress'),
  'actions.reverseGeocodeAddress': pt('actions.reverseGeocodeAddress'),
  'actions.reverseGeocodingAddress': pt('actions.reverseGeocodingAddress'),
  'messages.locationGeocodeDisabled': pt('messages.locationGeocodeDisabled'),
  'messages.locationGeocodeEmpty': pt('messages.locationGeocodeEmpty'),
  'messages.locationGeocodeRateLimited': pt('messages.locationGeocodeRateLimited'),
  'messages.locationGeocodeTimeout': pt('messages.locationGeocodeTimeout'),
  'messages.locationGeocodeForbidden': pt('messages.locationGeocodeForbidden'),
  'messages.locationGeocodeUnauthorized': pt('messages.locationGeocodeUnauthorized'),
  'messages.locationGeocodeError': pt('messages.locationGeocodeError'),
  'messages.locationMapUnavailable': pt('messages.locationMapUnavailable'),
  'messages.locationMapError': pt('messages.locationMapError'),
  'messages.mediaUploadInitializing': pt('messages.mediaUploadInitializing'),
  'messages.mediaUploadUploading': pt('messages.mediaUploadUploading'),
  'messages.mediaUploadFinalizing': pt('messages.mediaUploadFinalizing'),
  'messages.mediaUploadSuccess': pt('messages.mediaUploadSuccess'),
  'messages.mediaUploadError': pt('messages.mediaUploadError'),
  'messages.mediaUploadUnsupportedType': pt('messages.mediaUploadUnsupportedType'),
  'messages.mediaUploadUnavailableUrl': pt('messages.mediaUploadUnavailableUrl'),
  'validation.geoLocation': pt('validation.geoLocation'),
});

export function GenericItemsDetailPage({
  mode,
  contentId,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
}>) {
  const pt = usePluginTranslation('genericItems');
  const navigate = useNavigate();
  const labels = React.useMemo(() => createLabels(pt), [pt]);
  const methods = useForm<GenericItemsDetailFormValues>({
    resolver: zodResolver(genericItemsDetailFormSchema),
    defaultValues: createDefaultGenericItemsDetailFormValues(),
  });
  const summaryErrors = React.useMemo(() => {
    const errors = methods.formState.errors;
    const entries = [
      errors.title ? { field: 'generic-item-title', message: String(errors.title.message) } : null,
      errors.genericType ? { field: 'generic-item-type', message: String(errors.genericType.message) } : null,
      errors.categories ? { field: 'generic-item-categories', message: String(errors.categories.message) } : null,
      errors.payloadText ? { field: 'generic-item-payload', message: String(errors.payloadText.message) } : null,
    ];

    return entries.filter((entry): entry is { field: string; message: string } => entry !== null);
  }, [methods.formState.errors]);
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [status, setStatus] = React.useState<StatusMessage | null>(null);
  const [activeTab, setActiveTab] = React.useState<GenericItemsDetailTabId>('basis');
  const [mediaAssets, setMediaAssets] = React.useState<readonly HostMediaAssetListItem[]>([]);
  const [categoryOptions, setCategoryOptions] = React.useState<readonly GenericItemCategoryOption[]>([]);
  const [categoryOptionsLoading, setCategoryOptionsLoading] = React.useState(true);
  const [categoryOptionsError, setCategoryOptionsError] = React.useState<string | null>(null);

  const refreshMediaAssets = React.useCallback(async () => {
    try {
      const assets = await listHostMediaAssets({ fetch: globalThis.fetch.bind(globalThis), visibility: 'public' });
      setMediaAssets(assets);
      return assets;
    } catch {
      setMediaAssets([]);
      return [];
    }
  }, []);

  const uploadMediaFile = React.useCallback(
    async (file: File): Promise<HostMediaAssetListItem> => {
      const uploaded = await uploadHostMediaFile({
        fetch: globalThis.fetch.bind(globalThis),
        file,
        mediaType: 'image',
        visibility: 'public',
      });
      const assets = await refreshMediaAssets();
      const uploadedAsset = assets.find((asset) => asset.id === uploaded.assetId);
      if (!uploadedAsset) {
        throw new Error('generic_items_media_uploaded_asset_not_found');
      }
      return uploadedAsset;
    },
    [refreshMediaAssets]
  );

  React.useEffect(() => {
    void listGenericItemCategories()
      .then((categories) => {
        setCategoryOptions(categories);
        setCategoryOptionsError(null);
      })
      .catch((loadError: unknown) => {
        setCategoryOptions([]);
        setCategoryOptionsError(errorMessage(pt, loadError, 'messages.categoryOptionsLoadError'));
      })
      .finally(() => {
        setCategoryOptionsLoading(false);
      });
  }, [pt]);

  React.useEffect(() => {
    void refreshMediaAssets();
  }, [refreshMediaAssets]);

  React.useEffect(() => {
    if (mode !== 'edit' || !contentId) {
      return;
    }

    let active = true;
    setLoading(true);
    getGenericItem(contentId)
      .then((item) => {
        if (active) {
          methods.reset(mapGenericItemToDetailFormValues(item));
        }
      })
      .catch((error) => {
        if (active) {
          setStatus({ kind: 'error', text: errorMessage(pt, error, 'messages.missingContent') });
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [contentId, methods, mode, pt]);

  const handleDelete = React.useCallback(async () => {
    if (!contentId || mode !== 'edit') {
      return;
    }
    if (globalThis.confirm(pt('actions.deleteConfirm')) === false) {
      return;
    }

    try {
      await deleteGenericItem(contentId);
      await navigate({ to: '/admin/generic-items' });
    } catch (error) {
      setStatus({ kind: 'error', text: errorMessage(pt, error, 'messages.saveError') });
    }
  }, [contentId, mode, navigate, pt]);

  const onSubmit = methods.handleSubmit(async (values) => {
    setStatus(null);
    try {
      const input = mapGenericItemsDetailFormValuesToInput(values);
      if (mode === 'create') {
        await createGenericItem(input);
        setStatus({ kind: 'success', text: pt('messages.createSuccess') });
      } else if (contentId) {
        await updateGenericItem(contentId, input);
        setStatus({ kind: 'success', text: pt('messages.updateSuccess') });
      }
    } catch (error) {
      setStatus({ kind: 'error', text: errorMessage(pt, error, 'messages.saveError') });
    }
  });

  if (loading) {
    return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  }

  return (
    <FormProvider {...methods}>
      <StudioDetailPageTemplate
        title={mode === 'create' ? pt('editor.createTitle') : pt('editor.editTitle')}
        description={mode === 'create' ? pt('editor.createDescription') : pt('editor.editDescription')}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/admin/generic-items">{pt('actions.back')}</Link>
            </Button>
            {mode === 'edit' ? (
              <Button type="button" variant="outline" onClick={() => void handleDelete()}>
                {pt('actions.delete')}
              </Button>
            ) : null}
            <Button type="button" onClick={() => void onSubmit()}>
              {mode === 'create' ? pt('actions.create') : pt('actions.update')}
            </Button>
          </div>
        }
      >
        <StudioFormSummaryErrors errors={summaryErrors} />
        {status ? (
          <StudioFormSummary data-testid="generic-items-status" kind={status.kind}>
            {status.text}
          </StudioFormSummary>
        ) : null}

        <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as GenericItemsDetailTabId)}>
          <TabsList aria-label={pt('tabs.ariaLabel')}>
            {genericItemsDetailTabIds.map((tabId) => (
              <TabsTrigger key={tabId} value={tabId}>
                {pt(`tabs.${tabId}.label`)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="basis">
            {renderTabPanel(
              pt('tabs.basis.title'),
              pt('tabs.basis.description'),
              <GenericItemsDetailBasisTab
                availableCategories={categoryOptions}
                categoryOptionsError={categoryOptionsError}
                categoryOptionsLoading={categoryOptionsLoading}
                labels={labels}
              />
            )}
          </TabsContent>
          <TabsContent value="content">
            {renderTabPanel(
              pt('tabs.content.title'),
              pt('tabs.content.description'),
              <GenericItemsDetailContentTab labels={labels} mediaAssets={mediaAssets} onUploadFile={uploadMediaFile} />
            )}
          </TabsContent>
          <TabsContent value="settings">
            {renderTabPanel(
              pt('tabs.settings.title'),
              pt('tabs.settings.description'),
              <GenericItemsDetailSettingsTab labels={labels} />
            )}
          </TabsContent>
          <TabsContent value="history">
            {renderTabPanel(
              pt('tabs.history.title'),
              pt('tabs.history.description'),
              <GenericItemsDetailHistoryTab message={pt('history.placeholder')} />
            )}
          </TabsContent>
        </Tabs>
      </StudioDetailPageTemplate>
    </FormProvider>
  );
}
