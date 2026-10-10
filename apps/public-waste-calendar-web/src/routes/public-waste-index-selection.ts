import type { PublicWasteSelectionPathItem } from '../components/public-waste-selection-form.js';
import {
  requestPublicWasteCalendar,
  requestPublicWasteSelection,
} from '../lib/public-waste-api.js';
import type {
  PublicWasteCalendarResponse,
  PublicWasteSelectionResponse,
} from '../lib/public-waste-api.js';
import type {
  PublicWasteResolvedSelection,
  PublicWasteSelectionState,
} from '../lib/public-waste-contract.js';
import { BOUND_REGION_UNAVAILABLE_ERROR } from './public-waste-index-binding.js';

const REFERENCE_DATE = new Date().toISOString().slice(0, 10);

const selectionStepLabels: Record<PublicWasteSelectionResponse['step'], string> = {
  region: 'Region',
  city: 'Ort',
  street: 'Straße',
  houseNumber: 'Hausnummer',
};

const selectionStepKeys = {
  region: 'regionId',
  city: 'cityId',
  street: 'streetId',
  houseNumber: 'houseNumberId',
} as const;

type SelectionStepKey = (typeof selectionStepKeys)[keyof typeof selectionStepKeys];

const appendSelectionPathItem = (
  selectionPath: readonly PublicWasteSelectionPathItem[],
  response: Pick<PublicWasteSelectionResponse, 'step'>,
  option: { readonly label: string }
): readonly PublicWasteSelectionPathItem[] => [
  ...selectionPath,
  {
    step: selectionStepLabels[response.step],
    label: option.label,
  },
];

export const applySelectionStep = (
  selection: PublicWasteSelectionState,
  step: PublicWasteSelectionResponse['step'],
  optionId: string
): PublicWasteSelectionState => {
  if (step === 'region') {
    return { regionId: optionId };
  }
  if (step === 'city') {
    return { ...selection, cityId: optionId, streetId: undefined, houseNumberId: undefined };
  }
  if (step === 'street') {
    return { ...selection, streetId: optionId, houseNumberId: undefined };
  }
  return { ...selection, houseNumberId: optionId };
};

export type PageState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'incomplete';
      readonly selection: PublicWasteSelectionState;
      readonly selectionPath: readonly PublicWasteSelectionPathItem[];
      readonly step: PublicWasteSelectionResponse['step'];
      readonly nextStepLabel: string;
      readonly options: PublicWasteSelectionResponse['options'];
    }
  | ({
      readonly status: 'complete';
      readonly selection: PublicWasteResolvedSelection;
      readonly selectionPath: readonly PublicWasteSelectionPathItem[];
    } & PublicWasteCalendarResponse)
  | { readonly status: 'error'; readonly message: string };

export const resolveSelectionState = async (
  initialSelection: PublicWasteSelectionState,
  initialSelectionPath: readonly PublicWasteSelectionPathItem[],
  preferredSelection?: PublicWasteResolvedSelection,
  boundRegionId?: string,
  apiOrigin = ''
): Promise<
  | {
      readonly status: 'incomplete';
      readonly selection: PublicWasteSelectionState;
      readonly selectionPath: readonly PublicWasteSelectionPathItem[];
      readonly step: PublicWasteSelectionResponse['step'];
      readonly nextStepLabel: string;
      readonly options: PublicWasteSelectionResponse['options'];
    }
  | ({
      readonly status: 'complete';
      readonly selection: PublicWasteResolvedSelection;
      readonly selectionPath: readonly PublicWasteSelectionPathItem[];
    } & PublicWasteCalendarResponse)
> => {
  let selection = initialSelection;
  let selectionPath: readonly PublicWasteSelectionPathItem[] = initialSelectionPath;

  for (;;) {
    const response = await requestPublicWasteSelection(selection, apiOrigin);

    if (response.options.length === 0) {
      if (boundRegionId && response.step === 'city') {
        throw new Error(BOUND_REGION_UNAVAILABLE_ERROR);
      }
      if (!selection.cityId || !selection.streetId) {
        throw new Error('public_waste_selection_unresolved');
      }

      const resolvedSelection: PublicWasteResolvedSelection = {
        cityId: selection.cityId,
        streetId: selection.streetId,
        ...(selection.regionId ? { regionId: selection.regionId } : {}),
        ...(selection.houseNumberId ? { houseNumberId: selection.houseNumberId } : {}),
      };
      const calendar = await requestPublicWasteCalendar(
        {
          selection: resolvedSelection,
          referenceDate: REFERENCE_DATE,
        },
        apiOrigin
      );
      return {
        status: 'complete',
        selection: resolvedSelection,
        selectionPath,
        ...calendar,
      };
    }

    const preferredOptionId = preferredSelection?.[selectionStepKeys[response.step]];
    const selectedOption =
      response.options.find((option) => option.id === preferredOptionId) ??
      (response.options.length === 1 ? response.options[0] : undefined);

    if (selectedOption) {
      selection = applySelectionStep(selection, response.step, selectedOption.id);
      selectionPath = appendSelectionPathItem(selectionPath, response, selectedOption);
      continue;
    }

    return {
      status: 'incomplete',
      selection,
      selectionPath,
      step: response.step,
      nextStepLabel: selectionStepLabels[response.step],
      options: response.options,
    };
  }
};

export const trimSelectionToStep = (
  selection: PublicWasteSelectionState,
  stepIndex: number,
  boundRegionId?: string
): PublicWasteSelectionState => {
  const keysInOrder: readonly SelectionStepKey[] = boundRegionId
    ? ['cityId', 'streetId', 'houseNumberId']
    : ['regionId', 'cityId', 'streetId', 'houseNumberId'];
  const nextSelection: PublicWasteSelectionState = boundRegionId ? { regionId: boundRegionId } : {};

  for (let index = 0; index < stepIndex; index += 1) {
    const key = keysInOrder[index];
    const value = selection[key];
    if (value) {
      Object.assign(nextSelection, { [key]: value });
    }
  }

  return nextSelection;
};
