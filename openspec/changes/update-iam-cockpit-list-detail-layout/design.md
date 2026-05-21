## Context

Das IAM-Cockpit ist fachlich bereits als Transparenzoberfläche für Rechte-, Governance- und Betroffenenrechtsdaten etabliert, verwendet aber noch zwei konkurrierende Interaktionsmuster:

- `rights` als Tabellenansicht
- `governance` und `dsr` als Kartenlisten mit Inline-Detailpanel

Für den weiteren Ausbau der Admin-Oberflächen soll das Waste-Management-Muster zum globalen Standard werden:

- Tabs als leichte, deutlich aktive Trigger-Leiste
- Übersichten als Tabellen für vergleichbare Datensätze
- separate Detailseiten statt paralleler Inline-Arbeitsflächen

## Decisions

### 1. `/admin/iam` bleibt Übersichtsroute

Die Route `/admin/iam` bleibt der Einstiegspunkt und behält search-param-basiertes Tab-Routing. Dadurch bleiben Deep-Links auf Übersichten stabil und das Verhalten entspricht dem bereits etablierten Waste-Muster.

### 2. Governance und DSR erhalten echte Detailrouten

Statt Details in derselben Seite zu rendern, werden separate Detailrouten eingeführt:

- `/admin/iam/governance/:caseId`
- `/admin/iam/dsr/:caseId`

Das verbessert Deep-Linking, Fokusführung, Rücknavigation und spätere Erweiterbarkeit. Die Übersichtsseiten bleiben dadurch Listenwerkzeuge; die Detailseiten werden eigenständige Arbeitsflächen.

### 3. Listen- und Detaildaten werden getrennt geladen

Die Übersichten laden nur die zum Vergleichen nötigen Listendaten. Detailseiten laden den ausgewählten Fall on demand. Falls serverseitig noch kein dedizierter Detailendpunkt existiert, darf die erste Iteration einen kontrollierten Adapter auf bestehende Datenquellen nutzen, solange die Routen- und UI-Trennung erhalten bleibt.

### 4. `rights` bleibt auf der Übersichtsroute

Für Effective Permissions gibt es keinen vergleichbaren Bedarf an einer separaten Detailroute. Der `rights`-Tab wird deshalb nicht in Einzeldetailseiten zerlegt, sondern formal an denselben Tabellen- und Panelstandard angepasst.

## Architecture

### UI-Struktur

- eine gemeinsame IAM-Tab-Hülle übernimmt Waste-artige Tab-Trigger, mobile Select-Navigation und Panel-Container
- tab-spezifische Übersichtsansichten rendern Tabellen mit `caption`, Spaltenköpfen und Zeilenaktionen
- dedizierte Detailseiten für Governance und DSR teilen sich ein gemeinsames Seitenmuster aus Rücknavigation, Kopfsektion und strukturierten Inhaltsblöcken

### Routing

- Overview bleibt search-param-basiert
- Detailseiten verwenden typsichere Path-Params
- Rücknavigation führt deterministisch wieder auf die zugehörige Übersichtsroute mit korrektem Tab

### Erweiterbarkeit

Das Muster soll so geschnitten werden, dass es später auch für andere Admin-Ressourcen oder Plugin-Listen/Detailseiten wiederverwendbar ist. Deshalb sollen die UI-Bausteine nicht unnötig fachspezifisch auf Governance oder DSR versteift werden.

## Risks

### 1. Doppeltes Datenmodell zwischen Liste und Detail

Wenn Details zunächst aus Listenpayloads rekonstruiert werden, kann das zu unklaren Feldverträgen führen. Daher ist ein echter Detail-Loader bevorzugt, sobald der Aufwand vertretbar ist.

### 2. Regressionen in bestehenden IAM-Tests

Die bestehende Testbasis ist auf Kartenlisten und Inline-Details ausgerichtet. Beim Umbau müssen Altannahmen gezielt entfernt werden, statt parallel zwei Muster zu pflegen.

### 3. Unklare Zustandsrückkehr

Ohne saubere Rücknavigation könnte der Wechsel Übersicht → Detail → Übersicht Filter- oder Tabzustand verlieren. Das Routing muss deshalb den relevanten Rücksprungzustand explizit erhalten oder deterministisch wiederherstellen.
