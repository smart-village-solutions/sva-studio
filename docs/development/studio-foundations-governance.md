# Studio-Foundations-Governance

## Zweck

Dieses Dokument definiert den verbindlichen Governance-Rahmen für die Studio-Foundations rund um Formulare, HTTP-nahe Frontend-Tests und selektive Property-based-Tests. Es ergänzt die Formularinventur unter `./studio-form-migrationsinventur.md`, die allgemeine Testing-Strategie unter `./testing-strategy.md` und die Coverage-Governance unter `./testing-coverage.md`.

## Geltungsbereich

- Host-Views unter `apps/sva-studio-react`
- Plugin-Views unter `packages/plugin-*`
- gemeinsame UI-Patterns unter `packages/studio-ui-react`
- gemeinsame Testinfrastruktur unter `tooling/testing`
- framework-agnostische Kernlogik in Workspace-Packages wie `packages/core` und `packages/routing`

## Referenzscope dieses Changes

Der repo-weite Default-Standard gilt fuer alle neuen oder grundlegend ueberarbeiteten Formular- und Frontend-Test-Flows im Scope dieser Governance. Der initiale Referenzscope aus OpenSpec ist enger:

- Referenzimplementierungen fuer diese Foundation sind `/admin/users`, `/admin/roles` und die Host-Content-Flows unter `/admin/content`.
- `/account` faellt ebenfalls unter den repo-weiten Default-Standard, ist fuer diesen Change aber kein initialer Referenzpilot.
- Weitere Host- und Plugin-Flows bleiben vom Standard erfasst, auch wenn sie nicht Teil des ersten Referenzpiloten sind.

## Verbindlicher Standardpfad

| Bereich | Verbindlicher Standard | Pflicht ab wann | Dokumentierte Ausnahmen |
| --- | --- | --- | --- |
| Formular-Flow | `react-hook-form` mit `zodResolver` | für neue oder grundlegend überarbeitete Formular-Flows mit Eingabe-, Validierungs- oder Submit-Verantwortung | unveränderte Legacy-Flows, nicht-formularzentrierte Spezialeditoren, eng begründete Sonderfälle |
| HTTP-naher Frontend-Test | `msw` | für neue oder grundlegend überarbeitete Frontend-Tests, die Lade-, Fehler-, Retry-, Response- oder Mutationsverhalten über HTTP prüfen | rein lokale Logik ohne HTTP, unveränderte Legacy-Tests, eng begründete Spezialfälle |
| Kritische Kernlogik | selektives `fast-check` | wenn ein Review für eine geänderte kritische framework-agnostische Logik Invarianten oder große Eingaberäume feststellt | nur mit dokumentierter Begründung pro Hotspot |

## RHF-Pflicht

`react-hook-form` mit `zodResolver` ist verpflichtend, wenn ein Flow mindestens einen der folgenden Punkte erfüllt:

- Er sammelt Benutzereingaben mit fachlicher Validierung oder Normalisierung vor dem Submit.
- Er besitzt einen expliziten Submit-Pfad mit Lade-, Fehler- oder Erfolgszuständen.
- Er verteilt Formularzustand über mehrere Felder, Steps, Tabs oder Subsections.
- Er ist ein neuer oder grundlegend überarbeiteter Host- oder Plugin-CRUD-Flow.

Nicht automatisch RHF-pflichtig sind:

- reine Such-, Filter- oder Pagination-Controls ohne fachlichen Submit-Pfad
- tabellarische Spezialeditoren, deren Kerninteraktion kein klassisches Feld-/Formmodell bildet
- unveränderte Legacy-Flows, die im aktuellen Änderungsumfang nur geringfügig berührt werden

Wenn ein Flow nur teilweise RHF-pflichtig ist, muss der PR klar trennen, welcher Teil den Standardpfad nutzt und welcher Teil als Spezialfall außerhalb des RHF-Feldmodells verbleibt.

## MSW-Pflicht

`msw` ist verpflichtend, wenn ein Frontend-Test mindestens einen der folgenden Aspekte überprüft:

- HTTP-Requests oder Mutationen gegen Host-Endpunkte
- Lade-, Fehler-, Retry-, Timeout- oder Response-Zustände
- Sequenzen aus mehreren Requests mit fachlichem UI-Verhalten
- Unterschiede zwischen Erfolgs-, Leer-, Fehler- und Konfliktantworten

Modul-Mocks bleiben zulässig, wenn der Test ausschließlich rein lokale Logik ohne HTTP-Bezug prüft, zum Beispiel:

- Mapper, Parser, Normalisierer oder Sortierlogik
- Hook- oder Komponentenlogik, deren Abhängigkeit bewusst als lokaler Vertrag isoliert ist
- UI-Hüllen, die nur Props rendern und kein Netzverhalten beschreiben

Nicht zulässig ist ein Modul-Mock als Ersatz für `msw`, wenn der eigentliche Testgegenstand HTTP-Verhalten, Request-Reihenfolge oder serverabhängige Fehlerbilder abbildet.

## Review-Regel für `fast-check`

Für geänderte kritische framework-agnostische Kernlogik muss im Review ausdrücklich geprüft werden, ob eine `fast-check`-Property erforderlich ist. Die Prüfung ist bestanden, wenn eine der beiden Bedingungen erfüllt ist:

1. Der PR ergänzt oder aktualisiert eine passende Property.
2. Der PR dokumentiert kurz und fachlich belastbar, warum für diesen Hotspot keine Property notwendig ist.

Als kritische Kandidaten gelten insbesondere Logiken mit:

- Normalisierung, Parsing oder Schema-Kompaktion
- Invarianten über große Eingaberäume
- Sortier-, Merge-, Filter- oder Routing-Regeln
- Datums-, Suchparam- oder Import-Transformationen

Die initiale Hotspot-Liste für diese Foundation umfasst:

- `packages/routing/src/route-search.ts`
- `packages/routing/src/admin-resource-search-params.ts`
- `packages/core/src/waste-management-location-tour-pickup-date-import.ts`
- `packages/core/src/input-readers.ts`

Review-Blocker:

- geänderte Hotspot-Logik ohne Property und ohne dokumentierte Gegenbegründung
- pauschale Aussagen wie `zu aufwendig` oder `schwer testbar` ohne fachliche Einordnung
- Verschiebungen ohne Folgeeintrag in Doku oder PR-Kontext

## Dokumentationspflicht für Ausnahmen

Legacy- und Spezialausnahmen sind nur zulässig, wenn sie gleichzeitig in allen folgenden Pflichtartefakten sichtbar sind:

- in `docs/development/studio-foundations-governance.md` als geltende Ausnahmeregel und Pflichtprozess
- in `docs/development/studio-form-migrationsinventur.md` in der Spalte `Legacy-Ausnahme`, sobald ein konkreter Host- oder Plugin-Flow betroffen ist
- im PR- oder Arbeitskontext mit kurzer Begründung, Risiko und Auslöser für den späteren Rückbau

Jede Ausnahme muss mindestens enthalten:

- betroffener Pfad oder betroffene Testdatei
- Kategorie: `Legacy-Ausnahme` oder `Spezialfall`
- Grund der Abweichung
- verbleibender Mindestnachweis trotz Ausnahme
- Trigger, bei dem der Standardpfad nachgezogen werden muss

Zulässige Trigger für eine spätere Nachführung sind zum Beispiel:

- grundlegende Überarbeitung des betroffenen Flows
- Erweiterung des HTTP-Verhaltens
- Änderung an der zugrunde liegenden Kernlogik
- Abbau eines bisher trennenden Spezialeditors

## Review-Checkliste

- Ist ein neuer oder grundlegend überarbeiteter Formular-Flow auf `react-hook-form` mit `zodResolver` geführt?
- Beschreibt ein HTTP-naher Frontend-Test Netzwerkverhalten über `msw` statt über Modul-Mocks?
- Ist für geänderte kritische Kernlogik die `fast-check`-Entscheidung explizit sichtbar?
- Sind Ausnahmen in Governance-Artefakt, Formularinventur und PR-/Arbeitskontext konsistent dokumentiert?
- Bleibt der Standardpfad für künftige Migrationen klar erkennbar, statt durch Pilotsprache verwässert zu werden?

## Exit-Kriterien für diese Foundations

Die Foundations gelten nur dann als reviewbar eingeführt, wenn alle folgenden Punkte erfüllt sind:

- Formularinventur und Governance-Artefakt sind aktuell.
- Die beiden zugehörigen ADRs sind im kanonischen ADR-Pfad dokumentiert.
- arc42-Abschnitte 05, 08, 09 und 10 referenzieren den Standardpfad.
- Ausnahmen sind in Governance-Artefakt, Formularinventur und PR-/Arbeitskontext explizit dokumentiert und nicht stillschweigend im Code versteckt.
