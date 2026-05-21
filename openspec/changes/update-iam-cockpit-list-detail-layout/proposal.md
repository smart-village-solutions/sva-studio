# Change: IAM-Cockpit auf Tabellen- und Detailseitenmuster umstellen

## Why

Das bestehende IAM-Cockpit unter `/admin/iam` mischt mehrere UI-Muster: eine ältere Tab-Darstellung, tabellarische Rechteansicht und kartenbasierte Governance-/DSR-Listen mit Inline-Details. Das erschwert Vergleichbarkeit, Deep-Links und die spätere Vereinheitlichung weiterer Admin- und Plugin-Bereiche.

Für `rights`, `governance` und `dsr` soll deshalb das bereits im Waste-Management etablierte Muster übernommen werden: klare Tab-Navigation, tabellarische Übersichten und separate Detailseiten.

## What Changes

- angleicht die IAM-Tab-Navigation unter `/admin/iam` an das Waste-Management-Muster an
- stellt `governance` und `dsr` von Kartenlisten mit Inline-Details auf Tabellenübersichten mit separaten Detailseiten um
- hebt `rights` visuell und strukturell auf denselben Tabellenstandard an
- ergänzt kanonische Detailrouten für Governance- und DSR-Fälle unter `/admin/iam`
- schärft die OpenSpec-Anforderungen für Deep-Linking, On-Demand-Detaildaten und barrierefreie Listen-/Detailnavigation

## Impact

- Affected specs:
  - `account-ui`
  - `routing`
  - `iam-data-subject-rights`
- Affected code:
  - `apps/sva-studio-react/src/routes/admin/-iam-page.tsx`
  - neue oder angepasste IAM-Routen unter `apps/sva-studio-react/src/routes/admin/`
  - IAM-bezogene UI-Komponenten und Tests in `apps/sva-studio-react/src/`
- Affected arc42 sections:
  - `docs/architecture/README.md` Abschnitt 05 Bausteinsicht
  - `docs/architecture/README.md` Abschnitt 06 Laufzeitsicht
  - `docs/architecture/README.md` Abschnitt 08 Querschnittliche Konzepte
