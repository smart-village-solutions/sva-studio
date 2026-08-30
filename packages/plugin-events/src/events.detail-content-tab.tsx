import {
  EventsAddressSection,
  EventsDateSection,
  EventsOrganizerSection,
  useEventsMapCapabilities,
} from './events.detail-content-primary-sections.js';
import {
  EventsContactLinkSections,
  EventsDescriptionMediaSections,
  EventsPriceSection,
} from './events.detail-content-secondary-sections.js';

type ContentTabProps = React.ComponentProps<typeof EventsDescriptionMediaSections> &
  React.ComponentProps<typeof EventsDateSection>;

export function EventsDetailContentTab(props: ContentTabProps) {
  const mapCapabilities = useEventsMapCapabilities();

  return (
    <div className="space-y-6">
      <EventsDescriptionMediaSections {...props} />
      <EventsDateSection {...props} />
      <EventsAddressSection capabilities={mapCapabilities} pt={props.pt} />
      <EventsOrganizerSection capabilities={mapCapabilities} pt={props.pt} />
      <EventsContactLinkSections pt={props.pt} />
      <EventsPriceSection pt={props.pt} />
    </div>
  );
}
