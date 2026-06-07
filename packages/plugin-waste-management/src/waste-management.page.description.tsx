type WasteManagementPageDescriptionProps = {
  readonly description: string;
  readonly calendarWebUrl: string | null;
  readonly webVersionLead: string;
  readonly webVersionLinkLabel: string;
};

export const WasteManagementPageDescription = ({
  description,
  calendarWebUrl,
  webVersionLead,
  webVersionLinkLabel,
}: Readonly<WasteManagementPageDescriptionProps>) => (
  <>
    {description}
    {calendarWebUrl ? (
      <>
        {' '}
        {webVersionLead}{' '}
        <a
          href={calendarWebUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2"
        >
          {webVersionLinkLabel}
        </a>
      </>
    ) : null}
  </>
);
