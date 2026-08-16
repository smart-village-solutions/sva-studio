## Context

Der Tour-Zuordnungsdialog erhält bereits die vollständige relevante Abholortmenge als `TourAssignmentLocationOption[]`. Suche und Hierarchiefilter werden lokal angewendet. Die Zeilen zeigen bisher eine zusammengesetzte Bezeichnung wie `Amt Meyenburg / Brügge / Alle Straßen / Alle Hausnummern` sowie eine zweite, teilweise redundante Hierarchiezeile.

Die Stammdatenansicht der Abholorte besitzt bereits eine tabellarische Darstellung mit getrennten Spalten für Region, Ort, Straße und Hausnummer sowie kontrollierter Mehrfachauswahl. `StudioDataTable` bietet zwar ein gemeinsames Tabellenlayout und Client-Sortierung, verwaltet die Zeilenauswahl jedoch intern. Der Tour-Zuordnungsdialog benötigt einen extern kontrollierten Auswahlzustand, weil vorbestehende Zuordnungen beim Öffnen ausgewählt sein müssen und gefilterte beziehungsweise außerhalb des Filters liegende Auswahlen gemeinsam gespeichert werden.

## Goals / Non-Goals

- Goals:
  - getrennte, fachlich benannte Adressspalten,
  - interaktive Sortierung der vollständigen gefilterten Abholortmenge,
  - Erhalt der ausgewählten Gruppe am Tabellenanfang,
  - visuelle Einheitlichkeit mit der bestehenden Abholorte-Tabelle,
  - zugängliche Sortier- und Auswahlbedienung auf breiten und schmalen Ansichten.
- Non-Goals:
  - serverseitige Sortierung oder Pagination im Dialog,
  - Erweiterung der zentralen `StudioDataTable` um kontrollierte Auswahl,
  - Refactoring der bestehenden Abholorte-Stammdatentabelle,
  - Änderung des Speichervertrags für Tour-Zuordnungen.

## Decisions

### Fokussierte Dialogtabelle mit bestehenden Waste-Tabellenkonventionen

Der Dialog erhält eine kleine, fachbezogene Tabellenansicht. Kopfzeilen, Sortierbuttons, Symbole, Auswahl-Checkboxen, Tabellenfarben und responsive Abstände orientieren sich an der vorhandenen Abholorte-Stammdatentabelle. Gemeinsame Design-System-Komponenten werden wiederverwendet; es entsteht keine neue allgemeine Tabellenabstraktion.

Die zentrale `StudioDataTable` wird nicht erweitert. Eine kontrollierte Auswahl-API wäre eine Workspace-weite Vertragsänderung und würde den Scope für einen einzelnen Dialog unverhältnismäßig vergrößern.

### Getrenntes Optionsmodell für alle sichtbaren Fachwerte

`TourAssignmentLocationOption` führt zusätzlich Hausnummer-ID und Hausnummerbezeichnung. `label` bleibt als vollständige zugängliche Bezeichnung und für die Freitextsuche erhalten. Die Tabelle rendert die Werte für Region, Ort, Straße und Hausnummer jedoch ausschließlich in ihren jeweiligen Spalten.

Fehlende Straße beziehungsweise Hausnummer verwenden dieselben lokalisierten Fallbacks wie die Stammdatenansicht (`Alle Straßen`, `Alle Hausnummern`). Fehlende Region oder Ort verwenden die bestehenden Nicht-verfügbar-Texte.

### Filterung vor gruppierter Client-Sortierung

Der Dialog arbeitet auf der vollständig geladenen Client-Menge. Die Verarbeitung lautet:

1. Hierarchie- und Freitextfilter anwenden,
2. in ausgewählte und nicht ausgewählte Abholorte gruppieren,
3. beide Gruppen nach der aktiven Spalte und Richtung sortieren,
4. bei gleichen Fachwerten die verbleibenden Adresswerte, Bezeichnung und ID als stabile aufsteigende Tie-Breaker verwenden.

Die Standardsortierung ist `Region` aufsteigend. Erneutes Aktivieren derselben Kopfzeile wechselt zwischen auf- und absteigend. Beim Wechsel der Spalte startet die Sortierung aufsteigend. Leere beziehungsweise nicht verfügbare Werte stehen in beiden Richtungen nach vorhandenen Werten.

### Auswahl bleibt kontrolliert

Die erste Spalte enthält die bestehende kontrollierte Checkbox. Die Kopf-Checkbox wählt weiterhin alle gefilterten Abholorte aus oder ab. Eine zusätzliche Statusspalte wird nicht angezeigt: Der Haken ist der maßgebliche sichtbare Zuordnungszustand; der Aktivstatus eines Abholorts ist für diese Pflegeaufgabe nicht relevant.

Auf schmalen Ansichten werden dieselben Fachwerte in einer beschrifteten, gestapelten Zeilendarstellung ausgegeben. Sortierfeld und -richtung bleiben dort bedienbar, ohne die Tabellenkopfzeile vorauszusetzen.

## Risks / Trade-offs

- Die fokussierte Tabelle teilt visuelle Konventionen, aber keinen abstrahierten Implementierungskern mit der Stammdatentabelle. Das vermeidet eine riskante zentrale Vertragsänderung, lässt jedoch geringe lokale Duplizierung bestehen.
- Ausgewählte Einträge bleiben auch bei einer absteigenden Spaltensortierung vor nicht ausgewählten Einträgen. Das weicht von einer rein globalen Spaltensortierung ab, bewahrt aber den bestehenden fachlichen Auswahlvertrag.
- Zusätzliche responsive Sortiersteuerelemente erhöhen den Testumfang, verhindern jedoch, dass Sortierung nur visuell über Desktop-Tabellenköpfe erreichbar ist.

## Verification

- View-Model-Tests für alle Sortierfelder, beide Richtungen, leere Werte, Gruppierung und stabile Tie-Breaker.
- Dialogtests für getrennte Zellen, Sortierinteraktion, Filterung, Auswahl außerhalb des Filters und Submit-Payload.
- Gezielter Nx-Unit-Test des Waste-Plugins sowie passender Type-Check.
- Strikte OpenSpec- und File-Placement-Validierung.
