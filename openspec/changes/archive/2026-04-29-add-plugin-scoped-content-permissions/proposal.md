# Change: Plugin-spezifische bearbeitbare Rechte für News, Events und POI

## Why
Die aktuellen Fachplugins `news`, `events` und `poi` verwenden dieselben generischen `content.*`-Rechte. Dadurch fehlt fachliche Trennschärfe: Ein Benutzer mit Schreibrechten für News kann heute auch Events oder POI bearbeiten. Gleichzeitig darf die Lösung Plugins nicht eng an Core-interne Rechteverträge koppeln, weil neue Plugins später eigenständig ergänzt und entwickelt werden sollen.

Da es noch keine produktive Nutzung mit Echtdaten gibt, kann die Umstellung als direkter Schnitt ohne Migrationspfad erfolgen. Seeds und Seed-Tests werden direkt auf plugin-spezifische Rechte umgestellt.

## What Changes
- Einführung eines generischen Plugin-Permission-Vertrags im SDK, über den Plugins eigene fachliche Rechte deklarieren
- Einführung bearbeitbarer Plugin-Rechte für `news`, `events` und `poi` im IAM- und Admin-Modell als erste produktive Nutzer dieses Vertrags
- Umstellung der Plugin-Routen und Plugin-Aktionen auf plugin-spezifische Guards statt gemeinsamer `content.*`-Rechte
- Explizite Festlegung, dass Plugin-Action-IDs und Plugin-Permission-IDs im ersten Schritt (v1-Konvention) dieselben fully-qualified IDs verwenden dürfen; die bestehende `requiredAction`-Indirektion bleibt als kanonischer Mapping-Pfad für spätere Divergenz erhalten
- Erweiterung der Rollenverwaltungs-UI, damit Plugin-Rechte generisch aus der Registry gepflegt werden können
- Namespace-Validierung im SDK: zulässiges Format, Reserved-Namespaces und Duplikat-Prüfung bei Build-Time
- Entfernung von `content.*` als bearbeitbarem Redaktionsvertrag für produktive Fachplugins
- Feingranulare Plugin-Rechte: Jedes Plugin deklariert individuell, welche Rechte es benötigt. Art und Anzahl bestimmt das Plugin selbst über den SDK-Vertrag — es gibt keine feste Vorgabe aus dem Core
- Fortschreibung von Plugin-Guide, ADR-034 beziehungsweise einer neuen IAM-/Plugin-Rechte-ADR und arc42, damit der bisherige `content.*`-Guard-Vertrag nicht als widersprüchliche Doku bestehen bleibt
- **BREAKING** Produktive Plugin-Oberflächen vertrauen nicht mehr auf globale `content.*`-Rechte, sondern ausschließlich auf plugin-eigene fachliche Rechte. Da keine produktive Nutzung existiert, ist kein Migrationspfad erforderlich.

## Impact
- Affected specs: `iam-access-control`, `account-ui`, `routing`
- Affected code:
  - `packages/plugin-news`
  - `packages/plugin-events`
  - `packages/plugin-poi`
  - `packages/auth-runtime`
  - `packages/iam-admin`
  - `apps/sva-studio-react`
  - `packages/data` / Seeds / Migrationen
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
- Affected docs / ADRs:
  - `docs/guides/plugin-development.md`
  - `docs/adr/ADR-034-plugin-sdk-vertrag-v1.md` oder neue ADR für plugin-spezifische IAM-Rechte
