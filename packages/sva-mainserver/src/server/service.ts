import type { SvaMainserverWasteSyncItem } from './service-internals/waste-operations.js';
import type {
  SvaMainserverConnectionInput,
  SvaMainserverEventInput,
  SvaMainserverGenericItemInput,
  SvaMainserverGenericTypeOwnership,
  SvaMainserverListQuery,
  SvaMainserverNewsListInput,
  SvaMainserverNewsInput,
  SvaMainserverOwnershipTransferInput,
  SvaMainserverPoiInput,
  SvaMainserverProjectionContentType,
  SvaMainserverStaticContentInput,
  SvaMainserverSurveyInput,
  SvaMainserverSurveyListInput,
  SvaMainserverSaveCategoryInput,
} from '../types.js';
import { createSvaMainserverService } from './service-internals/service-factory.js';
export { createSvaMainserverService } from './service-internals/service-factory.js';
export type { SvaMainserverServiceOptions } from './service-internals/service-factory.js';

let defaultService: ReturnType<typeof createSvaMainserverService> | null = null;

const getDefaultService = () => {
  defaultService ??= createSvaMainserverService();
  return defaultService;
};

export const resetSvaMainserverServiceState = (): void => {
  defaultService = null;
};

export const getSvaMainserverConnectionStatus = (input: SvaMainserverConnectionInput) =>
  getDefaultService().getConnectionStatus(input);

export const getSvaMainserverQueryRootTypename = (input: SvaMainserverConnectionInput) =>
  getDefaultService().getQueryRootTypename(input);

export const getSvaMainserverMutationRootTypename = (input: SvaMainserverConnectionInput) =>
  getDefaultService().getMutationRootTypename(input);

export const listSvaMainserverCategories = (input: SvaMainserverConnectionInput) =>
  getDefaultService().listCategories(input);

export const listSvaMainserverCategoryManagement = (input: SvaMainserverConnectionInput) =>
  getDefaultService().listCategoryManagement(input);

export const saveSvaMainserverCategory = (
  input: SvaMainserverConnectionInput & { readonly category: SvaMainserverSaveCategoryInput }
) => getDefaultService().saveCategory(input);

export const deleteSvaMainserverCategory = (
  input: SvaMainserverConnectionInput & { readonly categoryId: string }
) => getDefaultService().deleteCategory(input);

export const loadSvaMainserverDataProviderIdentity = (input: SvaMainserverConnectionInput) =>
  getDefaultService().loadDataProviderIdentity(input);

export const listSvaMainserverNews = (
  input: SvaMainserverConnectionInput & SvaMainserverNewsListInput
) => getDefaultService().listNews(input);

export const listSvaMainserverProjection = (
  input: SvaMainserverConnectionInput &
    SvaMainserverListQuery & {
      readonly contentType: SvaMainserverProjectionContentType;
      readonly genericTypeOwnership: SvaMainserverGenericTypeOwnership;
    }
) => getDefaultService().listProjection(input);

export const getSvaMainserverNews = (
  input: SvaMainserverConnectionInput & { readonly newsId: string }
) => getDefaultService().getNews(input);

export const createSvaMainserverNews = (
  input: SvaMainserverConnectionInput & { readonly news: SvaMainserverNewsInput }
) => getDefaultService().createNews(input);

export const updateSvaMainserverNews = (
  input: SvaMainserverConnectionInput & {
    readonly newsId: string;
    readonly news: SvaMainserverNewsInput;
  }
) => getDefaultService().updateNews(input);

export const changeSvaMainserverNewsVisibility = (
  input: SvaMainserverConnectionInput & { readonly newsId: string; readonly visible: boolean }
) => getDefaultService().changeNewsVisibility(input);

export const deleteSvaMainserverNews = (
  input: SvaMainserverConnectionInput & { readonly newsId: string }
) => getDefaultService().deleteNews(input);

export const listSvaMainserverEvents = (
  input: SvaMainserverConnectionInput & SvaMainserverListQuery
) => getDefaultService().listEvents(input);

export const getSvaMainserverEvent = (
  input: SvaMainserverConnectionInput & { readonly eventId: string }
) => getDefaultService().getEvent(input);

export const getSvaMainserverEventDetail = (
  input: SvaMainserverConnectionInput & { readonly eventId: string }
) => getDefaultService().getEventDetail(input);

export const createSvaMainserverEvent = (
  input: SvaMainserverConnectionInput & { readonly event: SvaMainserverEventInput }
) => getDefaultService().createEvent(input);

export const updateSvaMainserverEvent = (
  input: SvaMainserverConnectionInput & {
    readonly eventId: string;
    readonly event: SvaMainserverEventInput;
  }
) => getDefaultService().updateEvent(input);

export const changeSvaMainserverEventVisibility = (
  input: SvaMainserverConnectionInput & { readonly eventId: string; readonly visible: boolean }
) => getDefaultService().changeEventVisibility(input);

export const deleteSvaMainserverEvent = (
  input: SvaMainserverConnectionInput & { readonly eventId: string }
) => getDefaultService().deleteEvent(input);

export const listSvaMainserverPoi = (
  input: SvaMainserverConnectionInput & SvaMainserverListQuery
) => getDefaultService().listPoi(input);

export const listSvaMainserverGenericItems = (
  input: SvaMainserverConnectionInput & SvaMainserverListQuery
) => getDefaultService().listGenericItems(input);

export const getSvaMainserverGenericItem = (
  input: SvaMainserverConnectionInput & { readonly genericItemId: string }
) => getDefaultService().getGenericItem(input);

export const changeSvaMainserverGenericItemVisibility = (
  input: SvaMainserverConnectionInput & {
    readonly genericItemId: string;
    readonly visible: boolean;
  }
) => getDefaultService().changeGenericItemVisibility(input);

export const createSvaMainserverGenericItem = (
  input: SvaMainserverConnectionInput & { readonly genericItem: SvaMainserverGenericItemInput }
) => getDefaultService().createGenericItem(input);

export const updateSvaMainserverGenericItem = (
  input: SvaMainserverConnectionInput & {
    readonly genericItemId: string;
    readonly genericItem: SvaMainserverGenericItemInput;
  }
) => getDefaultService().updateGenericItem(input);

export const deleteSvaMainserverGenericItem = (
  input: SvaMainserverConnectionInput & { readonly genericItemId: string }
) => getDefaultService().deleteGenericItem(input);

export const getSvaMainserverPoi = (
  input: SvaMainserverConnectionInput & { readonly poiId: string }
) => getDefaultService().getPoi(input);

export const getSvaMainserverPoiDetail = (
  input: SvaMainserverConnectionInput & { readonly poiId: string }
) => getDefaultService().getPoiDetail(input);

export const createSvaMainserverPoi = (
  input: SvaMainserverConnectionInput & { readonly poi: SvaMainserverPoiInput }
) => getDefaultService().createPoi(input);

export const updateSvaMainserverPoi = (
  input: SvaMainserverConnectionInput & {
    readonly poiId: string;
    readonly poi: SvaMainserverPoiInput;
  }
) => getDefaultService().updatePoi(input);

export const deleteSvaMainserverPoi = (
  input: SvaMainserverConnectionInput & { readonly poiId: string }
) => getDefaultService().deletePoi(input);

export const transferSvaMainserverContentOwnership = (input: SvaMainserverOwnershipTransferInput) =>
  getDefaultService().transferContentOwnership(input);

export const listSvaMainserverSurveys = (
  input: SvaMainserverConnectionInput & SvaMainserverSurveyListInput
) => getDefaultService().listSurveys(input);

export const getSvaMainserverSurvey = (
  input: SvaMainserverConnectionInput & { readonly surveyId: string }
) => getDefaultService().getSurvey(input);

export const getSvaMainserverSurveyResults = (
  input: SvaMainserverConnectionInput & { readonly surveyId: string }
) => getDefaultService().getSurveyResults(input);

export const createSvaMainserverSurvey = (
  input: SvaMainserverConnectionInput & { readonly survey: SvaMainserverSurveyInput }
) => getDefaultService().createSurvey(input);

export const updateSvaMainserverSurvey = (
  input: SvaMainserverConnectionInput & {
    readonly surveyId: string;
    readonly survey: SvaMainserverSurveyInput;
  }
) => getDefaultService().updateSurvey(input);

export const deleteSvaMainserverSurvey = (
  input: SvaMainserverConnectionInput & { readonly surveyId: string }
) => getDefaultService().deleteSurvey(input);

export const releaseSvaMainserverSurveyFreeTextResponse = (
  input: SvaMainserverConnectionInput & {
    readonly surveyId: string;
    readonly freeTextResponseId: string;
  }
) => getDefaultService().releaseSurveyFreeTextResponse(input);

export const createOrUpdateSvaMainserverStaticContent = (
  input: SvaMainserverConnectionInput & { readonly staticContent: SvaMainserverStaticContentInput }
) => getDefaultService().createOrUpdateStaticContent(input);

export const listSvaMainserverWasteSyncSnapshot = (input: SvaMainserverConnectionInput) =>
  getDefaultService().listWasteSyncSnapshot(input);

export const createSvaMainserverWastePickupTimes = (
  input: SvaMainserverConnectionInput & { readonly items: readonly SvaMainserverWasteSyncItem[] }
) => getDefaultService().createWastePickupTimes(input);

export const deleteSvaMainserverWastePickupTimes = (
  input: SvaMainserverConnectionInput & { readonly items: readonly SvaMainserverWasteSyncItem[] }
) => getDefaultService().deleteWastePickupTimes(input);
