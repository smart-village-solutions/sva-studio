import {
  EventsDateSection,
  useEventsMapCapabilities,
} from './events.detail-content-primary-sections.js';
import {
  EventsDescriptionSection,
  EventsMediaSection,
} from './events.detail-content-secondary-sections.js';
import { EventsAddressSection } from './events.detail-content-location-sections.js';
import { EventsOrganizerSection } from './events.detail-content-organizer-section.js';
import { EventsParticipationSection } from './events.detail-content-participation-section.js';
import {
  EventsContactSection,
  EventsLinkSection,
  EventsPriceSection,
} from './events.detail-content-repeater-sections.js';

type ContentTabProps = React.ComponentProps<typeof EventsMediaSection> &
  React.ComponentProps<typeof EventsDateSection> &
  Readonly<{
    /** ID of the loaded event; a change remounts sections whose UI state derives from loaded data. */
    loadedEventId?: string;
  }>;

export function EventsDetailContentTab({ loadedEventId, ...props }: ContentTabProps) {
  const mapCapabilities = useEventsMapCapabilities();

  return (
    <div className="space-y-6">
      <EventsDescriptionSection pt={props.pt} />
      <EventsMediaSection {...props} />
      <EventsDateSection {...props} />
      <EventsAddressSection capabilities={mapCapabilities} pt={props.pt} />
      <EventsOrganizerSection
        key={loadedEventId}
        capabilities={mapCapabilities}
        pt={props.pt}
      />
      <EventsContactSection pt={props.pt} />
      <EventsLinkSection pt={props.pt} />
      <EventsPriceSection pt={props.pt} />
      <EventsParticipationSection pt={props.pt} />
    </div>
  );
}
