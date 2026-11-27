# Historien- und Referenzdaten für Mainserver-Mutationen einheitlich ableiten

## Warum

Der direkte Studio-Pfad und der journalgebundene Wiederanlauf verwenden bereits dieselbe IAM-Persistenz. Beide leiten deren Eingaben für Autor, Inhaber und Provider-Identität separat ab. Änderungen an diesen Regeln müssen an beiden Stellen nachvollzogen werden.

## Änderung

Eine gemeinsame Funktion im vorhandenen IAM-Inhaltspfad leitet die Eingabe für `recordSuccessfulExternalContentMutation` aus bereits geprüften Mutationsdaten ab. Der direkte Pfad und der bestehende Wiederanlauf verwenden diese Funktion und entfernen ihre doppelten Ableitungen. Bei einem bestätigten Inhaberwechsel unterscheidet sie den ursprünglichen Actor vom Zielinhaber und berücksichtigt, ob nur die Inhaberfolge nachgeführt werden darf.

Der Change umfasst alle zwölf redaktionellen Mainserver-Inhaltstypen mit Studio-Projektionspfad. Die [Abdeckungsmatrix](design.md) führt ihre bestehenden Einstiege und Besonderheiten auf. Für jede Mutation gilt der heute unterstützte Fach- und Wiederanlaufvertrag.

## Grenzen

Der Studio-Host verantwortet Projektion und Projektionssperren. Die typisierten Mainserver-Routen verantworten Provider-Schreibvorgänge, Readback und HTTP-Ergebnis. Die bestehenden Journalpfade entscheiden über Wiederaufnahme und Abschluss. Löschungen behalten ihren eigenen Audit- und Projektionspfad. Einzel- und Sammelaktionen verwenden die bestehende Nachbearbeitung pro Datensatz.

Der Zuschnitt verwendet die bestehenden Identitäten, Persistenzverträge und Transaktionsgrenzen. Neue Packages, Registries, Queues, Journalzustände und Migrationen liegen außerhalb dieses Changes. Abfalltouren, App-Konfiguration und lokale Inhalte mit eigener Persistenz liegen außerhalb der Typmatrix.

## Auswirkungen

- Das Spec-Delta ergänzt `sva-mainserver-integration`. Die bestehenden Historien- und Berechtigungsverträge aus `content-management` und `iam-access-control` gelten fort.
- Die Umsetzung betrifft die beiden Aufrufer, die Ableitung in `packages/auth-runtime/src/iam-contents`, gezielte Tests und die technischen Beschreibungen in [arc42 05](../../../docs/architecture/05-building-block-view.md) und [arc42 06](../../../docs/architecture/06-runtime-view.md). Die Berechtigungs- und Datenintegritätsregeln aus [arc42 08](../../../docs/architecture/08-cross-cutting-concepts.md) und [ADR-065](../../../docs/adr/ADR-065-mainserver-projektionsabgleich-ueber-scope-grenzen.md) sind Randbedingungen.
