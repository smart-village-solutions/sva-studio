import { formatCalendarDate } from '@sva/plugin-sdk';
export const WasteSchedulingTableMeta = ({ children }: { readonly children: string }) => (
  <span className="text-xs leading-5 text-muted-foreground">{children}</span>
);

export const joinSchedulingMetaItems = (values: readonly string[]) =>
  values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(' · ');

export const formatSchedulingDisplayDate = (value: string) => formatCalendarDate(value) ?? value;
