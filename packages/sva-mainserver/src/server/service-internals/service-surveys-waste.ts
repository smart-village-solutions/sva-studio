import type {
  SvaMainserverConnectionInput,
  SvaMainserverSurveyInput,
  SvaMainserverSurveyListInput,
} from '../../types.js';
import { type SvaMainserverWasteSyncItem } from './waste-operations.js';
import type { ServiceContext } from './service-context.js';

export const createSurveyWasteService = ({
  loadValidatedInstanceConfig,
  loadListCredentialMetadata,
  surveyOperations,
  wasteOperations,
}: ServiceContext) => {
  const listSurveys = async (
    input: SvaMainserverConnectionInput & SvaMainserverSurveyListInput
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    const credentialMetadata = await loadListCredentialMetadata(input);
    return {
      ...(await surveyOperations.listSurveysWithConfig(input, config)),
      ...credentialMetadata,
    };
  };

  const getSurvey = async (input: SvaMainserverConnectionInput & { readonly surveyId: string }) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return surveyOperations.getSurveyWithConfig(input, config);
  };

  const getSurveyResults = async (
    input: SvaMainserverConnectionInput & { readonly surveyId: string }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return surveyOperations.getSurveyResultsWithConfig(input, config);
  };

  const createSurvey = async (
    input: SvaMainserverConnectionInput & { readonly survey: SvaMainserverSurveyInput }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return surveyOperations.writeSurveyWithConfig(input, config);
  };

  const updateSurvey = async (
    input: SvaMainserverConnectionInput & {
      readonly surveyId: string;
      readonly survey: SvaMainserverSurveyInput;
    }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return surveyOperations.writeSurveyWithConfig(input, config);
  };

  const deleteSurvey = async (
    input: SvaMainserverConnectionInput & { readonly surveyId: string }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return surveyOperations.writeSurveyWithConfig(
      {
        ...input,
        surveyId: input.surveyId,
        delete: true,
        survey: {},
      },
      config
    );
  };

  const releaseSurveyFreeTextResponse = async (
    input: SvaMainserverConnectionInput & {
      readonly surveyId: string;
      readonly freeTextResponseId: string;
    }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return surveyOperations.releaseSurveyFreeTextResponseWithConfig(input, config);
  };

  const listWasteSyncSnapshot = async (input: SvaMainserverConnectionInput) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return await wasteOperations.listWasteSyncSnapshotWithConfig(input, config);
  };

  const createWastePickupTimes = async (
    input: SvaMainserverConnectionInput & { readonly items: readonly SvaMainserverWasteSyncItem[] }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    await wasteOperations.createWastePickupTimesWithConfig(input, config);
  };

  const deleteWastePickupTimes = async (
    input: SvaMainserverConnectionInput & { readonly items: readonly SvaMainserverWasteSyncItem[] }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    await wasteOperations.deleteWastePickupTimesWithConfig(input, config);
  };

  return {
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
  };
};
