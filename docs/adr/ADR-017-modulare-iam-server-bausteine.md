# ADR-017: Modulare IAM-Server-Bausteine

- Status: Accepted
- Datum: 2026-03-08
- Betrifft: `packages/auth`, `packages/data`, `tooling/quality/complexity-policy.json`
- Referenzierter OpenSpec-Change: `refactor-iam-server-modularization`

## Kontext

Die IAM-Server-Schicht in `packages/auth` und angrenzend in `packages/data` ist fachlich gewachsen, aber strukturell zu breit geschnitten. Einzelne Dateien bündelten bislang Routing, Request-Parsing, Validierung, Datenbankzugriffe, Keycloak-Adapterlogik, Auditierung, Rate-Limits und Response-Mapping in einem gemeinsamen Modul.

Diese Struktur hat mehrere Folgen:

- Hohe Änderungsradien in sicherheits- und domänenkritischen Pfaden
- Breite Exportflächen und schwer reviewbare Entry-Points
- Wiederverwendbare Hilfslogik lag nicht konsistent an einer klaren Stelle
- Das Complexity-Gate wies Hotspots aus, ohne eine Zielarchitektur vorzugeben

## Entscheidung

Die IAM-Server-Schicht wird auf eine modulare Server-Architektur mit zwei Ebenen umgestellt:

1. Dünne öffentliche Entry-Points je Fachbereich
2. Fachliche Kernmodule (`core`) und Shared-Bausteine unterhalb der Entry-Points

Konkret bedeutet das:

- `auth.server.ts`, `routes.server.ts`, `iam-authorization.server.ts`, `iam-account-management.server.ts`, `iam-data-subject-rights.server.ts`, `iam-governance.server.ts` und `keycloak-admin-client.ts` bleiben als stabile Fassaden erhalten.
- Die fachliche Gliederung erfolgt darunter in dedizierten Modulordnern wie `auth-server/`, `routes/`, `iam-authorization/`, `iam-account-management/`, `iam-data-subject-rights/`, `iam-governance/` und `keycloak-admin-client/`.
- `packages/data/src/iam/repositories.ts` wird in read-/write-orientierte Teilbausteine zerlegt.
- Verbleibende Überschreitungen der Complexity-Grenzen werden nicht am alten Dateipfad weitergeführt, sondern am tatsächlichen Restschuld-Modul (`core.ts` bzw. feingranulare Authorization-Dateien) mit Ticketbezug dokumentiert.

## Begründung

- Die Fassaden halten öffentliche Imports stabil und reduzieren breite Barrel-Exports.
- Fachliche Unterordner machen Zuständigkeiten für User, Rollen, Profile, Governance, DSR und Keycloak-Adapter explizit.
- Restschuld wird dorthin verlagert, wo sie tatsächlich noch existiert; dadurch bleibt das Complexity-Gate aussagekräftig.
- Ein schrittweiser Umbau reduziert Merge- und Regressionsrisiko gegenüber einer Big-Bang-Neuschreibung.

## Konsequenzen

### Positiv

- Öffentliche IAM-Entry-Points bleiben klein und reviewbar.
- Routing und andere Konsumenten importieren weiterhin stabile Server-Fassaden.
- Weitere Refactorings können jetzt pro Fachmodul und nicht mehr nur pro Monolith-Datei erfolgen.
- Complexity-Findings sind näher an der realen Restschuld verortet.

### Negativ

- Übergangsweise existieren weiterhin große `core.ts`-Dateien.
- Die Zielarchitektur ist eingeführt, aber die vollständige Entflechtung einzelner Kernmodule bleibt Folgearbeit.
- Reviewer müssen zwischen Fassade und Kernmodul unterscheiden.

## Alternativen

### Bestehende Monolith-Dateien nur weiter testen

Verworfen, weil Tests allein keine klareren Modulgrenzen oder kleinere Änderungsradien schaffen.

### Vollständige Neuschreibung des IAM-Pakets

Verworfen, weil das Regressions- und Merge-Risiko in sicherheitskritischen Pfaden zu hoch ist.

### Reine technische Schichtung ohne Fachschnitt

Verworfen, weil dadurch User-, Rollen-, Governance- und DSR-Flows weiterhin schwer nachvollziehbar geblieben wären.

## Umsetzungshinweise

- Neue fachliche Erweiterungen sollen in den jeweiligen Untermodulen entstehen, nicht in den Fassaden.
- Shared-Helfer für Parsing, Validierung, Logging-Kontext und ähnliche Querschnittslogik sind bevorzugt zentral zu kapseln.
- Verbleibende Komplexitätsüberschreitungen werden ausschließlich über `trackedFindings` mit Ticketbezug geführt.
