## Context

Die Route `POST /api/v1/mainserver/projects` ist bereits durch den aktiven Change `use-mainserver-data-provider-as-content-author` fachlich festgelegt. Dieser Refactor ändert keinen Vertrag, sondern reduziert die interne Ownership der zuvor kritischen Create-Funktion. Ausgangsbasis ist `3b1085ebc48a2c4e182346dcbf3037dd0bbdd99b`.

## Goals

- Create-Vorbedingungen und fachliche Seiteneffekte in klar benannten Modulen isolieren
- die bestehende Reihenfolge von Autorisierung, Validierung, Provider-Write, Sichtbarkeit und lokaler Folgearbeit erhalten
- Replay-, Konflikt- und unbekannte Provider-Ergebnisse unverändert behandeln
- reine Payload-/Response-Abbildung unabhängig von I/O testbar machen

## Non-Goals

- keine Änderung an HTTP-, Permission-, DataProvider-, `MediaReference`- oder Datenbankverträgen
- keine neue Projektfunktion oder Benutzeroberfläche
- kein kompensierendes Mainserver-Delete bei einem Fehler nach bestätigtem Provider-Create
- keine generische Factory, kein Service-Interface und kein neuer öffentlicher Export

## Decisions

- `projects-route.ts` bleibt die HTTP-Dispatch- und Update-/Delete-Fassade.
- `projects-create.ts` orchestriert ausschließlich die Projekterstellung.
- `projects-create-idempotency.ts` besitzt Reservation, Replay, Recovery und Completion.
- `projects-create-mapping.ts` besitzt die reine Payload-, Projection- und Response-Abbildung.
- `projects-route-authorization.ts` bündelt die bereits gemeinsam genutzten fail-closed Vorbedingungen; `projects-route-transport.ts` hält Quellidentität und Provider-Response-Header.
- Alle internen Runtime-Imports verwenden Node-ESM-konforme `.js`-Endungen.

## Preserved runtime sequence

1. CSRF und typspezifische IAM-Autorisierung
2. Auflösung des Mutation-Principals und Request-/Idempotenzvalidierung
3. Replay-/Recovery-Prüfung ohne Provider-Mutation
4. Mainserver-Create und DataProvider-Beobachtung
5. Sichtbarkeit im Mainserver
6. optionale lokale Content-/Reference-Folgearbeit
7. Mutationsjournal und Idempotenz-Completion

## Failure and rollback semantics

- Ablehnung oder ungültige Eingabe endet vor Reservation und Provider-Write.
- Ein Provider-Create-Fehler erzeugt weder Visibility- noch lokale Folgeaktionen.
- Ein Fehler nach bestätigtem Provider-Create löst kein erfundenes Provider-Delete aus.
- Lokale Folgefehler markieren die interne Reconciliation, ändern aber den bestätigten HTTP-Erfolg nicht.
- Response-Metadaten bleiben an einen DataProvider-Binding-Konflikt gebunden und werden nicht allein durch einen lokalen Folgefehler ergänzt.

## Risks / Trade-offs

- Mehr interne Dateien erhöhen die Dateianzahl, verkleinern aber die Änderungs- und Testfläche pro Verantwortung.
- Der mutable Reference-State bleibt bewusst auf den Create-Lifecycle begrenzt, damit ein späterer Fehler die bereits vorbereitete Referenz weiterhin zur Reconciliation markieren kann.

## Migration Plan

1. bestehende Create-Pfade und Seiteneffekt-Reihenfolge charakterisieren
2. reine Abbildung und interne Verantwortlichkeiten extrahieren
3. fokussierte Tests, Paket-Gates, Runtime-Gate, Complexity und Fallow ausführen
4. Architekturdokumentation und Change-Evidenz aktualisieren
