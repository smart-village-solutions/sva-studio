import React from 'react';
import type { PublicWasteCalendarEntry } from '../lib/public-waste-contract.js';
import type { FilteredPublicWasteCalendarViewModel } from '../lib/public-waste-view-model.js';
import {
  buildMonthCells,
  groupEntriesByDay,
  partitionListEntries,
} from './public-waste-calendar-panel-data.js';
import {
  addMonths,
  addYears,
  clampMonth,
  compareMonths,
  startOfMonth,
  startOfYear,
  toDate,
  toMonthKey,
} from './public-waste-calendar-panel-dates.js';
import {
  PublicWasteMonthPanel,
  PublicWasteYearPanel,
} from './public-waste-calendar-grid-panels.js';
import { PublicWasteListPanel } from './public-waste-calendar-list-panel.js';

export function PublicWasteCalendarPanels(
  props: Readonly<{
    model: FilteredPublicWasteCalendarViewModel;
    onActivateEntry: (entry: PublicWasteCalendarEntry) => void;
    onVisibleYearChange?: (year: number) => void;
  }>
) {
  const tabs: ReadonlyArray<'list' | 'month' | 'year'> = ['list', 'month', 'year'];
  const tabButtonRefs = React.useRef(new Map<'list' | 'month' | 'year', HTMLButtonElement>());
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
  const { upcomingEntries, pastEntries } = React.useMemo(
    () => partitionListEntries(props.model.listEntries, props.model.nextPickupDate),
    [props.model.listEntries, props.model.nextPickupDate]
  );
  const monthCells = React.useMemo(
    () => buildMonthCells(visibleMonth, entriesByDate),
    [entriesByDate, visibleMonth]
  );
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

  React.useEffect(() => {
    props.onVisibleYearChange?.(activeTab === 'month' ? visibleMonth.getFullYear() : visibleYear);
  }, [activeTab, props.onVisibleYearChange, visibleMonth, visibleYear]);

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    tab: 'list' | 'month' | 'year'
  ) => {
    if (
      event.key !== 'ArrowLeft' &&
      event.key !== 'ArrowRight' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return;
    }

    event.preventDefault();
    const currentIndex = tabs.indexOf(tab);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : event.key === 'ArrowRight'
            ? (currentIndex + 1) % tabs.length
            : (currentIndex - 1 + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    setActiveTab(nextTab);
    tabButtonRefs.current.get(nextTab)?.focus();
  };

  return (
    <section className="calendar-panel" aria-label="Kalenderansicht">
      <div className="calendar-tabs" role="tablist" aria-label="Kalenderansichten">
        <button
          type="button"
          role="tab"
          id="public-waste-tab-list"
          ref={(element) => {
            if (element) tabButtonRefs.current.set('list', element);
          }}
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
          ref={(element) => {
            if (element) tabButtonRefs.current.set('month', element);
          }}
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
          ref={(element) => {
            if (element) tabButtonRefs.current.set('year', element);
          }}
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
        <PublicWasteListPanel upcomingEntries={upcomingEntries} pastEntries={pastEntries} />
      ) : activeTab === 'month' ? (
        <PublicWasteMonthPanel
          visibleMonth={visibleMonth}
          monthCells={monthCells}
          canGoToPreviousMonth={canGoToPreviousMonth}
          canGoToNextMonth={canGoToNextMonth}
          onPreviousMonth={() => setVisibleMonth((current) => addMonths(current, -1))}
          onNextMonth={() => setVisibleMonth((current) => addMonths(current, 1))}
          onActivateEntry={props.onActivateEntry}
        />
      ) : (
        <PublicWasteYearPanel
          visibleYear={visibleYear}
          visibleYearMonths={visibleYearMonths}
          entriesByDate={entriesByDate}
          canGoToPreviousYear={canGoToPreviousYear}
          canGoToNextYear={canGoToNextYear}
          onPreviousYear={() => setVisibleYear((current) => current - 1)}
          onNextYear={() => setVisibleYear((current) => current + 1)}
          onActivateEntry={props.onActivateEntry}
        />
      )}
    </section>
  );
}
