# Waste-Management Tabellen-Design

**Ziel**

Die listenartigen Übersichtsansichten im Waste-Management werden konsequent als Tabellen dargestellt. Card-basierte Mehrfachlisten gelten für diese Domäne nicht mehr als Standard. Dieselbe Regel wird als UI-Default für weitere Plugins und Übersichtsseiten übernommen.

**Entscheidung**

- Primäre Übersichtsseiten mit mehreren gleichartigen Datensätzen werden als Tabellen gerendert.
- Cards bleiben für Detailzustände, Dialoge, kompakte KPI-Zusammenfassungen und stark visuelle Inhalte erlaubt.
- Im Waste-Management betrifft die Umstellung die Ansichten `Touren`, `Ausweichtermine` und `Historie/Overview`.
- Die bestehende Standorte-Tabelle bleibt Referenz für Dichte, Beschriftung und Interaktionsmuster.

**Architektur**

Die betroffenen Waste-Komponenten bleiben fachlich getrennt, wechseln aber von frei gestalteten Kartenlisten auf ein einheitliches Tabellenlayout mit Tabellenkopf, Zeilenaktionen, leeren Zuständen und kompakten Metadaten oberhalb der Tabelle. Wo bereits Projektmuster existieren, werden diese bevorzugt wiederverwendet; ansonsten wird ein barrierefreies HTML-Tabellenmuster im Plugin genutzt.

**Tabellenregeln**

- Jede Übersichts-Tabelle erhält ein `aria-label` und eine `caption`.
- Spalten benennen stabile Vergleichsdimensionen wie Name, Status, Datum, Typ, ID und Aktionen.
- Zeilenaktionen bleiben direkt an der jeweiligen Zeile verankert.
- Badge-basierte Statussignale sind erlaubt, aber nicht als Ersatz für Spaltenstruktur.
- Leere Zustände bleiben außerhalb oder unterhalb der Tabelle klar lesbar.
- Tests prüfen mindestens Tabellenrolle bzw. Spaltenköpfe und repräsentative Zellinhalte.

**Waste-spezifische Umsetzung**

- `Touren`: eine Tabelle mit Tourname, Status, Rhythmus, Fraktionen, Abholorten, Zeitraum, ID und Aktionen.
- `Ausweichtermine`: je eine Tabelle für globale und tourbezogene Verschiebungen mit Originaltermin, Zieltermin, Grund, Kontextinformationen und Aktionen.
- `Historie`: tabellarische Darstellung für technische und Audit-Ereignisse mit Ereignistyp/Aktion, Ergebnis, Zeitpunkt und referenzierenden Metadaten.

**Folgen für andere Plugins**

Die neue Default-Regel für Übersichtsseiten lautet: Wenn Benutzerinnen und Benutzer Datensätze vergleichen, filtern, suchen oder stapelweise bearbeiten, ist eine Tabelle die Standarddarstellung. Neue Plugin-Ansichten sollen sich daran orientieren; Card-Listen für Massenübersichten gelten als Ausnahme und müssen künftig begründet werden.

**Tests**

- Bestehende Waste-Komponententests werden auf Tabellenköpfe und Zeileninhalte erweitert.
- Die Umstellung wird mit gezielten Vitest-Läufen für die betroffenen Komponenten verifiziert.

