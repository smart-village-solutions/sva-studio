import type { HostMediaAssetListItem } from '@sva/plugin-sdk';
import {
  GENERIC_ITEMS_OPENING_HOUR_WEEKDAYS,
} from './generic-items.constants.js';
import {
  Button,
  Checkbox,
  Input,
  RichTextHtmlEditor,
  Select,
  StudioField,
  StudioFieldGroup,
  Textarea,
  getStudioFormFieldProps,
} from '@sva/studio-ui-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import * as React from 'react';

import type { GenericItemsDetailFormValues } from './generic-items.validation.js';
import { GenericItemsDetailCard } from './generic-items.detail-card.js';
import { GenericItemsGeoAddressFields } from './generic-items.geo-address-fields.js';
import { GenericItemsDetailMediaLibraryDialog } from './generic-items.detail-media-library-dialog.js';
import { GenericItemsDetailMediaList } from './generic-items.detail-media-list.js';
import { useGenericItemsDetailMediaState } from './generic-items.detail-media-state.js';
import { getMapGeocodingConfig } from './generic-items.map-geocoding-client.js';
import { GenericItemsGeoLocationFields } from './generic-items.geo-location-fields.js';

export const GenericItemsDetailContentTab = ({
  labels,
  mediaAssets = [],
  onUploadFile = async (): Promise<HostMediaAssetListItem> => {
    throw new Error('generic_items_media_upload_unavailable');
  },
}: Readonly<{
  labels: Record<string, string>;
  mediaAssets?: readonly HostMediaAssetListItem[];
  onUploadFile?: (file: File) => Promise<HostMediaAssetListItem>;
}>) => {
  const {
    control,
    register,
    formState: { errors },
    setValue,
  } = useFormContext<GenericItemsDetailFormValues>();
  const webUrlsArray = useFieldArray({ control, name: 'webUrls' });
  const contactsArray = useFieldArray({ control, name: 'contacts' });
  const addressesArray = useFieldArray({ control, name: 'addresses' });
  const datesArray = useFieldArray({ control, name: 'dates' });
  const contentBlocksArray = useFieldArray({ control, name: 'contentBlocks' });
  const openingHoursArray = useFieldArray({ control, name: 'openingHours' });
  const mediaContentsArray = useFieldArray({ control, name: 'mediaContents' });
  const locationsArray = useFieldArray({ control, name: 'locations' });
  const accessibilityInformationsArray = useFieldArray({ control, name: 'accessibilityInformations' });
  const priceInformationsArray = useFieldArray({ control, name: 'priceInformations' });
  const webUrls = useWatch({ control, name: 'webUrls' }) ?? [];
  const contacts = useWatch({ control, name: 'contacts' }) ?? [];
  const addresses = useWatch({ control, name: 'addresses' }) ?? [];
  const dates = useWatch({ control, name: 'dates' }) ?? [];
  const contentBlocks = useWatch({ control, name: 'contentBlocks' }) ?? [];
  const openingHours = useWatch({ control, name: 'openingHours' }) ?? [];
  const mediaContents = useWatch({ control, name: 'mediaContents' }) ?? [];
  const locations = useWatch({ control, name: 'locations' }) ?? [];
  const accessibilityInformations = useWatch({ control, name: 'accessibilityInformations' }) ?? [];
  const priceInformations = useWatch({ control, name: 'priceInformations' }) ?? [];
  const [isGeocodingEnabled, setIsGeocodingEnabled] = React.useState(true);
  const [isReverseGeocodingEnabled, setIsReverseGeocodingEnabled] = React.useState(true);
  const [isMapEnabled, setIsMapEnabled] = React.useState(true);
  const [mapStyleUrl, setMapStyleUrl] = React.useState('');

  const teaserField = getStudioFormFieldProps({ id: 'generic-item-teaser', error: errors.teaser });
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const mediaState = useGenericItemsDetailMediaState({
    append: mediaContentsArray.append,
    onUploadFile,
    remove: mediaContentsArray.remove,
  });

  React.useEffect(() => {
    let active = true;

    void getMapGeocodingConfig()
      .then((config) => {
        if (!active) {
          return;
        }
        setIsGeocodingEnabled(config.geocodeEnabled);
        setIsReverseGeocodingEnabled(config.reverseGeocodeEnabled);
        setMapStyleUrl(config.styleUrl);
        setIsMapEnabled(config.killSwitchEnabled === false && config.styleUrl.length > 0);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setIsGeocodingEnabled(false);
        setIsReverseGeocodingEnabled(false);
        setIsMapEnabled(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <GenericItemsDetailCard title={labels.textTitle} description={labels.textDescription}>
        <StudioField {...teaserField} label={labels.teaser} description={labels.teaserHelp}>
          <Textarea {...teaserField.controlProps} {...register('teaser')} />
        </StudioField>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{labels.contentBlocks}</p>
              <p className="text-sm text-muted-foreground">{labels.contentBlocksHelp}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => contentBlocksArray.append({ title: '', intro: '', body: '', mediaContents: [] })}
            >
              {labels.addContentBlock}
            </Button>
          </div>
          {contentBlocks.map((contentBlock, index) => {
            const bodyLabelId = `generic-item-content-block-body-label-${index}`;

            return (
              <div
                key={contentBlocksArray.fields[index]?.id ?? `fallback-content-block-${index}`}
                className="space-y-4 rounded-xl border border-border/60 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{labels.contentBlockItem}</p>
                  {contentBlocks.length > 1 ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => contentBlocksArray.remove(index)}>
                      {labels.remove}
                    </Button>
                  ) : null}
                </div>
                <StudioField id={`generic-item-content-block-title-${index}`} label={labels.title}>
                  <Input
                    id={`generic-item-content-block-title-${index}`}
                    value={contentBlock.title}
                    onChange={(event) =>
                      setValue(`contentBlocks.${index}.title`, event.target.value, { shouldDirty: true })
                    }
                  />
                </StudioField>
                <StudioField id={`generic-item-content-block-intro-${index}`} label={labels.intro}>
                  <Textarea
                    id={`generic-item-content-block-intro-${index}`}
                    value={contentBlock.intro}
                    onChange={(event) =>
                      setValue(`contentBlocks.${index}.intro`, event.target.value, { shouldDirty: true })
                    }
                  />
                </StudioField>
                <div className="space-y-1">
                  <label id={bodyLabelId} htmlFor={`generic-item-content-block-body-${index}`} className="text-sm font-medium">
                    {labels.body}
                  </label>
                  <RichTextHtmlEditor
                    id={`generic-item-content-block-body-${index}`}
                    labelId={bodyLabelId}
                    value={contentBlock.body}
                    onChange={(nextValue) => setValue(`contentBlocks.${index}.body`, nextValue, { shouldDirty: true })}
                    blockTypeOptions={[
                      { value: 'paragraph', label: labels.richTextParagraph },
                      { value: 'heading-2', label: labels.richTextHeading2 },
                      { value: 'heading-3', label: labels.richTextHeading3 },
                      { value: 'blockquote', label: labels.richTextBlockquote },
                    ]}
                    toolbarLabels={{
                      blockType: labels.richTextBlockType,
                      bulletList: labels.richTextBulletList,
                      orderedList: labels.richTextOrderedList,
                      bold: labels.richTextBold,
                      italic: labels.richTextItalic,
                      undo: labels.richTextUndo,
                      redo: labels.richTextRedo,
                      link: labels.richTextApplyLink,
                      linkPrompt: labels.richTextLinkInput,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </GenericItemsDetailCard>

      <GenericItemsDetailCard title={labels.relationsTitle} description={labels.relationsDescription}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{labels.addresses}</p>
              <p className="text-sm text-muted-foreground">{labels.addressesHelp}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                addressesArray.append({
                  addition: '',
                  street: '',
                  zip: '',
                  city: '',
                  kind: '',
                  latitude: '',
                  longitude: '',
                })
              }
            >
              {labels.addAddress}
            </Button>
          </div>
          {addresses.map((address, index) => (
            <div
              key={addressesArray.fields[index]?.id ?? `fallback-address-${index}`}
              className="space-y-4 rounded-xl border border-border/60 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{labels.addressItem}</p>
                {addresses.length > 1 ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => addressesArray.remove(index)}>
                    {labels.remove}
                  </Button>
                ) : null}
              </div>
              <StudioField id={`generic-item-address-kind-${index}`} label={labels.addressKind}>
                <Input
                  id={`generic-item-address-kind-${index}`}
                  value={address.kind}
                  onChange={(event) => setValue(`addresses.${index}.kind`, event.target.value, { shouldDirty: true })}
                />
              </StudioField>
              <GenericItemsGeoAddressFields
                pt={(key) => labels[key] ?? key}
                addition={address.addition}
                additionId={`generic-item-address-addition-${index}`}
                city={address.city}
                cityId={`generic-item-address-city-${index}`}
                geocodingEnabled={isGeocodingEnabled}
                mapEnabled={isMapEnabled}
                mapStyleUrl={mapStyleUrl}
                latitude={address.latitude}
                latitudeId={`generic-item-address-latitude-${index}`}
                longitude={address.longitude}
                longitudeId={`generic-item-address-longitude-${index}`}
                reverseGeocodingEnabled={isReverseGeocodingEnabled}
                street={address.street}
                streetId={`generic-item-address-street-${index}`}
                zip={address.zip}
                zipId={`generic-item-address-zip-${index}`}
                onAdditionChange={(value) => setValue(`addresses.${index}.addition`, value, { shouldDirty: true })}
                onCityChange={(value) => setValue(`addresses.${index}.city`, value, { shouldDirty: true })}
                onCoordinatesChange={(coordinates) => {
                  setValue(`addresses.${index}.latitude`, coordinates.latitude, { shouldDirty: true });
                  setValue(`addresses.${index}.longitude`, coordinates.longitude, { shouldDirty: true });
                }}
                onLatitudeChange={(value) => setValue(`addresses.${index}.latitude`, value, { shouldDirty: true })}
                onLongitudeChange={(value) => setValue(`addresses.${index}.longitude`, value, { shouldDirty: true })}
                onStreetChange={(value) => setValue(`addresses.${index}.street`, value, { shouldDirty: true })}
                onZipChange={(value) => setValue(`addresses.${index}.zip`, value, { shouldDirty: true })}
              />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{labels.contacts}</p>
              <p className="text-sm text-muted-foreground">{labels.contactsHelp}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => contactsArray.append({ firstName: '', lastName: '', email: '', phone: '' })}
            >
              {labels.addContact}
            </Button>
          </div>
          {contacts.map((contact, index) => (
            <div
              key={contactsArray.fields[index]?.id ?? `fallback-contact-${index}`}
              className="space-y-4 rounded-xl border border-border/60 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{labels.contactItem}</p>
                {contacts.length > 1 ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => contactsArray.remove(index)}>
                    {labels.remove}
                  </Button>
                ) : null}
              </div>
              <StudioFieldGroup columns={2}>
                <StudioField id={`generic-item-contact-first-name-${index}`} label={labels.firstName}>
                  <Input
                    id={`generic-item-contact-first-name-${index}`}
                    value={contact.firstName}
                    onChange={(event) => setValue(`contacts.${index}.firstName`, event.target.value, { shouldDirty: true })}
                  />
                </StudioField>
                <StudioField id={`generic-item-contact-last-name-${index}`} label={labels.lastName}>
                  <Input
                    id={`generic-item-contact-last-name-${index}`}
                    value={contact.lastName}
                    onChange={(event) => setValue(`contacts.${index}.lastName`, event.target.value, { shouldDirty: true })}
                  />
                </StudioField>
              </StudioFieldGroup>
              <StudioFieldGroup columns={2}>
                <StudioField id={`generic-item-contact-email-${index}`} label={labels.email}>
                  <Input
                    id={`generic-item-contact-email-${index}`}
                    value={contact.email}
                    onChange={(event) => setValue(`contacts.${index}.email`, event.target.value, { shouldDirty: true })}
                  />
                </StudioField>
                <StudioField id={`generic-item-contact-phone-${index}`} label={labels.phone}>
                  <Input
                    id={`generic-item-contact-phone-${index}`}
                    value={contact.phone}
                    onChange={(event) => setValue(`contacts.${index}.phone`, event.target.value, { shouldDirty: true })}
                  />
                </StudioField>
              </StudioFieldGroup>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{labels.locations}</p>
              <p className="text-sm text-muted-foreground">{labels.locationsHelp}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                locationsArray.append({
                  name: '',
                  department: '',
                  district: '',
                  regionName: '',
                  state: '',
                  latitude: '',
                  longitude: '',
                })
              }
            >
              {labels.addLocation}
            </Button>
          </div>
          {locations.map((location, index) => (
            <div
              key={locationsArray.fields[index]?.id ?? `fallback-location-${index}`}
              className="space-y-4 rounded-xl border border-border/60 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{labels.locationItem}</p>
                {locations.length > 1 ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => locationsArray.remove(index)}>
                    {labels.remove}
                  </Button>
                ) : null}
              </div>
              <GenericItemsGeoLocationFields
                pt={(key) => labels[key] ?? key}
                name={location.name}
                nameId={`generic-item-location-name-${index}`}
                department={location.department}
                departmentId={`generic-item-location-department-${index}`}
                district={location.district}
                districtId={`generic-item-location-district-${index}`}
                regionName={location.regionName}
                regionNameId={`generic-item-location-region-name-${index}`}
                state={location.state}
                stateId={`generic-item-location-state-${index}`}
                geocodingEnabled={isGeocodingEnabled}
                mapEnabled={isMapEnabled}
                mapStyleUrl={mapStyleUrl}
                latitude={location.latitude}
                latitudeId={`generic-item-location-latitude-${index}`}
                longitude={location.longitude}
                longitudeId={`generic-item-location-longitude-${index}`}
                reverseGeocodingEnabled={isReverseGeocodingEnabled}
                onNameChange={(value) => setValue(`locations.${index}.name`, value, { shouldDirty: true })}
                onDepartmentChange={(value) => setValue(`locations.${index}.department`, value, { shouldDirty: true })}
                onDistrictChange={(value) => setValue(`locations.${index}.district`, value, { shouldDirty: true })}
                onRegionNameChange={(value) => setValue(`locations.${index}.regionName`, value, { shouldDirty: true })}
                onStateChange={(value) => setValue(`locations.${index}.state`, value, { shouldDirty: true })}
                onCoordinatesChange={(coordinates) => {
                  setValue(`locations.${index}.latitude`, coordinates.latitude, { shouldDirty: true });
                  setValue(`locations.${index}.longitude`, coordinates.longitude, { shouldDirty: true });
                }}
                onLatitudeChange={(value) => setValue(`locations.${index}.latitude`, value, { shouldDirty: true })}
                onLongitudeChange={(value) => setValue(`locations.${index}.longitude`, value, { shouldDirty: true })}
              />
            </div>
          ))}
        </div>
      </GenericItemsDetailCard>

      <GenericItemsDetailCard title={labels.linksMediaTitle} description={labels.linksMediaDescription}>
        <div className="space-y-5">
          <GenericItemsDetailMediaList
            errors={errors}
            fields={mediaContentsArray.fields}
            mediaContents={mediaContents}
            onRemove={mediaState.handleRemove}
            labels={labels}
            register={register}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={mediaState.openDialog}>
              {labels.addImage}
            </Button>
            <input
              ref={uploadInputRef}
              aria-label={labels.uploadMedia}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => void mediaState.handleUploadChange(event)}
            />
            <Button type="button" variant="outline" disabled={mediaState.uploadBusy} onClick={() => uploadInputRef.current?.click()}>
              {mediaState.uploadBusy ? labels.uploadingMedia : labels.uploadMedia}
            </Button>
            <Button type="button" variant="outline" onClick={mediaState.handleManualAdd}>
              {labels.addMediaManual}
            </Button>
          </div>
          {mediaState.uploadMessageKey ? (
            <p className={`text-sm font-medium ${mediaState.uploadPhase === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
              {labels[mediaState.uploadMessageKey] ?? mediaState.uploadMessageKey}
            </p>
          ) : null}
        </div>
        <GenericItemsDetailMediaLibraryDialog
          mediaAssets={mediaAssets}
          mediaContents={mediaContents}
          onClose={mediaState.closeDialog}
          onSelectAsset={mediaState.handleSelectAsset}
          open={mediaState.dialogOpen}
          labels={labels}
          searchValue={mediaState.searchValue}
          setSearchValue={mediaState.setSearchValue}
        />
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{labels.webUrls}</p>
              <p className="text-sm text-muted-foreground">{labels.webUrlsHelp}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => webUrlsArray.append({ url: '', description: '' })}
            >
              {labels.addLink}
            </Button>
          </div>
          {webUrls.map((webUrl, index) => (
            <div
              key={webUrlsArray.fields[index]?.id ?? `fallback-web-url-${index}`}
              className="space-y-4 rounded-xl border border-border/60 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{labels.linkItem}</p>
                {webUrls.length > 1 ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => webUrlsArray.remove(index)}>
                    {labels.remove}
                  </Button>
                ) : null}
              </div>
              <StudioFieldGroup columns={2}>
                <StudioField id={`generic-item-web-url-${index}`} label={labels.url}>
                  <Input
                    id={`generic-item-web-url-${index}`}
                    value={webUrl.url}
                    onChange={(event) => setValue(`webUrls.${index}.url`, event.target.value, { shouldDirty: true })}
                  />
                </StudioField>
                <StudioField id={`generic-item-web-url-description-${index}`} label={labels.urlDescription}>
                  <Input
                    id={`generic-item-web-url-description-${index}`}
                    value={webUrl.description}
                    onChange={(event) =>
                      setValue(`webUrls.${index}.description`, event.target.value, { shouldDirty: true })
                    }
                  />
                </StudioField>
              </StudioFieldGroup>
            </div>
          ))}
        </div>
      </GenericItemsDetailCard>

      <GenericItemsDetailCard title={labels.secondaryTitle} description={labels.secondaryDescription}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{labels.accessibilityInformations}</p>
              <p className="text-sm text-muted-foreground">{labels.accessibilityInformationsHelp}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                accessibilityInformationsArray.append({
                  description: '',
                  types: '',
                  urls: [{ url: '', description: '' }],
                })
              }
            >
              {labels.addAccessibilityInformation}
            </Button>
          </div>
          {accessibilityInformations.map((accessibilityInformation, index) => (
            <div
              key={accessibilityInformationsArray.fields[index]?.id ?? `fallback-accessibility-information-${index}`}
              className="space-y-4 rounded-xl border border-border/60 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{labels.accessibilityInformationItem}</p>
                {accessibilityInformations.length > 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => accessibilityInformationsArray.remove(index)}
                  >
                    {labels.remove}
                  </Button>
                ) : null}
              </div>
              <StudioField id={`generic-item-accessibility-description-${index}`} label={labels.description}>
                <Textarea
                  id={`generic-item-accessibility-description-${index}`}
                  value={accessibilityInformation.description}
                  onChange={(event) =>
                    setValue(`accessibilityInformations.${index}.description`, event.target.value, { shouldDirty: true })
                  }
                />
              </StudioField>
              <StudioField id={`generic-item-accessibility-types-${index}`} label={labels.accessibilityTypes}>
                <Input
                  id={`generic-item-accessibility-types-${index}`}
                  value={accessibilityInformation.types}
                  onChange={(event) =>
                    setValue(`accessibilityInformations.${index}.types`, event.target.value, { shouldDirty: true })
                  }
                />
              </StudioField>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{labels.accessibilityLinks}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setValue(
                        `accessibilityInformations.${index}.urls`,
                        [...(accessibilityInformation.urls ?? []), { url: '', description: '' }],
                        { shouldDirty: true }
                      )
                    }
                  >
                    {labels.addLink}
                  </Button>
                </div>
                {(accessibilityInformation.urls ?? []).map((webUrl, urlIndex) => (
                  <div
                    key={`generic-item-accessibility-url-${index}-${urlIndex}`}
                    className="space-y-4 rounded-xl border border-border/60 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{labels.linkItem}</p>
                      {(accessibilityInformation.urls?.length ?? 0) > 1 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setValue(
                              `accessibilityInformations.${index}.urls`,
                              (accessibilityInformation.urls ?? []).filter((_, currentIndex) => currentIndex !== urlIndex),
                              { shouldDirty: true }
                            )
                          }
                        >
                          {labels.remove}
                        </Button>
                      ) : null}
                    </div>
                    <StudioFieldGroup columns={2}>
                      <StudioField id={`generic-item-accessibility-url-${index}-${urlIndex}`} label={labels.url}>
                        <Input
                          id={`generic-item-accessibility-url-${index}-${urlIndex}`}
                          value={webUrl.url}
                          onChange={(event) =>
                            setValue(
                              `accessibilityInformations.${index}.urls.${urlIndex}.url`,
                              event.target.value,
                              { shouldDirty: true }
                            )
                          }
                        />
                      </StudioField>
                      <StudioField
                        id={`generic-item-accessibility-url-description-${index}-${urlIndex}`}
                        label={labels.urlDescription}
                      >
                        <Input
                          id={`generic-item-accessibility-url-description-${index}-${urlIndex}`}
                          value={webUrl.description}
                          onChange={(event) =>
                            setValue(
                              `accessibilityInformations.${index}.urls.${urlIndex}.description`,
                              event.target.value,
                              { shouldDirty: true }
                            )
                          }
                        />
                      </StudioField>
                    </StudioFieldGroup>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{labels.priceInformations}</p>
              <p className="text-sm text-muted-foreground">{labels.priceInformationsHelp}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                priceInformationsArray.append({
                  name: '',
                  amount: '',
                  groupPrice: false,
                  ageFrom: '',
                  ageTo: '',
                  minAdultCount: '',
                  maxAdultCount: '',
                  minChildrenCount: '',
                  maxChildrenCount: '',
                  description: '',
                  category: '',
                })
              }
            >
              {labels.addPriceInformation}
            </Button>
          </div>
          {priceInformations.map((priceInformation, index) => (
            <div
              key={priceInformationsArray.fields[index]?.id ?? `fallback-price-information-${index}`}
              className="space-y-4 rounded-xl border border-border/60 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{labels.priceInformationItem}</p>
                {priceInformations.length > 1 ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => priceInformationsArray.remove(index)}>
                    {labels.remove}
                  </Button>
                ) : null}
              </div>
              <StudioFieldGroup columns={2}>
                <StudioField id={`generic-item-price-name-${index}`} label={labels.priceName}>
                  <Input
                    id={`generic-item-price-name-${index}`}
                    value={priceInformation.name}
                    onChange={(event) => setValue(`priceInformations.${index}.name`, event.target.value, { shouldDirty: true })}
                  />
                </StudioField>
                <StudioField id={`generic-item-price-category-${index}`} label={labels.priceCategory}>
                  <Input
                    id={`generic-item-price-category-${index}`}
                    value={priceInformation.category}
                    onChange={(event) =>
                      setValue(`priceInformations.${index}.category`, event.target.value, { shouldDirty: true })
                    }
                  />
                </StudioField>
              </StudioFieldGroup>
              <StudioFieldGroup columns={2}>
                <StudioField id={`generic-item-price-amount-${index}`} label={labels.priceAmount}>
                  <Input
                    id={`generic-item-price-amount-${index}`}
                    type="number"
                    value={priceInformation.amount}
                    onChange={(event) =>
                      setValue(`priceInformations.${index}.amount`, event.target.value, { shouldDirty: true })
                    }
                  />
                </StudioField>
                <StudioField id={`generic-item-price-group-${index}`} label={labels.groupPrice}>
                  <Checkbox
                    id={`generic-item-price-group-${index}`}
                    checked={priceInformation.groupPrice}
                    onChange={(event) =>
                      setValue(`priceInformations.${index}.groupPrice`, event.currentTarget.checked, { shouldDirty: true })
                    }
                  />
                </StudioField>
              </StudioFieldGroup>
              <StudioFieldGroup columns={2}>
                <StudioField id={`generic-item-price-age-from-${index}`} label={labels.ageFrom}>
                  <Input
                    id={`generic-item-price-age-from-${index}`}
                    type="number"
                    value={priceInformation.ageFrom}
                    onChange={(event) =>
                      setValue(`priceInformations.${index}.ageFrom`, event.target.value, { shouldDirty: true })
                    }
                  />
                </StudioField>
                <StudioField id={`generic-item-price-age-to-${index}`} label={labels.ageTo}>
                  <Input
                    id={`generic-item-price-age-to-${index}`}
                    type="number"
                    value={priceInformation.ageTo}
                    onChange={(event) =>
                      setValue(`priceInformations.${index}.ageTo`, event.target.value, { shouldDirty: true })
                    }
                  />
                </StudioField>
              </StudioFieldGroup>
              <StudioFieldGroup columns={2}>
                <StudioField id={`generic-item-price-min-adults-${index}`} label={labels.minAdultCount}>
                  <Input
                    id={`generic-item-price-min-adults-${index}`}
                    type="number"
                    value={priceInformation.minAdultCount}
                    onChange={(event) =>
                      setValue(`priceInformations.${index}.minAdultCount`, event.target.value, { shouldDirty: true })
                    }
                  />
                </StudioField>
                <StudioField id={`generic-item-price-max-adults-${index}`} label={labels.maxAdultCount}>
                  <Input
                    id={`generic-item-price-max-adults-${index}`}
                    type="number"
                    value={priceInformation.maxAdultCount}
                    onChange={(event) =>
                      setValue(`priceInformations.${index}.maxAdultCount`, event.target.value, { shouldDirty: true })
                    }
                  />
                </StudioField>
              </StudioFieldGroup>
              <StudioFieldGroup columns={2}>
                <StudioField id={`generic-item-price-min-children-${index}`} label={labels.minChildrenCount}>
                  <Input
                    id={`generic-item-price-min-children-${index}`}
                    type="number"
                    value={priceInformation.minChildrenCount}
                    onChange={(event) =>
                      setValue(`priceInformations.${index}.minChildrenCount`, event.target.value, { shouldDirty: true })
                    }
                  />
                </StudioField>
                <StudioField id={`generic-item-price-max-children-${index}`} label={labels.maxChildrenCount}>
                  <Input
                    id={`generic-item-price-max-children-${index}`}
                    type="number"
                    value={priceInformation.maxChildrenCount}
                    onChange={(event) =>
                      setValue(`priceInformations.${index}.maxChildrenCount`, event.target.value, { shouldDirty: true })
                    }
                  />
                </StudioField>
              </StudioFieldGroup>
              <StudioField id={`generic-item-price-description-${index}`} label={labels.priceDescription}>
                <Input
                  id={`generic-item-price-description-${index}`}
                  value={priceInformation.description}
                  onChange={(event) =>
                    setValue(`priceInformations.${index}.description`, event.target.value, { shouldDirty: true })
                  }
                />
              </StudioField>
            </div>
          ))}
        </div>
      </GenericItemsDetailCard>

      <GenericItemsDetailCard title={labels.scheduleTitle} description={labels.scheduleDescription}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{labels.openingHours}</p>
              <p className="text-sm text-muted-foreground">{labels.openingHoursHelp}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                openingHoursArray.append({
                  weekday: '',
                  dateFrom: '',
                  dateTo: '',
                  timeFrom: '',
                  timeTo: '',
                  description: '',
                  open: false,
                })
              }
            >
              {labels.addOpeningHour}
            </Button>
          </div>
          {openingHours.map((openingHour, index) => (
            <section
              key={openingHoursArray.fields[index]?.id ?? `fallback-opening-hour-${index}`}
              className="overflow-hidden rounded-xl border border-border/60 bg-card"
            >
              <div className="flex items-center justify-between bg-muted px-4 py-3 text-card-foreground">
                <h4 className="text-base font-semibold">{labels.openingHourItem}</h4>
                {openingHours.length > 1 ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => openingHoursArray.remove(index)}>
                    {labels.remove}
                  </Button>
                ) : (
                  <div className="h-9" aria-hidden="true" />
                )}
              </div>
              <div className="space-y-4 p-4">
                <StudioFieldGroup columns={2}>
                  <StudioField id={`generic-item-opening-date-from-${index}`} label={labels.dateFrom}>
                    <Input
                      id={`generic-item-opening-date-from-${index}`}
                      type="date"
                      value={openingHour.dateFrom}
                      onChange={(event) =>
                        setValue(`openingHours.${index}.dateFrom`, event.target.value, { shouldDirty: true })
                      }
                    />
                  </StudioField>
                  <StudioField id={`generic-item-opening-date-to-${index}`} label={labels.dateTo}>
                    <Input
                      id={`generic-item-opening-date-to-${index}`}
                      type="date"
                      value={openingHour.dateTo}
                      onChange={(event) =>
                        setValue(`openingHours.${index}.dateTo`, event.target.value, { shouldDirty: true })
                      }
                    />
                  </StudioField>
                </StudioFieldGroup>
                <StudioFieldGroup columns={2}>
                  <StudioField id={`generic-item-opening-time-from-${index}`} label={labels.timeFrom}>
                    <Input
                      id={`generic-item-opening-time-from-${index}`}
                      type="time"
                      value={openingHour.timeFrom}
                      onChange={(event) =>
                        setValue(`openingHours.${index}.timeFrom`, event.target.value, { shouldDirty: true })
                      }
                    />
                  </StudioField>
                  <StudioField id={`generic-item-opening-time-to-${index}`} label={labels.timeTo}>
                    <Input
                      id={`generic-item-opening-time-to-${index}`}
                      type="time"
                      value={openingHour.timeTo}
                      onChange={(event) =>
                        setValue(`openingHours.${index}.timeTo`, event.target.value, { shouldDirty: true })
                      }
                    />
                  </StudioField>
                </StudioFieldGroup>
                <StudioFieldGroup columns={2}>
                  <StudioField id={`generic-item-opening-description-${index}`} label={labels.description}>
                    <Input
                      id={`generic-item-opening-description-${index}`}
                      value={openingHour.description}
                      onChange={(event) =>
                        setValue(`openingHours.${index}.description`, event.target.value, { shouldDirty: true })
                      }
                    />
                  </StudioField>
                  <StudioField id={`generic-item-opening-weekday-${index}`} label={labels.weekday}>
                    <Select
                      id={`generic-item-opening-weekday-${index}`}
                      value={openingHour.weekday}
                      onChange={(event) =>
                        setValue(`openingHours.${index}.weekday`, event.target.value, { shouldDirty: true })
                      }
                    >
                      <option value="">{labels.notAvailable}</option>
                      {GENERIC_ITEMS_OPENING_HOUR_WEEKDAYS.map((weekday) => (
                        <option key={weekday} value={weekday}>
                          {labels[`weekday${weekday}`]}
                        </option>
                      ))}
                    </Select>
                  </StudioField>
                </StudioFieldGroup>
                <div className="flex items-center">
                  <StudioField id={`generic-item-opening-open-${index}`} label={labels.open}>
                    <Checkbox
                      id={`generic-item-opening-open-${index}`}
                      checked={openingHour.open}
                      onChange={(event) =>
                        setValue(`openingHours.${index}.open`, event.currentTarget.checked, { shouldDirty: true })
                      }
                    />
                  </StudioField>
                </div>
              </div>
            </section>
          ))}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{labels.dates}</p>
              <p className="text-sm text-muted-foreground">{labels.datesHelp}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                datesArray.append({
                  weekday: '',
                  dateStart: '',
                  dateEnd: '',
                  timeStart: '',
                  timeEnd: '',
                  timeDescription: '',
                  useOnlyTimeDescription: false,
                })
              }
            >
              {labels.addDate}
            </Button>
          </div>
          {dates.map((date, index) => (
            <div
              key={datesArray.fields[index]?.id ?? `fallback-date-${index}`}
              className="space-y-4 rounded-xl border border-border/60 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{labels.dateItem}</p>
                {dates.length > 1 ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => datesArray.remove(index)}>
                    {labels.remove}
                  </Button>
                ) : null}
              </div>
              <StudioFieldGroup columns={2}>
                <StudioField id={`generic-item-date-start-${index}`} label={labels.dateStart}>
                  <Input
                    id={`generic-item-date-start-${index}`}
                    type="datetime-local"
                    value={date.dateStart}
                    onChange={(event) => setValue(`dates.${index}.dateStart`, event.target.value, { shouldDirty: true })}
                  />
                </StudioField>
                <StudioField id={`generic-item-date-end-${index}`} label={labels.dateEnd}>
                  <Input
                    id={`generic-item-date-end-${index}`}
                    type="datetime-local"
                    value={date.dateEnd}
                    onChange={(event) => setValue(`dates.${index}.dateEnd`, event.target.value, { shouldDirty: true })}
                  />
                </StudioField>
              </StudioFieldGroup>
              <StudioFieldGroup columns={2}>
                <StudioField id={`generic-item-time-start-${index}`} label={labels.timeStart}>
                  <Input
                    id={`generic-item-time-start-${index}`}
                    value={date.timeStart}
                    onChange={(event) => setValue(`dates.${index}.timeStart`, event.target.value, { shouldDirty: true })}
                  />
                </StudioField>
                <StudioField id={`generic-item-time-end-${index}`} label={labels.timeEnd}>
                  <Input
                    id={`generic-item-time-end-${index}`}
                    value={date.timeEnd}
                    onChange={(event) => setValue(`dates.${index}.timeEnd`, event.target.value, { shouldDirty: true })}
                  />
                </StudioField>
              </StudioFieldGroup>
              <StudioFieldGroup columns={2}>
                <StudioField id={`generic-item-weekday-${index}`} label={labels.weekday}>
                  <Input
                    id={`generic-item-weekday-${index}`}
                    value={date.weekday}
                    onChange={(event) => setValue(`dates.${index}.weekday`, event.target.value, { shouldDirty: true })}
                  />
                </StudioField>
                <StudioField id={`generic-item-time-description-${index}`} label={labels.timeDescription}>
                  <Input
                    id={`generic-item-time-description-${index}`}
                    value={date.timeDescription}
                    onChange={(event) =>
                      setValue(`dates.${index}.timeDescription`, event.target.value, { shouldDirty: true })
                    }
                  />
                </StudioField>
              </StudioFieldGroup>
              <StudioField id={`generic-item-use-only-time-description-${index}`} label={labels.useOnlyTimeDescription}>
                <Checkbox
                  id={`generic-item-use-only-time-description-${index}`}
                  checked={date.useOnlyTimeDescription}
                  onChange={(event) =>
                    setValue(`dates.${index}.useOnlyTimeDescription`, event.currentTarget.checked, { shouldDirty: true })
                  }
                />
              </StudioField>
            </div>
          ))}
        </div>
      </GenericItemsDetailCard>
    </div>
  );
};
