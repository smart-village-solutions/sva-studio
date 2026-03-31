# ADR-024: IAM-Gruppen als eigenständige, instanzgebundene Entität

**Status:** Accepted
**Entscheidungsdatum:** 2026-03-31
**Entschieden durch:** SVA Studio Team

## Kontext

Die Angebotsbausteine 3 bis 5 führen Gruppen als fachlich wirksame Quelle effektiver Berechtigungen ein. Bisherige Modelle ließen Gruppen leicht als UI-Hilfskonstrukt erscheinen, obwohl sie in der Berechtigungsauflösung, Transparenzdarstellung und Admin-Verwaltung eigenständige Verantwortung tragen.

## Entscheidung

Gruppen werden als eigenständige, instanzgebundene IAM-Entität modelliert. Sie bündeln im ersten Schnitt Rollen, aber keine direkten Permissions.

## Begründung

- Das Modell trennt fachliche Gruppenverwaltung sauber von Benutzer- oder Rollenstammdaten.
- Instanzisolation, Gültigkeitsfenster und Auditierbarkeit lassen sich explizit und testbar formulieren.
- Die effektive Rechteauflösung kann Herkunft aus direkter Rolle und Gruppenrolle gemeinsam, aber nachvollziehbar behandeln.

## Konsequenzen

### Positive Konsequenzen

- Klare Verantwortlichkeit für Gruppenverwaltung, Mitgliedschaften und Transparenzdaten
- Konsistentes Admin-UI-Modell für Gruppen, Rollenbündel und Mitgliedschaften
- Saubere Erweiterbarkeit für spätere Sync- oder Derived-Membership-Szenarien

### Negative Konsequenzen

- Zusätzliche Tabellen, Constraints und Invalidierungsfälle
- Mehr Komplexität in der effektiven Berechtigungsauflösung

### Mitigationen

- Normierte Testmatrizen für Gruppen-, Geo- und Konfliktfälle
- Revisionssichere Herkunftsdaten in UI und Autorisierung

## Verwandte ADRs

- `ADR-012-permission-kompositionsmodell-rbac-v1.md`
- `ADR-013-rbac-abac-hybridmodell.md`
- `ADR-017-modulare-iam-server-bausteine.md`

## Gültigkeitsdauer

Diese ADR bleibt gültig, bis direkte Gruppen-Permissions oder ein anderes Subjektmodell das Rollen-Container-Prinzip ersetzen.
