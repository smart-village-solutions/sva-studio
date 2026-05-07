## Context

Die aktuelle Instanzverwaltung hatte zwei parallele Persistenz-Implementierungen in `@sva/data` und `@sva/data-repositories`. Gleichzeitig exportierte `@sva/instance-registry` zahlreiche interne Helper über den Root-Entry. Beides vergrößerte den Änderungsradius und erschwerte fachliche Härtung.

## Goals / Non-Goals

- Goals:
  - Eindeutige Ownership der Instanz-Registry-Persistenz
  - Kleinere und stabilere Root-API von `@sva/instance-registry`
  - Kleinere fachliche Kompositionsmodule für Service- und HTTP-Flows
- Non-Goals:
  - Organisationsverwaltung im selben Stream vollständig neu schneiden
  - Neue fachliche Features für Provisioning oder Tenant-IAM einführen

## Decisions

- Decision: `@sva/data-repositories` ist die einzige führende Instanz-Registry-Persistenzschicht.
- Decision: `@sva/data` bleibt als Fassade/Komfortkante erhalten, führt aber keine eigene Instanz-Registry-Implementierung mehr.
- Decision: Interne Provisioning- und Service-Helfer werden nicht mehr über den Root-Entry von `@sva/instance-registry` exportiert.
- Decision: Große Orchestrierungsdateien werden entlang fachlicher Flows statt entlang technischer Dateitypen zerlegt.

## Risks / Trade-offs

- Das Zurückbauen der Root-API kann verdeckte Root-Importe aufdecken.
- Das Entfernen paralleler Implementierungen verschiebt Verantwortung klarer, erfordert aber saubere Typ- und Runtime-Prüfung.

## Migration Plan

1. Charakterisierungstests und Boundary-Tests ergänzen
2. `@sva/data` auf Re-Exports der führenden Instanz-Registry-Persistenz umstellen
3. `@sva/instance-registry` Root-API verkleinern
4. Service- und HTTP-Komposition intern schneiden
5. Folgearbeiten für UI und Ops in separaten Slices weiterführen
