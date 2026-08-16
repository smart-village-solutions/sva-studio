import { usePoiDetailOperatorController } from './poi.detail-operator-controller.js';
import {
  PoiDetailOperatorCoordinateFields,
  PoiDetailOperatorMap,
} from './poi.detail-operator-map-section.js';
import {
  PoiDetailOperatorAddressFields,
  PoiDetailOperatorContactFields,
  PoiDetailOperatorGeocodingControls,
} from './poi.detail-operator-sections.js';
import { PoiDetailSectionCard } from './poi.detail-section-card.js';

export function PoiDetailOperatorTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const controller = usePoiDetailOperatorController(pt);
  return (
    <PoiDetailSectionCard
      title={pt('cards.operator.details.title')}
      description={pt('cards.operator.details.description')}
    >
      <PoiDetailOperatorContactFields {...controller} pt={pt} />
      <PoiDetailOperatorAddressFields {...controller} pt={pt} />
      <PoiDetailOperatorGeocodingControls {...controller} pt={pt} />
      <PoiDetailOperatorMap {...controller} pt={pt} />
      <PoiDetailOperatorCoordinateFields {...controller} pt={pt} />
    </PoiDetailSectionCard>
  );
}
