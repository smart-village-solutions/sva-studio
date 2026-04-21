# Change: Zentrales Medienmanagement als hostseitige Capability

## Why
SVA Studio besitzt bereits ein kanonisches Inhaltsmodell, aber noch keinen verbindlichen Vertrag für Medien als wiederverwendbare, mandantenfähige und sicher auslieferbare Assets. Ein reiner Datei-Upload pro Fachmodul würde die Zielarchitektur des Studios unterlaufen: Medien würden dupliziert, Variantenlogik zerstreut, Rechte und Audit uneinheitlich umgesetzt und fachliche Referenzen direkt an technische Dateipfade gekoppelt.

Benötigt wird deshalb eine eigenständige hostseitige Capability für Medienmanagement, die als zentrale Infrastruktur für Inhalte, Systemkonfigurationen und künftige Module dient. Diese Capability muss Originale, Varianten, Referenzen, Rechte, Mandantentrennung, Metadaten und Nutzungstransparenz konsistent modellieren, ohne die bestehende Plugin- und Content-Architektur zu brechen.

## What Changes
- Führt eine neue Capability `media-management` für Media Assets, Varianten, Referenzen, Metadaten, Verwendungsnachweise und kontrollierte Auslieferung ein
- Verankert Medien als hostseitige Querschnittsfunktion und grenzt sie explizit gegen Fachplugins ab
- Definiert ein fachliches Kernmodell mit `MediaAsset`, `MediaVariant`, `MediaReference` und zentral konfigurierbaren Nutzungsklassen bzw. Presets
- Beschreibt die Trennung zwischen erhaltenem Original, abgeleiteten Varianten und fachlicher Nutzung über Rollen statt über direkte Dateipfade
- Ergänzt `content-management` um die Anforderung, Medien referenzbasiert und rollenbasiert an Inhalte anzubinden
- Ergänzt `iam-access-control` um rollenbasierte Medienrechte für Upload, Metadatenpflege, Referenzierung, Löschung und geschützte Auslieferung
- Ergänzt `iam-auditing` um revisionssichere Audit-Events für Upload, Ersatz, Metadatenänderung, Variantenverarbeitung und Löschentscheidungen
- Verankert die Architekturwirkung in arc42, insbesondere für Bausteinsicht, Laufzeitsicht, Verteilungssicht, Querschnittskonzepte, Qualitätsanforderungen, Risiken und ADR-Bedarf

## Impact
- Affected specs: `media-management`, `content-management`, `iam-access-control`, `iam-auditing`, `architecture-documentation`
- Affected code:
  - `packages/media/*` oder alternativ `packages/core/src/media/*` für den kanonischen Medienvertrag
  - `packages/data/*` für Persistenz, Repositories und Migrationen
  - `packages/auth/*` für serverseitige Rechte-, Upload- und Auslieferungspfade
  - `apps/sva-studio-react/src/routes/media/*` und zugehörige UI-Bausteine
  - optional Worker-/Processing-Bausteine für Metadaten-Extraktion und Variantengenerierung
- Affected arc42 sections:
  - `docs/architecture/03-context-and-scope.md` (S3-kompatibler Objektspeicher als neues externes System im Kontextdiagramm)
  - `docs/architecture/04-solution-strategy.md` (Medienmanagement als hostseitige Querschnittsstrategie, prüfen)
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/07-deployment-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md` (ADR-037 eintragen)
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md` (Async-Variantenpfad als bekannte technische Schuld, CDN/PII-Risiko)
