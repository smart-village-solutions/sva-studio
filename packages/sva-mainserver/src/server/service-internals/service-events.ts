import type { SvaMainserverConnectionInput, SvaMainserverEventInput } from '../../types.js';
import { mergeEventUpdateWithCurrent } from './editor-field-matrices.js';
import { withUpdatedPayload, type SvaMainserverListInput } from './shared.js';
import type { ServiceContext } from './service-context.js';

export const createEventService = ({
  loadValidatedInstanceConfig,
  loadListCredentialMetadata,
  eventOperations,
  eventVisibilityOperations,
}: ServiceContext) => {
  const listEvents = async (input: SvaMainserverListInput) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    const credentialMetadata = await loadListCredentialMetadata(input);
    return {
      ...(await eventOperations.listEventsWithConfig(input, config)),
      ...credentialMetadata,
    };
  };

  const getEvent = async (input: SvaMainserverConnectionInput & { readonly eventId: string }) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return eventOperations.getEventWithConfig(input, config);
  };

  const getEventDetail = async (
    input: SvaMainserverConnectionInput & { readonly eventId: string }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return eventOperations.getEventDetailWithConfig(input, config);
  };

  const createEvent = async (
    input: SvaMainserverConnectionInput & { readonly event: SvaMainserverEventInput }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return eventOperations.writeEventWithConfig(input, config);
  };

  const updateEvent = async (
    input: SvaMainserverConnectionInput & {
      readonly eventId: string;
      readonly event: SvaMainserverEventInput;
    }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    const current = await eventOperations.getEventDetailWithConfig(input, config);
    return eventOperations.writeEventWithConfig(
      {
        ...input,
        event: {
          ...mergeEventUpdateWithCurrent(current.data, input.event, current.deviations),
          payload: withUpdatedPayload(input.event.payload, current.data.payload),
        },
        forceCreate: true,
      },
      config
    );
  };

  const changeEventVisibility = async (
    input: SvaMainserverConnectionInput & { readonly eventId: string; readonly visible: boolean }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    await eventVisibilityOperations.changeEventVisibilityWithConfig(input, config);
  };

  const deleteEvent = async (
    input: SvaMainserverConnectionInput & {
      readonly eventId: string;
      readonly detachLinkedContent?: boolean;
    }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return eventOperations.destroyEventWithConfig(input, config);
  };

  return {
    listEvents,
    getEvent,
    getEventDetail,
    createEvent,
    updateEvent,
    changeEventVisibility,
    deleteEvent,
  };
};
