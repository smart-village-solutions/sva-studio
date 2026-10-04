import type { PublicWasteCalendarEntry } from '../lib/public-waste-contract.js';
import { PublicWasteRichText } from './public-waste-rich-text.js';
import { groupEntriesByDay, groupEntriesByMonth } from './public-waste-calendar-panel-data.js';
import { capitalize, toDate } from './public-waste-calendar-panel-dates.js';
import { renderPickupDot } from './public-waste-calendar-entry.js';

const monthYearFormatter = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const weekdayFormatter = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });

const renderListMonthGroups = (
  input: Readonly<{
    entries: readonly PublicWasteCalendarEntry[];
    headingIdPrefix: string;
  }>
) =>
  groupEntriesByMonth(input.entries).map(([monthKey, monthEntries]) => (
    <section
      key={`${input.headingIdPrefix}-${monthKey}`}
      className="pickup-month-group"
      aria-labelledby={`${input.headingIdPrefix}-${monthKey}`}
    >
      <h3 id={`${input.headingIdPrefix}-${monthKey}`} className="pickup-month-title">
        {capitalize(monthYearFormatter.format(toDate(`${monthKey}-01`)))}
      </h3>
      <ul className="pickup-list">
        {groupEntriesByDay(monthEntries).map(([date, dayEntries]) => {
          const dayDate = toDate(date);
          return (
            <li key={date} className="pickup-item">
              <div className="pickup-row">
                <div className="pickup-date">
                  <span className="pickup-weekday">
                    {capitalize(weekdayFormatter.format(dayDate))}
                  </span>
                  <span className="pickup-day">{date.slice(8, 10)}</span>
                </div>
                <div className="pickup-entry-group">
                  {dayEntries.map((entry) => (
                    <div key={entry.id} className="pickup-entry">
                      {renderPickupDot(entry)}
                      <div className="pickup-copy">
                        <strong className="pickup-label">{entry.fractionLabel}</strong>
                        {entry.tourDescription ? (
                          <PublicWasteRichText
                            className="pickup-description"
                            html={entry.tourDescription}
                          />
                        ) : null}
                        {entry.note ? (
                          <PublicWasteRichText className="pickup-description" html={entry.note} />
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  ));

export function PublicWasteListPanel(
  props: Readonly<{
    upcomingEntries: readonly PublicWasteCalendarEntry[];
    pastEntries: readonly PublicWasteCalendarEntry[];
  }>
) {
  const { upcomingEntries, pastEntries } = props;
  return (
    <div
      id="public-waste-panel-list"
      role="tabpanel"
      aria-labelledby="public-waste-tab-list"
      className="pickup-months"
    >
      {renderListMonthGroups({
        entries: upcomingEntries,
        headingIdPrefix: 'upcoming-month',
      })}
      {pastEntries.length > 0 ? (
        <section className="pickup-past-group" aria-labelledby="past-pickups-heading">
          <h3 id="past-pickups-heading" className="pickup-month-title">
            Vergangene Termine
          </h3>
          {renderListMonthGroups({
            entries: pastEntries,
            headingIdPrefix: 'past-month',
          })}
        </section>
      ) : null}
    </div>
  );
}
