import React from 'react';

import type { PublicWasteCalendarEntry } from '../lib/public-waste-contract.js';
import type { FilteredPublicWasteCalendarViewModel } from '../lib/public-waste-view-model.js';

const monthYearFormatter = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat('de-DE', { month: 'long' });
const weekdayFormatter = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const yearFormatter = new Intl.DateTimeFormat('de-DE', { year: 'numeric' });
const dayFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit' });
const fullDateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

const toDate = (value: string): Date => new Date(`${value}T00:00:00`);

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);
const toDateKey = (value: Date): string =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

const toMonthKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const startOfMonth = (value: Date): Date => new Date(value.getFullYear(), value.getMonth(), 1);
const startOfYear = (value: Date): Date => new Date(value.getFullYear(), 0, 1);

const addMonths = (value: Date, amount: number): Date => new Date(value.getFullYear(), value.getMonth() + amount, 1);

const addYears = (value: Date, amount: number): Date => new Date(value.getFullYear() + amount, value.getMonth(), 1);

const isSameMonth = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();

const getWeekdayOffset = (value: Date): number => (value.getDay() + 6) % 7;

const parseHexColorChannel = (value: string, startIndex: number): number => Number.parseInt(value.slice(startIndex, startIndex + 2), 16);

const deriveReadableTextColor = (backgroundColor?: string): string | undefined => {
  if (!backgroundColor || !/^#[0-9a-f]{6}$/i.test(backgroundColor)) {
    return undefined;
  }

  const red = parseHexColorChannel(backgroundColor, 1);
  const green = parseHexColorChannel(backgroundColor, 3);
  const blue = parseHexColorChannel(backgroundColor, 5);
  const luminance = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;

  return luminance > 0.62 ? 'rgb(24 24 24)' : 'rgb(255 255 255)';
};

const groupEntriesByMonth = (entries: readonly PublicWasteCalendarEntry[]) =>
  Array.from(
    entries.reduce<Map<string, PublicWasteCalendarEntry[]>>((groups, entry) => {
      const monthKey = entry.date.slice(0, 7);
      const bucket = groups.get(monthKey);
      if (bucket) {
        bucket.push(entry);
      } else {
        groups.set(monthKey, [entry]);
      }
      return groups;
    }, new Map()).entries()
  );

const groupEntriesByDay = (entries: readonly PublicWasteCalendarEntry[]) =>
  Array.from(
    entries.reduce<Map<string, PublicWasteCalendarEntry[]>>((groups, entry) => {
      const bucket = groups.get(entry.date);
      if (bucket) {
        bucket.push(entry);
      } else {
        groups.set(entry.date, [entry]);
      }
      return groups;
    }, new Map()).entries()
  );

const compareMonths = (left: Date, right: Date): number =>
  left.getFullYear() - right.getFullYear() || left.getMonth() - right.getMonth();

const clampMonth = (value: Date, minMonth: Date, maxMonth: Date): Date => {
  if (compareMonths(value, minMonth) < 0) {
    return minMonth;
  }
  if (compareMonths(value, maxMonth) > 0) {
    return maxMonth;
  }
  return value;
};

const renderPickupDot = (entry: PublicWasteCalendarEntry) => (
  <span
    className="pickup-dot"
    aria-hidden="true"
    style={entry.fractionColor ? { backgroundColor: entry.fractionColor } : undefined}
  />
);

const renderPickupEntryButton = (
  entry: PublicWasteCalendarEntry,
  props: Readonly<{
    className: string;
    onActivateEntry: (entry: PublicWasteCalendarEntry) => void;
    children: React.ReactNode;
  }>
) => (
  <button
    key={entry.id}
    type="button"
    className={props.className}
    aria-label={`Termin ${entry.fractionLabel} am ${entry.date}`}
    onClick={() => props.onActivateEntry(entry)}
  >
    {props.children}
  </button>
);

const buildMonthCells = (
  visibleMonth: Date,
  entriesByDate: ReadonlyMap<string, readonly PublicWasteCalendarEntry[]>
): readonly {
  readonly date: Date;
  readonly dateKey: string;
  readonly inMonth: boolean;
  readonly entries: readonly PublicWasteCalendarEntry[];
}[] => {
  const monthStart = startOfMonth(visibleMonth);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - getWeekdayOffset(monthStart));

  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(calendarStart);
    cellDate.setDate(calendarStart.getDate() + index);
    const dateKey = toDateKey(cellDate);

    return {
      date: cellDate,
      dateKey,
      inMonth: isSameMonth(cellDate, visibleMonth),
      entries: entriesByDate.get(dateKey) ?? [],
    };
  });
};

const buildYearMonthCells = (
  visibleMonth: Date,
  entriesByDate: ReadonlyMap<string, readonly PublicWasteCalendarEntry[]>
): readonly (
  | {
      readonly kind: 'day';
      readonly date: Date;
      readonly dateKey: string;
      readonly entries: readonly PublicWasteCalendarEntry[];
    }
  | {
      readonly kind: 'placeholder';
      readonly id: string;
    }
)[] => {
  const monthStart = startOfMonth(visibleMonth);
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const leadingPlaceholders = getWeekdayOffset(monthStart);
  const dayCells = Array.from({ length: daysInMonth }, (_, index) => {
    const cellDate = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index + 1);
    const dateKey = toDateKey(cellDate);

    return {
      kind: 'day' as const,
      date: cellDate,
      dateKey,
      entries: entriesByDate.get(dateKey) ?? [],
    };
  });
  const totalCells = leadingPlaceholders + dayCells.length;
  const trailingPlaceholders = (7 - (totalCells % 7 || 7)) % 7;

  return [
    ...Array.from({ length: leadingPlaceholders }, (_, index) => ({
      kind: 'placeholder' as const,
      id: `leading-${toMonthKey(visibleMonth)}-${index}`,
    })),
    ...dayCells,
    ...Array.from({ length: trailingPlaceholders }, (_, index) => ({
      kind: 'placeholder' as const,
      id: `trailing-${toMonthKey(visibleMonth)}-${index}`,
    })),
  ];
};

export function PublicWasteCalendarPanels(props: Readonly<{
  model: FilteredPublicWasteCalendarViewModel;
  onToggleFraction: (fractionId: string) => void;
  onActivateEntry: (entry: PublicWasteCalendarEntry) => void;
}>) {
  const tabs: ReadonlyArray<'list' | 'month' | 'year'> = ['list', 'month', 'year'];
  const today = React.useRef(new Date()).current;
  const lowerBoundMonth = React.useRef(startOfYear(addYears(today, -1))).current;
  const maxMonth = React.useRef(startOfMonth(addYears(today, 1))).current;
  const earliestEntryMonth = React.useMemo(() => {
    const earliestEntry = props.model.listEntries[0];
    if (!earliestEntry) {
      return startOfMonth(today);
    }

    const month = startOfMonth(toDate(earliestEntry.date));
    return compareMonths(month, lowerBoundMonth) < 0 ? lowerBoundMonth : month;
  }, [lowerBoundMonth, props.model.listEntries, today]);
  const minMonth = earliestEntryMonth;
  const minYear = minMonth.getFullYear();
  const maxYear = maxMonth.getFullYear();
  const entriesByDate = React.useMemo(
    () => new Map(groupEntriesByDay(props.model.listEntries)),
    [props.model.listEntries]
  );
  const [activeTab, setActiveTab] = React.useState<'list' | 'month' | 'year'>('list');
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(() =>
    clampMonth(startOfMonth(today), minMonth, maxMonth)
  );
  const [visibleYear, setVisibleYear] = React.useState<number>(() =>
    Math.min(maxYear, Math.max(minYear, today.getFullYear()))
  );
  const monthGroups = groupEntriesByMonth(props.model.listEntries);
  const monthCells = React.useMemo(() => buildMonthCells(visibleMonth, entriesByDate), [entriesByDate, visibleMonth]);
  const visibleYearMonths = React.useMemo(
    () => Array.from({ length: 12 }, (_, index) => new Date(visibleYear, index, 1)),
    [visibleYear]
  );

  const canGoToPreviousMonth = toMonthKey(visibleMonth) > toMonthKey(minMonth);
  const canGoToNextMonth = toMonthKey(visibleMonth) < toMonthKey(maxMonth);
  const canGoToPreviousYear = visibleYear > minYear;
  const canGoToNextYear = visibleYear < maxYear;

  React.useEffect(() => {
    setVisibleMonth((current) => clampMonth(current, minMonth, maxMonth));
  }, [maxMonth, minMonth]);

  React.useEffect(() => {
    setVisibleYear((current) => Math.min(maxYear, Math.max(minYear, current)));
  }, [maxYear, minYear]);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tab: 'list' | 'month' | 'year') => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    const currentIndex = tabs.indexOf(tab);
    const nextIndex =
      event.key === 'ArrowRight'
        ? (currentIndex + 1) % tabs.length
        : (currentIndex - 1 + tabs.length) % tabs.length;
    setActiveTab(tabs[nextIndex]);
  };

  return (
    <section className="calendar-panel" aria-label="Kalenderansicht">
      <div className="filter-list" aria-label="Fraktionsfilter">
        {props.model.fractionOptions.map((fraction) => {
          const checked = props.model.activeFractionIds.includes(fraction.id);
          const textColor = deriveReadableTextColor(fraction.color);
          return (
            <label
              key={fraction.id}
              className={`filter-chip${checked ? ' is-active' : ''}`}
              style={
                fraction.color
                  ? {
                      backgroundColor: fraction.color,
                      borderColor: fraction.color,
                      ...(textColor ? { color: textColor } : {}),
                    }
                  : undefined
              }
            >
              <input
                type="checkbox"
                className="filter-chip-input"
                checked={checked}
                onChange={() => props.onToggleFraction(fraction.id)}
              />
              <span className="filter-indicator" aria-hidden="true" />
              <span className="filter-chip-text">{fraction.label}</span>
            </label>
          );
        })}
      </div>
      <div className="calendar-tabs" role="tablist" aria-label="Kalenderansichten">
        <button
          type="button"
          role="tab"
          id="public-waste-tab-list"
          aria-controls="public-waste-panel-list"
          aria-selected={activeTab === 'list'}
          tabIndex={activeTab === 'list' ? 0 : -1}
          className={`calendar-tab${activeTab === 'list' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('list')}
          onKeyDown={(event) => handleTabKeyDown(event, 'list')}
        >
          Liste
        </button>
        <button
          type="button"
          role="tab"
          id="public-waste-tab-month"
          aria-controls="public-waste-panel-month"
          aria-selected={activeTab === 'month'}
          tabIndex={activeTab === 'month' ? 0 : -1}
          className={`calendar-tab${activeTab === 'month' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('month')}
          onKeyDown={(event) => handleTabKeyDown(event, 'month')}
        >
          Monat
        </button>
        <button
          type="button"
          role="tab"
          id="public-waste-tab-year"
          aria-controls="public-waste-panel-year"
          aria-selected={activeTab === 'year'}
          tabIndex={activeTab === 'year' ? 0 : -1}
          className={`calendar-tab${activeTab === 'year' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('year')}
          onKeyDown={(event) => handleTabKeyDown(event, 'year')}
        >
          Jahr
        </button>
      </div>
      {activeTab === 'list' ? (
        <div
          id="public-waste-panel-list"
          role="tabpanel"
          aria-labelledby="public-waste-tab-list"
          className="pickup-months"
        >
          {monthGroups.map(([monthKey, monthEntries]) => (
            <section key={monthKey} className="pickup-month-group" aria-labelledby={`month-${monthKey}`}>
              <h3 id={`month-${monthKey}`} className="pickup-month-title">
                {capitalize(monthYearFormatter.format(toDate(`${monthKey}-01`)))}
              </h3>
              <ul className="pickup-list">
                {groupEntriesByDay(monthEntries).map(([date, dayEntries]) => {
                  const dayDate = toDate(date);
                  return (
                    <li key={date} className="pickup-item">
                      <div className="pickup-row">
                        <div className="pickup-date">
                          <span className="pickup-weekday">{capitalize(weekdayFormatter.format(dayDate))}</span>
                          <span className="pickup-day">{date.slice(8, 10)}</span>
                        </div>
                        <div className="pickup-entry-group">
                          {dayEntries.map((entry) => (
                            renderPickupEntryButton(entry, {
                              className: 'pickup-button',
                              onActivateEntry: props.onActivateEntry,
                              children: (
                                <>
                                  {renderPickupDot(entry)}
                                  <span className="pickup-copy">
                                    <strong className="pickup-label">{entry.fractionLabel}</strong>
                                    {entry.tourDescription ? (
                                      <span className="pickup-description">{entry.tourDescription}</span>
                                    ) : null}
                                  </span>
                                </>
                              ),
                            })
                          ))}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : activeTab === 'month' ? (
        <section
          id="public-waste-panel-month"
          role="tabpanel"
          aria-labelledby="public-waste-tab-month"
          className="calendar-view"
        >
          <div className="calendar-view-header">
            <button
              type="button"
              className="calendar-nav-button"
              onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
              disabled={!canGoToPreviousMonth}
            >
              Vorheriger Monat
            </button>
            <h3 className="pickup-month-title">{capitalize(monthYearFormatter.format(visibleMonth))}</h3>
            <button
              type="button"
              className="calendar-nav-button"
              onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
              disabled={!canGoToNextMonth}
            >
              Nächster Monat
            </button>
          </div>
          <div className="month-calendar-grid" aria-label={capitalize(monthYearFormatter.format(visibleMonth))}>
            {weekdayLabels.map((weekday) => (
              <div key={weekday} className="month-calendar-weekday">
                {weekday}
              </div>
            ))}
            {monthCells.map((cell) => (
              <div
                key={cell.dateKey}
                className={`month-calendar-cell${cell.inMonth ? '' : ' is-outside-month'}${cell.entries.length > 0 ? ' has-entries' : ''}`}
              >
                <span className="month-calendar-day">{dayFormatter.format(cell.date)}</span>
                <div className="month-calendar-entry-list">
                  {cell.entries.map((entry) =>
                    renderPickupEntryButton(entry, {
                      className: 'month-calendar-entry',
                      onActivateEntry: props.onActivateEntry,
                      children: renderPickupDot(entry),
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section
          id="public-waste-panel-year"
          role="tabpanel"
          aria-labelledby="public-waste-tab-year"
          className="calendar-view"
        >
          <div className="calendar-view-header">
            <button
              type="button"
              className="calendar-nav-button"
              onClick={() => setVisibleYear((current) => current - 1)}
              disabled={!canGoToPreviousYear}
            >
              Vorheriges Jahr
            </button>
            <h3 className="pickup-month-title">{yearFormatter.format(new Date(visibleYear, 0, 1))}</h3>
            <button
              type="button"
              className="calendar-nav-button"
              onClick={() => setVisibleYear((current) => current + 1)}
              disabled={!canGoToNextYear}
            >
              Nächstes Jahr
            </button>
          </div>
          <div className="year-calendar-grid">
            {visibleYearMonths.map((monthDate) => {
              const cells = buildYearMonthCells(monthDate, entriesByDate);

              return (
                <section key={toMonthKey(monthDate)} className="year-calendar-month">
                  <h4 className="year-calendar-month-title">{capitalize(monthFormatter.format(monthDate))}</h4>
                  <div className="year-calendar-month-grid">
                    {weekdayLabels.map((weekday) => (
                      <div key={`${toMonthKey(monthDate)}-${weekday}`} className="year-calendar-weekday">
                        {weekday}
                      </div>
                    ))}
                    {cells.map((cell) =>
                      cell.kind === 'placeholder' ? (
                        <div key={cell.id} className="year-calendar-day-cell is-placeholder" aria-hidden="true" />
                      ) : (
                        <div
                          key={cell.dateKey}
                          className={`year-calendar-day-cell${cell.entries.length > 0 ? ' has-entries' : ''}`}
                        >
                          <span className="year-calendar-day">{cell.date.getDate()}</span>
                          <div className="year-calendar-entry-list">
                            {cell.entries.map((entry) =>
                              renderPickupEntryButton(entry, {
                                className: 'year-calendar-entry',
                                onActivateEntry: props.onActivateEntry,
                                children: renderPickupDot(entry),
                              })
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}
