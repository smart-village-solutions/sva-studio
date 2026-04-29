# Change: Zentrales Medienmanagement als hostseitige Capability

## Why
SVA Studio besitzt bereits ein kanonisches Inhaltsmodell, aber noch keinen verbindlichen Vertrag für Medien als wiederverwendbare, mandantenfähige und sicher auslieferbare Assets. Ein reiner Datei-Upload pro Fachmodul würde die Zielarchitektur des Studios unterlaufen: Medien würden dupliziert, Variantenlogik zerstreut, Rechte und Audit uneinheitlich umgesetzt und fachliche Referenzen direkt an technische Dateipfade gekoppelt.

Benötigt wird deshalb eine eigenständige hostseitige Capability für Medienmanagement, die als zentrale Infrastruktur für Inhalte, Systemkonfigurationen und künftige Module dient. Diese Capability muss Originale, Varianten, Referenzen, Rechte, Mandantentrennung, Metadaten und Nutzungstransparenz konsistent modellieren, ohne die bestehende Plugin- und Content-Architektur zu brechen.

## What Changes
- Führt eine neue Capability `media-management` für Media Assets, Varianten, Referenzen, Metadaten, Verwendungsnachweise und kontrollierte Auslieferung ein
- Verankert Medien als hostseitige Querschnittsfunktion und grenzt sie explizit gegen Fachplugins ab
- Schneidet Medienmanagement als hosteigene Admin-Capability mit kanonischem Einstieg `/admin/media`; spezialisierte Bibliotheks-, Crop-, Usage-Impact- oder Detail-Workflows dürfen unterhalb dieses Bereichs über dedizierte Unterrouten materialisiert werden
- Definiert ein fachliches Kernmodell mit `MediaAsset`, `MediaVariant`, `MediaReference` und zentral konfigurierbaren Nutzungsklassen bzw. Presets
- Beschreibt die Trennung zwischen erhaltenem Original, abgeleiteten Varianten und fachlicher Nutzung über Rollen statt über direkte Dateipfade
- Verankert den Anschluss an den aktuellen Build-time-Registry- und Admin-Resource-Vertrag des Hosts statt einer parallelen Sonderverdrahtung
- Legt MinIO als konkret zu berücksichtigenden S3-kompatiblen Objektspeicher für Upload-, Storage- und Auslieferungsschnittstellen fest
- Ergänzt bildspezifische Bearbeitungsfunktionen für Fokuspunkt, redaktionellen Zuschnitt und automatische Verkleinerung übergroßer Bilder
- Ergänzt Upload-Status, Usage-Impact und Löschschutz als MVP-Sicherheitsnetz für redaktionelle Nutzung
- Ergänzt `content-management` um die Anforderung, Medien referenzbasiert und rollenbasiert an Inhalte anzubinden
- Ergänzt einen expliziten Bridge- und Migrationspfad für bestehende URL-basierte Medienfelder in News-, Event- und POI-Workflows
- Ergänzt `iam-access-control` um rollenbasierte Medienrechte für Upload, Metadatenpflege, Referenzierung, Löschung und geschützte Auslieferung
- Klärt die Einbindung in das aktuelle Modul- und Sichtbarkeitsmodell des Hosts, damit Medienmanagement nicht außerhalb der etablierten Modulzuweisung und Guard-Pfade entsteht
- Ergänzt `iam-auditing` um revisionssichere Audit-Events für Upload, Metadatenänderung, Variantenverarbeitung und Löschentscheidungen
- Verankert die Architekturwirkung in arc42, insbesondere für Bausteinsicht, Laufzeitsicht, Verteilungssicht, Querschnittskonzepte, Qualitätsanforderungen, Risiken und ADR-Bedarf

Nicht Bestandteil dieses MVP sind erweiterte Governance- und Betriebsfunktionen wie Pflichtfeld-Konfiguration je Instanz/Medientyp, mehrsprachige Metadaten, Ordner, Tags, Kategorien, Duplikaterkennung, Replace mit Referenzerhalt, Malware-Scan, rollenbezogene Rate-Limits und Quota-Warnungen. Diese werden im Folge-Change `extend-media-management-governance` geschnitten.

## Impact
- Affected specs: `media-management`, `content-management`, `iam-access-control`, `iam-auditing`, `architecture-documentation`
- Affected code:
  - `packages/media/*` oder alternativ `packages/core/src/media/*` für den kanonischen Medienvertrag
  - `packages/plugin-sdk/*` und `packages/routing/*` für hosteigene Admin-Resource- und Route-Materialisierung von `/admin/media` plus optionale Spezialrouten
  - `packages/data/*` für Persistenz, Repositories und Migrationen
  - `packages/auth-runtime/*` und IAM-Zielpackages für serverseitige Rechte-, Upload- und Auslieferungspfade
  - `apps/sva-studio-react/src/routes/admin/media/*` sowie optionale spezialisierte Medien-Unterseiten und zugehörige UI-Bausteine
  - `packages/plugin-news/*`, `packages/plugin-events/*`, `packages/plugin-poi/*` und Host-Adapterpfade für die Migration von `sourceUrl`-/`imageUrl`-basierten Medienfeldern auf hostseitige Medienreferenzen
  - optional Worker-/Processing-Bausteine für Metadaten-Extraktion und Variantengenerierung
- Affected arc42 sections:
  - `docs/architecture/03-context-and-scope.md` (MinIO als S3-kompatibler Objektspeicher und neues externes System im Kontextdiagramm)
  - `docs/architecture/04-solution-strategy.md` (Medienmanagement als hostseitige Querschnittsstrategie, prüfen)
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/07-deployment-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md` (ADR-039 eintragen; ADR-037 ist bereits belegt)
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md` (Async-Variantenpfad als bekannte technische Schuld, CDN/PII-Risiko)
