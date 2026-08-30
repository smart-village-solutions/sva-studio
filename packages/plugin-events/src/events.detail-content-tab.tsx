import {
  EventsDateSection,
  useEventsMapCapabilities,
} from './events.detail-content-primary-sections.js';
import {
  EventsDescriptionSection,
  EventsMediaSection,
} from './events.detail-content-secondary-sections.js';
import {
  EventsAddressSection,
  EventsOrganizerSection,
} from './events.detail-content-location-sections.js';
import {
  EventsContactSection,
  EventsLinkSection,
  EventsPriceSection,
} from './events.detail-content-repeater-sections.js';

type ContentTabProps = React.ComponentProps<typeof EventsMediaSection> &
  React.ComponentProps<typeof EventsDateSection>;

export function EventsDetailContentTab(props: ContentTabProps) {
  const mapCapabilities = useEventsMapCapabilities();

  return (
    <div className="space-y-6">
      <EventsDescriptionSection pt={props.pt} />
      <EventsMediaSection {...props} />
      <EventsDateSection {...props} />
      <EventsAddressSection capabilities={mapCapabilities} pt={props.pt} />
      <EventsOrganizerSection capabilities={mapCapabilities} pt={props.pt} />
      <EventsContactSection pt={props.pt} />
      <EventsLinkSection pt={props.pt} />
      <EventsPriceSection pt={props.pt} />
    </div>
  );
}
