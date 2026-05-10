import { useNavigate, useSearch } from '@tanstack/react-router';
import { wasteManagementMasterDataContract } from '@sva/core';
import type {
  StudioJobResponse,
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteCustomTourDate,
  WasteDateShiftReasonType,
  WasteFractionRecord,
  WasteGlobalDateShiftRecord,
  WasteHouseNumberRecord,
  WasteLocalizedTextRecord,
  WasteLocationTourLinkRecord,
  WasteManagementSettingsRecord,
  WasteManagementImportProfileCatalogEntry,
  WasteManagementImportSourceFormat,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourDateShiftFollowUpMode,
  WasteTourDateShiftRecord,
  WasteTourRecord,
} from '@sva/core';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  StudioConfirmDialog,
  StudioErrorState,
  StudioField,
  StudioFieldGroup,
  StudioEmptyState,
  StudioJobSummaryCard,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioTechnicalStatusPanel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@sva/studio-ui-react';
import { startTransition, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import * as XLSX from 'xlsx';

import {
  normalizeWasteManagementSearchParams,
  wasteManagementTabIds,
  type WasteManagementSearchParams,
  type WasteManagementTabId,
} from './search-params.js';
import { WasteOverviewPanel } from './waste-management.overview-panel.js';
import { WasteMasterDataPanel } from './waste-management.master-data-panel.js';
import { WasteSchedulingPanel } from './waste-management.scheduling-panel.js';
import { WasteSettingsPanel } from './waste-management.settings-panel.js';
import { WasteToolsPanel } from './waste-management.tools-panel.js';
import { WasteToursPanel } from './waste-management.tours-panel.js';
import {
  createWasteManagementCity,
  createWasteManagementCollectionLocation,
  createWasteManagementHouseNumber,
  createWasteManagementLocationTourLinksBulk,
  createWasteManagementFraction,
  getWasteManagementHistoryOverview,
  createWasteManagementGlobalDateShift,
  createWasteManagementLocationTourLink,
  createWasteManagementRegion,
  createWasteManagementStreet,
  createWasteManagementTour,
  createWasteManagementTourDateShift,
  getWasteManagementImportCatalog,
  getWasteManagementMasterDataOverview,
  getWasteManagementSchedulingOverview,
  getWasteManagementSettings,
  startWasteManagementImport,
  startWasteManagementMigrations,
  startWasteManagementReset,
  startWasteManagementSeed,
  getWasteManagementToursOverview,
  updateWasteManagementFraction,
  updateWasteManagementCity,
  updateWasteManagementCollectionLocation,
  updateWasteManagementGlobalDateShift,
  updateWasteManagementHouseNumber,
  updateWasteManagementLocationTourLink,
  updateWasteManagementRegion,
  updateWasteManagementStreet,
  updateWasteManagementTour,
  updateWasteManagementTourDateShift,
  updateWasteManagementSettings,
  WasteManagementApiError,
  type CreateWasteManagementCityInput,
  type CreateWasteManagementCollectionLocationInput,
  type CreateWasteManagementLocationTourLinksBulkInput,
  type CreateWasteManagementFractionInput,
  type CreateWasteManagementGlobalDateShiftInput,
  type CreateWasteManagementHouseNumberInput,
  type CreateWasteManagementLocationTourLinkInput,
  type CreateWasteManagementRegionInput,
  type CreateWasteManagementStreetInput,
  type CreateWasteManagementTourInput,
  type CreateWasteManagementTourDateShiftInput,
  type WasteManagementMasterDataOverview,
  type WasteManagementHistoryOverview,
  type WasteManagementSchedulingOverview,
  type WasteManagementSettingsInput,
  type WasteManagementToursOverview,
  type StartWasteManagementImportInput,
  type UpdateWasteManagementFractionInput,
  type UpdateWasteManagementCityInput,
  type UpdateWasteManagementCollectionLocationInput,
  type UpdateWasteManagementGlobalDateShiftInput,
  type UpdateWasteManagementHouseNumberInput,
  type UpdateWasteManagementLocationTourLinkInput,
  type UpdateWasteManagementRegionInput,
  type UpdateWasteManagementStreetInput,
  type UpdateWasteManagementTourInput,
  type UpdateWasteManagementTourDateShiftInput,
} from './waste-management.api.js';
import {
  ResetConfirmationDialog,
  StatusNotice,
  resolveApiErrorCode,
  type StatusMessage,
  type TechnicalStatusTone,
} from './waste-management.page.support.js';

const tabTranslationKeyMap = {
  overview: 'overview',
  'master-data': 'masterData',
  tours: 'tours',
  scheduling: 'scheduling',
  tools: 'tools',
  settings: 'settings',
} as const satisfies Record<WasteManagementTabId, string>;

const updateSearch = (
  navigate: ReturnType<typeof useNavigate>,
  currentSearch: WasteManagementSearchParams,
  patch: Partial<WasteManagementSearchParams>
) => {
  const nextSearch = {
    ...currentSearch,
    ...patch,
    page: patch.page ?? (patch.q !== undefined || patch.tab !== undefined ? 1 : currentSearch.page),
  };

  void navigate({
    to: '/plugins/waste-management',
    search: nextSearch,
  });
};

type TourDateShiftFormState = {
  readonly id: string;
  readonly tourId: string;
  readonly originalDate: string;
  readonly actualDate: string;
  readonly hasYear: boolean;
  readonly reasonType: WasteDateShiftReasonType | '';
  readonly reasonKey: string;
  readonly followUpMode: WasteTourDateShiftFollowUpMode | '';
  readonly description: string;
};

type GlobalDateShiftFormState = {
  readonly id: string;
  readonly originalDate: string;
  readonly actualDate: string;
  readonly hasYear: boolean;
  readonly reasonType: WasteDateShiftReasonType | '';
  readonly reasonKey: string;
  readonly description: string;
  readonly tourIds: readonly string[];
};

type SettingsFormState = {
  readonly provider: 'supabase';
  readonly projectUrl: string;
  readonly schemaName: string;
  readonly enabled: boolean;
  readonly databaseUrl: string;
  readonly serviceRoleKey: string;
};

const createDefaultSettingsForm = (): SettingsFormState => ({
  provider: 'supabase',
  projectUrl: '',
  schemaName: 'public',
  enabled: true,
  databaseUrl: '',
  serviceRoleKey: '',
});

const createFractionId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `fraction-${Math.random().toString(36).slice(2, 10)}`;

const createDefaultTourDateShiftForm = (): TourDateShiftFormState => ({
  id: createFractionId(),
  tourId: '',
  originalDate: '',
  actualDate: '',
  hasYear: true,
  reasonType: '',
  reasonKey: '',
  followUpMode: '',
  description: '',
});

const createDefaultGlobalDateShiftForm = (): GlobalDateShiftFormState => ({
  id: createFractionId(),
  originalDate: '',
  actualDate: '',
  hasYear: true,
  reasonType: '',
  reasonKey: '',
  description: '',
  tourIds: [],
});

const mapTourDateShiftToForm = (shift: WasteTourDateShiftRecord): TourDateShiftFormState => ({
  id: shift.id,
  tourId: shift.tourId,
  originalDate: shift.originalDate,
  actualDate: shift.actualDate,
  hasYear: shift.hasYear,
  reasonType: shift.reasonType ?? '',
  reasonKey: shift.reasonKey ?? '',
  followUpMode: shift.followUpMode ?? '',
  description: shift.description ?? '',
});

const mapGlobalDateShiftToForm = (shift: WasteGlobalDateShiftRecord): GlobalDateShiftFormState => ({
  id: shift.id,
  originalDate: shift.originalDate,
  actualDate: shift.actualDate,
  hasYear: shift.hasYear,
  reasonType: shift.reasonType ?? '',
  reasonKey: shift.reasonKey ?? '',
  description: shift.description ?? '',
  tourIds: shift.tourIds ?? [],
});

const mapSettingsToForm = (settings: WasteManagementSettingsRecord | null): SettingsFormState =>
  settings
    ? {
        provider: settings.provider,
        projectUrl: settings.projectUrl,
        schemaName: settings.schemaName,
        enabled: settings.enabled,
        databaseUrl: '',
        serviceRoleKey: '',
      }
    : createDefaultSettingsForm();

const compactOptionalString = (value: string): string | undefined => {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const wasteReasonTypeOptions = wasteManagementMasterDataContract.dateShiftReasonTypes;
const wasteFollowUpModeOptions = wasteManagementMasterDataContract.followUpModes;

const toSettingsInput = (form: SettingsFormState): WasteManagementSettingsInput => ({
  provider: form.provider,
  projectUrl: form.projectUrl.trim(),
  schemaName: compactOptionalString(form.schemaName),
  enabled: form.enabled,
  databaseUrl: compactOptionalString(form.databaseUrl),
  serviceRoleKey: compactOptionalString(form.serviceRoleKey),
});

const toCreateTourDateShiftInput = (form: TourDateShiftFormState): CreateWasteManagementTourDateShiftInput => ({
  id: form.id,
  tourId: form.tourId,
  originalDate: form.originalDate,
  actualDate: form.actualDate,
  hasYear: form.hasYear,
  reasonType: form.reasonType || undefined,
  reasonKey: compactOptionalString(form.reasonKey),
  followUpMode: form.followUpMode || undefined,
  description: compactOptionalString(form.description),
});

const toUpdateTourDateShiftInput = (form: TourDateShiftFormState): UpdateWasteManagementTourDateShiftInput => ({
  tourId: form.tourId,
  originalDate: form.originalDate,
  actualDate: form.actualDate,
  hasYear: form.hasYear,
  reasonType: form.reasonType || undefined,
  reasonKey: compactOptionalString(form.reasonKey),
  followUpMode: form.followUpMode || undefined,
  description: compactOptionalString(form.description),
});

const toCreateGlobalDateShiftInput = (form: GlobalDateShiftFormState): CreateWasteManagementGlobalDateShiftInput => ({
  id: form.id,
  originalDate: form.originalDate,
  actualDate: form.actualDate,
  hasYear: form.hasYear,
  reasonType: form.reasonType || undefined,
  reasonKey: compactOptionalString(form.reasonKey),
  description: compactOptionalString(form.description),
  tourIds: form.tourIds.length ? form.tourIds : undefined,
});

const toUpdateGlobalDateShiftInput = (form: GlobalDateShiftFormState): UpdateWasteManagementGlobalDateShiftInput => ({
  originalDate: form.originalDate,
  actualDate: form.actualDate,
  hasYear: form.hasYear,
  reasonType: form.reasonType || undefined,
  reasonKey: compactOptionalString(form.reasonKey),
  description: compactOptionalString(form.description),
  tourIds: form.tourIds.length ? form.tourIds : undefined,
});

export const WasteManagementPage = () => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const rawSearch = useSearch({ strict: false });
  const search = normalizeWasteManagementSearchParams(rawSearch as Record<string, unknown>);
  const activeTabKey = tabTranslationKeyMap[search.tab];

  return (
    <StudioOverviewPageTemplate
      title={pt('page.title')}
      description={pt('page.description')}
      primaryAction={
        <Button type="button" variant="outline" onClick={() => updateSearch(navigate, search, { tab: 'settings' })}>
          {pt('actions.openSettings')}
        </Button>
      }
      toolbar={
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            aria-label={pt('filters.searchLabel')}
            value={search.q}
            onChange={(event) => updateSearch(navigate, search, { q: event.target.value })}
            placeholder={pt('filters.searchPlaceholder')}
          />
          <Select
            aria-label={pt('filters.statusLabel')}
            value={search.status}
            onChange={(event) =>
              updateSearch(navigate, search, {
                status: event.target.value as WasteManagementSearchParams['status'],
              })
            }
          >
            <option value="all">{pt('filters.status.all')}</option>
            <option value="active">{pt('filters.status.active')}</option>
            <option value="inactive">{pt('filters.status.inactive')}</option>
          </Select>
          <Select
            aria-label={pt('filters.shiftContextLabel')}
            value={search.shiftContext}
            onChange={(event) =>
              updateSearch(navigate, search, {
                shiftContext: event.target.value as WasteManagementSearchParams['shiftContext'],
              })
            }
          >
            <option value="all">{pt('filters.shiftContext.all')}</option>
            <option value="global">{pt('filters.shiftContext.global')}</option>
            <option value="tour">{pt('filters.shiftContext.tour')}</option>
          </Select>
        </div>
      }
    >
      <div className="space-y-4">
        <Alert>
          <AlertTitle>{pt(`tabs.${activeTabKey}.title`)}</AlertTitle>
          <AlertDescription>{pt(`tabs.${activeTabKey}.body`)}</AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-2">
          <Badge>{pt(`tabs.${activeTabKey}.title`)}</Badge>
          <Badge variant="outline">{pt('meta.page', { page: search.page })}</Badge>
          <Badge variant="outline">{pt('meta.pageSize', { pageSize: search.pageSize })}</Badge>
          {search.q ? <Badge variant="secondary">{pt('meta.search', { value: search.q })}</Badge> : null}
        </div>

        <Tabs
          value={search.tab}
          onValueChange={(value) => updateSearch(navigate, search, { tab: value as WasteManagementTabId })}
          className="space-y-4"
        >
          <TabsList aria-label={pt('tabs.ariaLabel')}>
            {wasteManagementTabIds.map((tabId) => {
              const tabKey = tabTranslationKeyMap[tabId];
              return (
                <TabsTrigger key={tabId} value={tabId}>
                  {pt(`tabs.${tabKey}.title`)}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {wasteManagementTabIds.map((tabId) => {
            const tabKey = tabTranslationKeyMap[tabId];
            return (
              <TabsContent key={tabId} value={tabId}>
                {tabId === 'overview' ? (
                  <WasteOverviewPanel search={search} />
                ) : tabId === 'master-data' ? (
                  <WasteMasterDataPanel search={search} />
                ) : tabId === 'tours' ? (
                  <WasteToursPanel search={search} />
                ) : tabId === 'scheduling' ? (
                  <WasteSchedulingPanel search={search} />
                ) : tabId === 'settings' ? (
                  <WasteSettingsPanel />
                ) : tabId === 'tools' ? (
                  <WasteToolsPanel />
                ) : (
                  <StudioEmptyState>
                    <div className="space-y-2 text-left">
                      <p className="font-medium">{pt(`tabs.${tabKey}.emptyTitle`)}</p>
                      <p>{pt(`tabs.${tabKey}.emptyBody`)}</p>
                    </div>
                  </StudioEmptyState>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </StudioOverviewPageTemplate>
  );
};
