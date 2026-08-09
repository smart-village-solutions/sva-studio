export const WasteSchedulingTableMeta = ({ children }: { readonly children: string }) => (
  <span className="text-xs leading-5 text-muted-foreground">{children}</span>
);

export const joinSchedulingMetaItems = (values: readonly string[]) =>
  values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(' · ');

export const formatSchedulingDisplayDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        timeZone: 'UTC',
      }).format(parsed);
};
