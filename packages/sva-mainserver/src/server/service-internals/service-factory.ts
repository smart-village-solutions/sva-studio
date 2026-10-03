import { createServiceContext } from './service-context.js';
import { createCategoryService } from './service-categories.js';
import { createCategoryMutationService } from './service-category-mutations.js';
import { createCategorySaveService } from './service-category-save.js';
import { createNewsService } from './service-news.js';
import { createEventService } from './service-events.js';
import { createItemService } from './service-items.js';
import { createPoiService } from './service-poi.js';
import { createSurveyWasteService } from './service-surveys-waste.js';
import type { SvaMainserverServiceOptions } from './service-context.js';
export type { SvaMainserverServiceOptions } from './service-context.js';

export const createSvaMainserverService = (options: SvaMainserverServiceOptions = {}) => {
  const context = createServiceContext(options);
  const { listCategories, listCategoryManagement } = createCategoryService(context);
  const { saveCategory } = createCategorySaveService(context);
  const { deleteCategory } = createCategoryMutationService(context);
  const {
    listNews,
    listProjection,
    getNews,
    createNews,
    updateNews,
    deleteNews,
    changeNewsVisibility,
  } = createNewsService(context);
  const {
    listEvents,
    getEvent,
    getEventDetail,
    createEvent,
    updateEvent,
    changeEventVisibility,
    deleteEvent,
  } = createEventService(context);
  const {
    listPoi,
    listGenericItems,
    changeGenericItemVisibility,
    getGenericItem,
    createGenericItem,
    updateGenericItem,
    deleteGenericItem,
  } = createItemService(context);
  const {
    getPoi,
    getPoiDetail,
    createPoi,
    updatePoi,
    deletePoi,
    transferContentOwnership,
    createOrUpdateStaticContent,
  } = createPoiService(context);
  const {
    listSurveys,
    getSurvey,
    getSurveyResults,
    createSurvey,
    updateSurvey,
    deleteSurvey,
    releaseSurveyFreeTextResponse,
    listWasteSyncSnapshot,
    createWastePickupTimes,
    deleteWastePickupTimes,
  } = createSurveyWasteService(context);
  const {
    getConnectionStatus,
    getQueryRootTypename,
    getMutationRootTypename,
    loadDataProviderIdentity,
  } = context;

  return {
    createOrUpdateStaticContent,
    createEvent,
    createGenericItem,
    createNews,
    createPoi,
    createSurvey,
    changeNewsVisibility,
    changeEventVisibility,
    changeGenericItemVisibility,
    deleteEvent,
    deleteGenericItem,
    deleteNews,
    deletePoi,
    deleteSurvey,
    getConnectionStatus,
    getEvent,
    getEventDetail,
    getGenericItem,
    getMutationRootTypename,
    getNews,
    getPoi,
    getPoiDetail,
    getQueryRootTypename,
    getSurvey,
    getSurveyResults,
    listCategories,
    listCategoryManagement,
    saveCategory,
    deleteCategory,
    loadDataProviderIdentity,
    listEvents,
    listGenericItems,
    listNews,
    listPoi,
    listProjection,
    listSurveys,
    listWasteSyncSnapshot,
    releaseSurveyFreeTextResponse,
    createWastePickupTimes,
    deleteWastePickupTimes,
    updateEvent,
    updateGenericItem,
    updateNews,
    updatePoi,
    updateSurvey,
    transferContentOwnership,
  };
};
