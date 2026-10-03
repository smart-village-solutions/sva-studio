import type { PublicWasteCalendarEntry } from '../lib/public-waste-contract.js';
import { buildMonthCells, buildYearMonthCells } from './public-waste-calendar-panel-data.js';
import { capitalize, toMonthKey } from './public-waste-calendar-panel-dates.js';
import { renderPickupDot, renderPickupEntryButton } from './public-waste-calendar-entry.js';

const monthYearFormatter = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat('de-DE', { month: 'long' });
const yearFormatter = new Intl.DateTimeFormat('de-DE', { year: 'numeric' });
const dayFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit' });
const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

export function PublicWasteMonthPanel(
  props: Readonly<{
    visibleMonth: Date;
    monthCells: ReturnType<typeof buildMonthCells>;
    canGoToPreviousMonth: boolean;
    canGoToNextMonth: boolean;
    onPreviousMonth: () => void;
    onNextMonth: () => void;
    onActivateEntry: (entry: PublicWasteCalendarEntry) => void;
  }>
) {
  const {
    visibleMonth,
    monthCells,
    canGoToPreviousMonth,
    canGoToNextMonth,
    onPreviousMonth,
    onNextMonth,
  } = props;
  return (
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
          onClick={() => onPreviousMonth()}
          disabled={!canGoToPreviousMonth}
        >
          Vorheriger Monat
        </button>
        <h3 className="pickup-month-title">
          {capitalize(monthYearFormatter.format(visibleMonth))}
        </h3>
        <button
          type="button"
          className="calendar-nav-button"
          onClick={() => onNextMonth()}
          disabled={!canGoToNextMonth}
        >
          Nächster Monat
        </button>
      </div>
      <div
        className="month-calendar-grid"
        aria-label={capitalize(monthYearFormatter.format(visibleMonth))}
      >
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
  );
}

export function PublicWasteYearPanel(
  props: Readonly<{
    visibleYear: number;
    visibleYearMonths: readonly Date[];
    entriesByDate: ReadonlyMap<string, readonly PublicWasteCalendarEntry[]>;
    canGoToPreviousYear: boolean;
    canGoToNextYear: boolean;
    onPreviousYear: () => void;
    onNextYear: () => void;
    onActivateEntry: (entry: PublicWasteCalendarEntry) => void;
  }>
) {
  const {
    visibleYear,
    visibleYearMonths,
    entriesByDate,
    canGoToPreviousYear,
    canGoToNextYear,
    onPreviousYear,
    onNextYear,
  } = props;
  return (
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
          onClick={() => onPreviousYear()}
          disabled={!canGoToPreviousYear}
        >
          Vorheriges Jahr
        </button>
        <h3 className="pickup-month-title">{yearFormatter.format(new Date(visibleYear, 0, 1))}</h3>
        <button
          type="button"
          className="calendar-nav-button"
          onClick={() => onNextYear()}
          disabled={!canGoToNextYear}
        >
          Nächstes Jahr
        </button>
      </div>
      <div className="year-calendar-grid">
        {visibleYearMonths.map((monthDate) => (
          <YearMonthPanel
            key={toMonthKey(monthDate)}
            monthDate={monthDate}
            entriesByDate={entriesByDate}
            onActivateEntry={props.onActivateEntry}
          />
        ))}
      </div>
    </section>
  );
}

function YearMonthPanel(
  props: Readonly<{
    monthDate: Date;
    entriesByDate: ReadonlyMap<string, readonly PublicWasteCalendarEntry[]>;
    onActivateEntry: (entry: PublicWasteCalendarEntry) => void;
  }>
) {
  const { monthDate, entriesByDate } = props;
  const cells = buildYearMonthCells(monthDate, entriesByDate);
  return (
    <section className="year-calendar-month">
      <h4 className="year-calendar-month-title">{capitalize(monthFormatter.format(monthDate))}</h4>
      <div className="year-calendar-month-grid">
        {weekdayLabels.map((weekday) => (
          <div key={`${toMonthKey(monthDate)}-${weekday}`} className="year-calendar-weekday">
            {weekday}
          </div>
        ))}
        {cells.map((cell) =>
          cell.kind === 'placeholder' ? (
            <div
              key={cell.id}
              className="year-calendar-day-cell is-placeholder"
              aria-hidden="true"
            />
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
}
