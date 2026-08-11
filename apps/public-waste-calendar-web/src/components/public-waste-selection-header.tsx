import { IconInfoCircle, IconPencil } from '@tabler/icons-react';

import type { PublicWasteFractionOption } from '../lib/public-waste-contract.js';

type PublicWasteSelectionHeaderProps = {
  readonly cityLine: string;
  readonly streetLine: string;
  readonly houseNumberLine?: string;
  readonly fractionOptions: readonly PublicWasteFractionOption[];
  readonly activeFractionIds: readonly string[];
  readonly onChangeLocation: () => void;
  readonly onToggleFraction: (fractionId: string) => void;
};

export const PublicWasteSelectionHeader = ({
  cityLine,
  streetLine,
  houseNumberLine,
  fractionOptions,
  activeFractionIds,
  onChangeLocation,
  onToggleFraction,
}: Readonly<PublicWasteSelectionHeaderProps>) => (
  <section className="selection-header" aria-label="Standort und Fraktionen">
    <div className="selection-header-main">
      <div className="selection-section-heading">
        <h2 className="section-title">Adresse</h2>
      </div>
      <div className="selection-summary-row">
        <div className="selection-summary-block">
          <p className="selection-summary-line">{cityLine}</p>
          <p className="selection-summary-line">{streetLine}</p>
          {houseNumberLine ? <p className="selection-summary-line">{houseNumberLine}</p> : null}
        </div>
        <button type="button" className="selection-summary-action" onClick={onChangeLocation}>
          <IconPencil size={18} stroke={1.75} aria-hidden="true" />
          <span>Adresse ändern</span>
        </button>
      </div>
    </div>
    <div className="selection-header-fractions">
      <div className="selection-section-heading">
        <div className="selection-section-title-row">
          <h2 className="section-title">Abfallfraktionen</h2>
          <button
            type="button"
            className="selection-info-trigger"
            aria-label="Informationen zu Abfallfraktionen"
            popoverTarget="public-waste-fraction-info"
          >
            <IconInfoCircle size={19} stroke={2.4} aria-hidden="true" />
          </button>
        </div>
        <div id="public-waste-fraction-info" className="selection-info-popover" popover="auto">
          <p>
            Diese Auswahl steuert Liste, Kalenderexport, PDF/Druckversion und E-Mail-Erinnerung
            gemeinsam.
          </p>
        </div>
      </div>
      <div className="selection-fraction-list" role="group" aria-label="Abfallfraktionen">
        {fractionOptions.map((fraction) => {
          const checked = activeFractionIds.includes(fraction.id);
          return (
            <label
              key={fraction.id}
              className={`selection-fraction-item${checked ? ' is-active' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleFraction(fraction.id)}
                aria-label={fraction.label}
                style={fraction.color ? { accentColor: fraction.color } : undefined}
              />
              <span className="selection-fraction-copy">{fraction.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  </section>
);
