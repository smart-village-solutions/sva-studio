import { IconCalendarPlus, IconFileTypePdf, IconPencil } from '@tabler/icons-react';

type PublicWasteSelectionHeaderProps = {
  readonly cityLine: string;
  readonly streetLine: string;
  readonly houseNumberLine?: string;
  readonly icalUrl: string;
  readonly pdfYear: number;
  readonly pdfRunning: boolean;
  readonly selectedFractionCount: number;
  readonly yearOptions: readonly number[];
  readonly onChangeLocation: () => void;
  readonly onSelectPdfYear: (year: number) => void;
  readonly onDownloadPdf: () => void;
};

export const PublicWasteSelectionHeader = ({
  cityLine,
  streetLine,
  houseNumberLine,
  icalUrl,
  pdfYear,
  pdfRunning,
  selectedFractionCount,
  yearOptions,
  onChangeLocation,
  onSelectPdfYear,
  onDownloadPdf,
}: Readonly<PublicWasteSelectionHeaderProps>) => (
  <div className="selection-header">
    <div className="selection-header-main">
      <h2 className="section-title">Abholort</h2>
      <div className="selection-summary-block">
        <p className="selection-summary-line">{cityLine}</p>
        <p className="selection-summary-line">{streetLine}</p>
        {houseNumberLine ? <p className="selection-summary-line">{houseNumberLine}</p> : null}
      </div>
      <div className="selection-summary-action-row">
        <button type="button" className="selection-summary-link" onClick={onChangeLocation}>
          <IconPencil size={18} stroke={1.75} aria-hidden="true" />
          <span>Adresse ändern</span>
        </button>
      </div>
    </div>
    <div className="selection-header-actions">
      <a href={icalUrl} className="header-action-link">
        <IconCalendarPlus size={18} stroke={1.75} aria-hidden="true" />
        <span>In Kalender übernehmen</span>
      </a>
      <label className="header-action-link">
        <span>PDF-Jahr</span>
        <select aria-label="PDF-Jahr" value={pdfYear} onChange={(event) => onSelectPdfYear(Number.parseInt(event.target.value, 10))}>
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="header-action-link"
        disabled={selectedFractionCount === 0 || pdfRunning}
        onClick={onDownloadPdf}
      >
        <IconFileTypePdf size={18} stroke={1.75} aria-hidden="true" />
        <span>{pdfRunning ? 'PDF wird erstellt…' : 'Druckversion herunterladen'}</span>
      </button>
    </div>
  </div>
);
