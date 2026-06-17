import { IconPencil } from '@tabler/icons-react';

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
        <p className="selection-step-copy">Der gewählte Standort bleibt erhalten, während Sie Ansichten und Aktionen über die aktiven Fraktionen steuern.</p>
      </div>
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
    <div className="selection-header-fractions">
      <div className="selection-section-heading">
        <h2 className="section-title">Abfallfraktionen</h2>
        <p className="selection-step-copy">Diese Auswahl steuert Liste, Kalenderexport, PDF-Download und E-Mail-Abo gemeinsam.</p>
      </div>
      <div className="selection-fraction-list" role="group" aria-label="Abfallfraktionen">
        {fractionOptions.map((fraction) => {
          const checked = activeFractionIds.includes(fraction.id);
          const textColor = deriveReadableTextColor(fraction.color);
          return (
            <label
              key={fraction.id}
              className={`selection-fraction-item${checked ? ' is-active' : ''}`}
              style={
                fraction.color
                  ? {
                      ...(checked ? { backgroundColor: fraction.color, borderColor: fraction.color } : { borderColor: fraction.color }),
                      ...(textColor && checked ? { color: textColor } : {}),
                    }
                  : undefined
              }
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleFraction(fraction.id)}
                aria-label={fraction.label}
              />
              <span
                className="selection-fraction-swatch"
                aria-hidden="true"
                style={fraction.color ? { backgroundColor: fraction.color } : undefined}
              />
              <span className="selection-fraction-copy">{fraction.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  </section>
);
