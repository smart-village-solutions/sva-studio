# Entwurf

## Gemeinsame Ableitung

Der direkte Pfad baut in `iam-content-list-projection-mutation.server.ts` die Eingabe für `recordSuccessfulExternalContentMutation`. Der Wiederanlauf tut dasselbe in `mainserver-mutation-projection-reconciliation.ts`. Die gemeinsame Ableitung liegt neben dieser bestehenden IAM-Persistenz in `auth-runtime/src/iam-contents`. Sie übernimmt ausschließlich die Zuordnung von Actor, Autor, verifizierter Inhaberfolge und externer Identität zur vorhandenen Persistenzeingabe `SuccessfulExternalContentMutation`.

- Der direkte Aufrufer liefert den geprüften Datensatz aus dem gezielten Detail-Readback oder aus dem bereits vorliegenden bestätigten Ergebnis. Der Wiederanlauf liefert die durch seine vorhandenen Journal- und Scope-Prüfungen ausgewählte Projektionszeile. Auswahl, Verifikation und Entscheidung über die Wiederaufnahme liegen bei den jeweiligen Aufrufern.
- Die Aufrufer unterscheiden zwei bestehende Fälle. Eine vollständig belegte Mutation kann die dafür vorgesehenen lokalen Daten nachführen. Bei einem verifizierten Inhaberwechsel mit neuerem Inhaltsstand liefert die Funktion nur die Eingabe für die belegte Inhaberfolge. Der ursprüngliche Actor kommt aus dem jeweiligen gebundenen Mutationskontext, beim Wiederanlauf aus dem ursprünglichen Journaleintrag. Der Zielinhaber wird separat übergeben.
- Die Persistenz dedupliziert anhand von Mandant, lokaler Content-ID und Mutationsreferenz. Featured Projects können bestehende Referenzen unter `GenericItem` und `projects.project` mit verschiedenen lokalen Content-IDs besitzen. Beide Bindungen und die bestehende Deduplizierung pro lokaler ID gelten fort.

Die Funktion braucht weder Datenbankzugriff noch Provider-Zugriff, Routenkenntnis oder eine Liste von Inhaltstypen. Projektion, Referenzpersistenz, Journalfortschritt und autorisierter Readback laufen über die bestehenden Aufrufer und Speicherpfade. Ein Provider-Write, die Evidenz für seine lokale Nachbearbeitung und das öffentliche HTTP-Ergebnis sind getrennte Informationen. So kann eine Tour-Mutation im Journal einen ausgeführten Write vermerken und gleichzeitig wegen eines unbestätigten Readbacks ein Teilergebnis melden. Ein erneuter Journalzeitstempel liefert keinen zusätzlichen Beleg für die Zuordnung eines späteren Inhaltsstands.

## Abdeckungsmatrix

Die Typmenge entspricht `DEFAULT_MAINSERVER_VISIBLE_TYPES` in `iam-content-list-api.shared.ts`. Die Matrix belegt die Anbindung über vorhandene Host-Einstiege. Die gemeinsame Ableitung gilt überall dort, wo der vorhandene Fachvertrag eine bestätigte Anlage, Änderung oder Inhaberfolge an die IAM-Historienpersistenz übergibt. Löschungen, Prepare-Aufrufe und dedizierte Provider-Recovery-Routen behalten ihre fachlichen Verträge.

| Typ-ID | Bestehender Host-Einstieg | Zu erhaltende Besonderheit |
| --- | --- | --- |
| `news.article` | News-Fassade | Inhalt, Sichtbarkeit und Push haben eigene Provider-Folgen. |
| `events.event-record` | Event-Fassade | Typisierter Detail-Readback bei Änderungen. |
| `poi.point-of-interest` | POI-Fassade | Referenzteilfehler und betroffene POI-Projektion beim Gutschein-Aggregat. |
| `tours.tour` | Touren-Dispatch im Server-Einstieg | `createTour` bei Bearbeitung und bestehende Semantik für unbestätigten Readback. |
| `generic-items.generic-item` | GenericItem-Dispatch | Provider-ID und Diskriminator. Gezielte Bereinigung der Geschwisterprojektion bei Typwechsel. |
| `faq.faq` | FAQ über GenericItem-Dispatch | Typisierte Identität und Sprachdaten. |
| `cockpit-cards.cockpit-card` | Cockpit Cards über GenericItem-Dispatch | Typisierte Identität, Sichtbarkeit und gezielte Löschung. |
| `projects.project` | Projects über GenericItem-Dispatch | Bestehende Core- und Provider-Referenzen, ursprünglicher Transfer-Actor und verifizierter Zielinhaber. |
| `surveys.survey` | Survey-Fassade | Typisierte Identität und bestehende Moderationsaktionen. |
| `construction-sites.construction-site` | Baustellen-Route über GenericItem-Dispatch | Bestehendes Prepare, Write und Recover mit typisiertem Readback. |
| `jobs.job` | Jobs-Route über GenericItem-Dispatch | Eigene Update- und Löschbestätigung sowie HTTP 202 für offene Folgearbeit. |
| `vouchers.voucher` | Voucher-Route über GenericItem-Dispatch | Bestätigter Reset, neue Gutschein-IDs und betroffene POI-Projektion. |

Unterstützte Einzel- und Sammeltransfers verwenden den bestehenden Inhaberwechselpfad. Dessen Scopes, Sperren und Generationsschutz bleiben durch [ADR-065](../../../docs/adr/ADR-065-mainserver-projektionsabgleich-ueber-scope-grenzen.md) bestimmt.

## Abnahme

- Der parametrisierte Test prüft für alle zwölf Typen den registrierten Studio-Dispatcher bis zur Übergabe an die Projektion. Jeder Fall verwendet eine vom Mainserver-Adapter unterstützte Methode und Route. Den direkten Projektionspfad bis zur gemeinsamen Ableitung prüfen die gezielten Projektions- und GenericItem-Tests.
- Ein bestätigtes POI-Update durchläuft im Vergleichstest den direkten Projektionspfad und den journalgebundenen Wiederanlauf mit derselben Mutation. Beide Aufrufe müssen der IAM-Persistenz dieselben Daten übergeben. Der verifizierte Featured-Project-Transfer bei neuerem Inhaltsstand prüft getrennte Actor- und Zielidentität und den Modus für die reine Inhaberfolge. Die [bestehende SQL-Deduplizierung](../../../packages/auth-runtime/src/iam-contents/repository-shared.ts) gilt pro Mandant, lokaler Content-ID und Mutationsreferenz. Vorhandene Tests für Löschung, Typwechsel, Gutscheine, Stellenanzeigen und Credential-Scopes ergänzen die Abnahme.
- Beide Aufrufer umstellen und die ersetzten Ableitungen im selben Lieferabschnitt entfernen. Der Änderungsschnitt endet an der vorhandenen Persistenzeingabe. Ein neues Persistenz- oder Wiederanlaufproblem hat einen eigenen Änderungsumfang.
