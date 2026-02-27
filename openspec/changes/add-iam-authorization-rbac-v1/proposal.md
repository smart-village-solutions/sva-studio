# Change: IAM Authorization API und RBAC v1

## Why

Nach dem Datenfundament wird eine zentrale, wiederverwendbare Authorize-Schnittstelle benötigt, damit Module konsistent und schnell Berechtigungen prüfen können.

## Kontext

Child C setzt auf Child B auf und liefert die erste produktiv nutzbare Autorisierungsoberfläche. Ziel ist eine stabile RBAC-Basis mit instanzzentriertem Scoping (`instanceId`) und nachvollziehbaren Entscheidungen (`reason`-Codes), bevor ABAC- und Cache-Komplexität in Child D ergänzt werden.

## What Changes

- API-Endpunkte: `GET /iam/me/permissions`, `POST /iam/authorize`
- RBAC-basierte Auswertung pro aktiver Instanz mit organisationsspezifischem Kontext
- Einfache Reason-Codes für nachvollziehbare Denials
- SDK-nahe Integrationsschicht für modulübergreifende Nutzung
- Verbindliche Mandanten-Scoping-Regel: `instanceId` als Primärfilter

### In Scope

- RBAC v1 ohne ABAC-Regelwerk
- Authorize-Contract inkl. deterministischer `allowed`/`reason`-Antwort
- Instanz- und organisationsbezogene Denial/Allow-Tests
- Erste modulare Integration über SDK-Pfad

### Out of Scope

- ABAC-Kontextregeln (Zeitfenster, erweiterte Geo-Attribute)
- Permission-Caching und Event-basierte Invalidation
- Delegation/Impersonation/Approval-Workflows

### Delivery-Slices

1. **Contract Slice:** API-Schemas, Fehlerklassen, `reason`-Code-Katalog
2. **Engine Slice:** Rollenauflösung, Aggregation, Scope-Matching
3. **Integration Slice:** mindestens ein End-to-End-Nutzungspfad in einem Modul
4. **Quality Slice:** Tests + Performance-Baseline + Dokumentation

## Impact

- Affected specs: `iam-access-control`
- Affected code: `packages/core`, `packages/auth`, `packages/routing`, `apps/sva-studio-react`
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `10-quality-requirements`

## arc42-Referenzen (Dateien)

- `docs/architecture/05-building-block-view.md`
- `docs/architecture/06-runtime-view.md`
- `docs/architecture/08-cross-cutting-concepts.md`
- `docs/architecture/09-architecture-decisions.md`
- `docs/architecture/10-quality-requirements.md`

## Dependencies

- Requires: `add-iam-core-data-layer`
- Blocks: `add-iam-abac-hierarchy-cache`

## Risiken und Gegenmaßnahmen

- **Uneinheitliche Entscheidungen zwischen Modulen:** zentraler API-Contract + SDK-Abstraktion
- **Fehlende Nachvollziehbarkeit bei Denials:** standardisierter `reason`-Code-Katalog
- **Performance-Drift:** Baseline-Messungen pro Endpunkt und frühe Query-Optimierung

## Approval Gate

Vor Start der Implementierung müssen folgende Punkte geklärt sein:

1. ✅ Child-B-Datenmodell für Rollen/Permissions verfügbar
2. ✅ `instanceId`-Scoping als verbindlicher Primärfilter bestätigt
3. ✅ `reason`-Code-Schema als API-Vertrag abgestimmt
4. ✅ Zielwert für `authorize`-Performance als P95-Messgröße bestätigt

## Akzeptanzkriterien (Change-Ebene)

- `GET /iam/me/permissions` liefert reproduzierbare Ergebnisse im aktiven Instanzkontext.
- `POST /iam/authorize` liefert `allowed` plus nachvollziehbaren `reason`-Code.
- Instanzüberschreitende und unzulässige organisationsbezogene Zugriffe werden sicher denied.
- Mindestens ein Modul nutzt den neuen Authorize-Pfad über SDK-Integration.
- Baseline-Performance für `authorize` ist gemessen und dokumentiert.

## Status

🟡 Draft Proposal (inhaltlich vervollständigt, bereit für Review)
