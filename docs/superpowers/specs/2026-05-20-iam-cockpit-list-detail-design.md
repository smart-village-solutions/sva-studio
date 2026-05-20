# IAM-Cockpit Listen- und Detailseiten-Design

## Ziel

Die IAM-Oberfläche unter `/admin/iam` soll sich in drei zentralen UI-Mustern am Waste-Management-Plugin orientieren:

- tab-basierte Bereichsnavigation
- tabellarische Übersichtsseiten für vergleichbare Datensätze
- separate Detailseiten statt Inline-Detailkarten

Der Fokus dieses Designs liegt auf den Bereichen `rights`, `governance` und `dsr`. Andere IAM-Bereiche dürfen im Zuge der Umsetzung mitbereinigt werden, wenn das die Konsistenz vereinfacht, sind aber nicht primärer Lieferumfang.

## Ausgangslage

Die bestehende IAM-Cockpit-Seite unter `apps/sva-studio-react/src/routes/admin/-iam-page.tsx` mischt mehrere ältere Darstellungsmuster:

- Tabs werden als klassische Cockpit-Navigation gerendert, aber nicht im Waste-Layout
- `rights` nutzt bereits eine Tabelle, jedoch noch ohne dieselbe visuelle und strukturelle Konsistenz wie die Waste-Übersichten
- `governance` und `dsr` verwenden klickbare Kartenlisten mit einer Inline-Detaildarstellung auf derselben Seite

Das Waste-Management-Plugin ist im Repository bereits die Referenz für die Zielrichtung:

- `waste-management.page.layout.tsx`
- `waste-management.page.layout.parts.tsx`
- `waste-management.master-data-locations-table.section.tsx`

Diese Referenz liefert die gewünschte Form für Tab-Leiste, Panel-Hülle, Tabellen-Dichte und klare Trennung zwischen Übersicht und Arbeitsfläche.

## Zielbild

### 1. Einstieg und Routing

`/admin/iam` bleibt der Einstiegspunkt für die IAM-Cockpit-Übersichten. Dort bleibt die Bereichsauswahl search-param-basiert über `tab`, damit das Navigationsmodell dem Waste-Management entspricht.

Vorgesehene Zielrouten:

- `/admin/iam?tab=rights`
- `/admin/iam?tab=governance`
- `/admin/iam/governance/:caseId`
- `/admin/iam?tab=dsr`
- `/admin/iam/dsr/:caseId`

Die Übersichtsroute bleibt damit leicht verlinkbar und konsistent, während `governance` und `dsr` echte Detailseiten mit typsicheren Path-Params erhalten.

### 2. Tab-Darstellung

Die IAM-Tabs übernehmen das Waste-Muster:

- horizontale Trigger-Leiste auf Desktop
- `Select`-Fallback auf mobilen Viewports
- aktive Markierung über Unterstreichung und Farbwechsel statt buttonartiger Kartenoptik
- optional Icon + Text je Tab
- einheitliche Panel-Hülle pro Tab mit Überschrift, Kurzbeschreibung und Platz für Filter oder Aktionen

Die Tab-Navigation bleibt funktional auf `rights`, `governance` und `dsr` ausgerichtet; zusätzliche IAM-Tabs sollen, falls vorhanden, dasselbe Muster erben.

### 3. Übersichtsseiten

Alle drei Fokusbereiche werden als Übersichtsseiten verstanden, deren primärer Zweck Vergleichen, Filtern, Scannen und Navigieren ist.

#### `rights`

`rights` bleibt auf der Übersichtsroute und bleibt tabellarisch, wird aber an den Waste-Standard angeglichen:

- saubere Tabellenhülle mit `caption` und `aria-label`
- konsistente Zellabstände und Zeilenstruktur
- stabile Spaltenreihenfolge für Aktion, Bereich, Ressourcentyp, Ressourcen-ID, Organisation, Effekt, Scope, Rollenquellen, Gruppenquellen und Herkunft
- visuell konsistente Badge-/Statusdarstellungen dort, wo Status- oder Herkunftssignale kompakt dargestellt werden

#### `governance`

`governance` wird von Kartenliste auf Tabelle umgestellt. Zielspalten:

- Titel
- Typ
- Status
- Ziel
- Ticket
- erstellt am
- Aktionen

Die bisherige Auswahl eines Elements innerhalb derselben Seite entfällt. Zeilenaktionen oder Zeilenklick führen auf die separate Detailroute.

#### `dsr`

`dsr` wird analog von Kartenliste auf Tabelle umgestellt. Zielspalten:

- Titel
- Typ
- Status
- betroffene Person
- Antragsteller
- erstellt am
- Aktionen

Auch hier ersetzt die Navigation auf eine Detailseite die bisherige Inline-Auswahl.

## Detailseiten

### Governance-Detail

Die Zielroute `/admin/iam/governance/:caseId` ist eine eigenständige IAM-Detailseite. Sie enthält:

- Rücknavigation zur Governance-Übersicht
- Kopfsektion mit Titel, Status, Typ, Ziel, Actor, Ticket und Zeitstempeln
- strukturierte Inhaltsblöcke für Zusammenfassung, Metadaten und weitere Kontextinformationen

Die Seite soll keine bloße Reproduktion der bisherigen Detailkarte sein, sondern eine klar lesbare Detailansicht mit Raum für spätere Standardaktionen und Audit-bezogene Erweiterungen.

### DSR-Detail

Die Zielroute `/admin/iam/dsr/:caseId` folgt demselben Seitenmuster. Sie enthält:

- Rücknavigation zur DSR-Übersicht
- Kopfsektion mit Titel, Status, Typ, betroffener Person, Antragsteller und Zeitstempeln
- strukturierte Inhaltsblöcke für Fallkontext, Metadaten und referenzierende Informationen

### Gestaltungsprinzip

Die Detailseiten sind keine Overlays und keine Seitenleiste, sondern eigene Arbeitsflächen. Die Übersicht bleibt dadurch ein Listenwerkzeug, die Detailseite ein Kontext- und Bearbeitungsraum. Dieses Muster ist ausdrücklich als späterer globaler Standard gedacht.

## Datenfluss

### Übersicht

- `rights` lädt weiter tab-gebunden auf `/admin/iam`
- `governance` lädt auf der Übersichtsseite nur die Listen-/Tabellendaten
- `dsr` lädt auf der Übersichtsseite nur die Listen-/Tabellendaten

### Details

`governance`- und `dsr`-Detailseiten lösen den Datensatz über `caseId` auf. Technisch gilt:

- wenn ein dedizierter Detail-Loader oder Einzel-Endpunkt vorhanden ist oder mit vertretbarem Aufwand ergänzt werden kann, ist das die bevorzugte Lösung
- falls kurzfristig nur Listenendpunkte vorhanden sind, darf die erste Iteration kontrolliert auf bestehende Datenstrukturen aufsetzen, solange Routing, UI-Trennung und Erweiterbarkeit nicht kompromittiert werden

Die technische Implementierung darf pragmatisch sein, die Ziel-UI-Architektur ist jedoch fest: Übersicht und Detail sind getrennte Seiten.

## Komponenten- und Strukturfolgen

- Die bestehende `-iam-page.tsx` soll von Inline-Detaillogik entlastet werden
- Tabellen- und Tab-Muster sollen möglichst aus bestehenden UI-Bausteinen oder etablierten Projektmustern zusammengesetzt werden
- Neue Detailrouten sollen typsicher im bestehenden Routing-System modelliert werden
- Falls nötig, dürfen neue kleinere Komponenten für Tabellenkopf, Zeilen, Detail-Header und Rücknavigation entstehen

Neue Core- oder Plugin-unabhängige Muster, die sich als globaler Standard eignen, sollen so benannt und geschnitten werden, dass spätere Wiederverwendung in anderen Bereichen möglich ist.

## Barrierefreiheit

Die Umstellung muss WCAG-konform bleiben und die bestehenden Projektregeln einhalten:

- Tabs mit semantisch korrekter Navigation
- mobile alternative Tab-Auswahl über `Select`
- Tabellen mit `caption`, Spaltenköpfen und klaren Fokuszielen
- Detailseiten mit eindeutiger Überschriftenstruktur
- Links oder Buttons zur Detailnavigation müssen per Tastatur eindeutig erreichbar sein

## Tests

Die Umsetzung soll mindestens folgende Testtypen abdecken:

- Routing-Tests für die neuen Governance- und DSR-Detailrouten
- Komponententests für die IAM-Tab-Darstellung im Waste-Stil
- Komponententests für Tabellenköpfe und repräsentative Zellinhalte in `rights`, `governance` und `dsr`
- Regressionstests, dass `governance` und `dsr` nicht mehr als Kartenlisten mit Inline-Details gerendert werden
- Navigationstest Übersicht → Detailseite → Rückweg zur passenden Übersicht

Bestehende IAM-Tests sollen bevorzugt angepasst statt dupliziert werden.

## Nicht-Ziele

- kein vollständiger fachlicher Umbau der IAM-Datenmodelle
- keine Verpflichtung, in diesem Schritt alle anderen IAM-Tabs in eigene Seiten zu überführen
- keine Einführung einer zweiten, konkurrierenden Tabellen- oder Detailseitenlogik neben dem neuen Standard

## Empfehlung für die Umsetzung

Die Umsetzung soll mit minimalem funktionalem Risiko, aber mit klarer Zielarchitektur erfolgen:

1. Tab-Darstellung und gemeinsame Panel-Hülle an Waste angleichen.
2. `governance` und `dsr` auf Tabellenübersichten umstellen.
3. Separate Detailrouten für `governance` und `dsr` einführen.
4. `rights` visuell und strukturell auf denselben Standard anheben.

So entsteht ein direkt nutzbarer Standard für spätere globale Übernahmen in weiteren Admin- und Plugin-Bereichen.
