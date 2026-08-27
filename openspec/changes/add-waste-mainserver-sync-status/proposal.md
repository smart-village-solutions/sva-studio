# Change: Ausstehenden Waste-Mainserver-Abgleich sichtbar machen

## Why

Der manuelle Waste-Mainserver-Abgleich erkennt Abweichungen heute erst innerhalb des bereits gestarteten Background-Jobs. Das Studio kann deshalb vor dem Jobstart nicht anzeigen, ob Mainserver-relevante Änderungen in der externen Waste-Fachdatenbank seit dem letzten erfolgreichen Abgleich vorgenommen wurden. Benutzer müssen den unveränderten Button vorsorglich betätigen und erhalten nach dem Start weder den dauerhaften Jobkontext noch zeitnah die geplante Anzahl der Übertragungen.

## What Changes

- Die externe tenantbezogene Waste-PostgreSQL-Datenbank führt einen transaktionalen Änderungsmarker für genau die Tabellen und Felder, die in die Mainserver-Terminmaterialisierung eingehen.
- Die zentrale Plugin-Operations-Historie bleibt die führende Quelle für den letzten erfolgreichen `waste-management.sync-mainserver`-Job und dessen Abschlusszeitpunkt.
- Der erfolgreiche Job persistiert die verarbeitete Waste-Quellrevision und das synchronisierte Jahresfenster in seinem bestehenden Ergebnisvertrag.
- Ein neuer autorisierter Lesepfad bestimmt den Quellzustand `clean`, `pending` oder `unknown` ohne Mainserver-Abfrage und ohne Dry-Run und liefert einen gegebenenfalls aktiven zentralen Job getrennt davon aus.
- Der gemeinsame Studio-Header bleibt auf Breadcrumb, Seitentitel, Beschreibung und den Verweis zur öffentlichen Webversion begrenzt; aktueller Breadcrumb und H1 verwenden einheitlich `Abfallkalender`.
- Bei ausstehenden Änderungen bündelt ein direkt auf den Header folgender Statusblock Erklärung und hervorgehobene Aktion `Änderungen synchronisieren`; der Zustand bleibt auch ohne Farbwahrnehmung verständlich.
- Bei `clean` wird keine unbenutzbare Synchronisierungsaktion angezeigt; ein ruhiger Status nennt stattdessen den letzten erfolgreichen Abgleich.
- Ein handlungsleitender Hinweis fordert dazu auf, alle geplanten Änderungen an Terminen und Abholorten vor dem Abgleich abzuschließen und zu speichern; er erklärt zugleich, dass spätere Änderungen einen weiteren Abgleich erfordern.
- Nach dem Jobstart zeigt der Fachbereich den dauerhaften Jobstatus. Sobald der echte Job seine Differenz berechnet hat, nennt er getrennt die zu übertragenden und zu entfernenden Termine und weist darauf hin, dass die Verarbeitung bis zu einer Stunde dauern kann.
- Änderungen während eines laufenden Jobs und ein gewechseltes Jahresfenster bleiben nach dessen Abschluss als ausstehend erkennbar.

## Approval Status

Das fachliche Zielbild, die Platzierung der Aktion im Statusblock und der Verzicht auf einen Dry-Run beim Seitenaufruf wurden im Dialog bestätigt. Die Umsetzung dieses OpenSpec-Changes wurde anschließend ausdrücklich freigegeben.

## Scope Clarification

- Im Scope:
  - ausstehende Mainserver-relevante Änderungen aus der externen Waste-Fachdatenbank erkennen;
  - vorhandene zentrale Jobhistorie als Nachweis des letzten erfolgreichen Abgleichs nutzen;
  - Jahresfenster, parallele Änderungen, Löschungen und Bestandsmigration berücksichtigen;
  - Buttonzustand sowie persistentes Start-, Fortschritts-, Erfolgs- und Fehlerfeedback ergänzen.
- Nicht im Scope:
  - periodischer oder mutationsgetriebener automatischer Mainserver-Terminabgleich;
  - Mainserver-Abfrage oder vollständiger Datenvergleich beim Öffnen der Seite;
  - Erkennung von Änderungen, die außerhalb des Studio-Sync-Pfads direkt im SVA Mainserver vorgenommen wurden;
  - Änderung des separaten automatischen Jobs `waste-management.sync-waste-types`.

## Success Metrics

- Das Öffnen der Waste-Seite löst keine Mainserver-Abfrage und keinen Dry-Run aus.
- Mainserver-relevante Anlagen, Änderungen und Löschungen setzen den Status zuverlässig auf `pending`.
- Ein erfolgreicher Abgleich setzt nur die tatsächlich gelesene Quellrevision und das verarbeitete Jahresfenster auf synchronisiert; parallele spätere Änderungen bleiben offen.
- Der letzte erfolgreiche Abgleich stammt aus einem terminalen `succeeded`-Job mit `finishedAt`, nicht aus einem Start-Event oder einem fehlgeschlagenen Job.
- Der ausstehende Zustand fordert vor dem Start verständlich zum Abschluss und Speichern aller geplanten Termin- und Abholortänderungen auf, ohne dringende Korrekturen technisch zu blockieren.
- Bei `clean` ist im ruhigen Statusblock kein Synchronisierungsbutton sichtbar; `running`, `unknown` und ein fehlgeschlagener letzter Versuch werden im selben Seitenbereich mit nachvollziehbarem Status beziehungsweise sicherer Handlungsmöglichkeit dargestellt.
- Quellzustand, aktiver Job und letzter Versuch bleiben getrennte Vertragsfelder, damit eine während des Jobs committed Änderung gleichzeitig mit dem laufenden Vorgang sichtbar bleiben kann.
- Der Synchronisierungsstatus und seine Aktion erscheinen nicht als fachfremde primäre Headeraktion, sondern als zusammengehörige Einheit direkt unter dem gemeinsamen Studio-Header und vor der Waste-Tabnavigation.
- Nach der Differenzphase zeigt die UI die getrennten Create-/Delete-Zahlen des echten Jobs und den Hinweis auf eine mögliche Dauer von bis zu einer Stunde.
- Status und Handlungsbedarf sind per Tastatur, Screenreader und ohne alleinige Farbcodierung verständlich.

## Impact

- Affected specs:
  - `waste-management`
- Expected affected code:
  - `packages/plugin-waste-management/`
  - `packages/auth-runtime/`
  - `packages/routing/`
  - `packages/core/`
  - `packages/data-repositories/`
  - `packages/waste-management-contracts/`
  - `packages/waste-management-runtime/`
  - `apps/sva-studio-react/src/lib/waste-management-*`
  - versionierter Waste-Tenant-Migrationskatalog unter `deploy/portainer/`
- Affected documentation:
  - `docs/development/studio-db-schema.md`
  - keine fachliche Waste-Tabelle im zentralen Snapshot `docs/development/studio-db-schema-final.sql`
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
