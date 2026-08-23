## Context

Die kanonische Inhaltsübersicht unter `/admin/content` verarbeitet bereits den normalisierten Search-Parameter `type` und reicht ihn an die führende serverseitige Listenquelle weiter. Registrierte Studio-Inhaltstypen enthalten lokalisierbare Bezeichnungen, Read-Actions sowie Erstellungs- und Detailpfade. Die Sidebar unterstützt bereits zugängliche Gruppen in Desktop-, Collapse- und Mobile-Darstellung, wertet aktive Links bisher aber im Wesentlichen anhand des Pfads aus.

## Goals / Non-Goals

- Goals:
  - Direkte, berechtigungsabhängige Einstiege in alle lesbaren Inhaltstypen anbieten.
  - Eine einzige kanonische Inhaltsliste und ihre serverseitige Filterung beibehalten.
  - Nachrichten und Veranstaltungen als häufige Typfilter mit einem Klick erreichbar machen.
  - Aktive Zustände in normaler, eingeklappter und mobiler Navigation eindeutig halten.
- Non-Goals:
  - Keine neuen typspezifischen Listenrouten oder parallelen Datenquellen.
  - Keine Änderung an Inhaltstyp-Registrierung, IAM-Modell, API oder Projektion.
  - Keine Neugestaltung der Tabellen-, Status- oder Sortierlogik.

## Decisions

### Eine Route mit kanonischem Search-Parameter

`Alle` verweist auf `/admin/content` ohne Typfilter. Jeder typspezifische Unterpunkt verweist auf dieselbe Route mit dem registrierten `contentType` als `type`-Search-Parameter. Ungültige Typwerte fallen weiterhin über die bestehende Normalisierung auf `all` zurück.

Alternativen:

- Statische Unterrouten wie `/admin/content/news` wurden verworfen, weil sie zusätzliche Route-, Redirect- und Guard-Verträge ohne fachlichen Mehrwert erzeugen.
- Eigene Plugin-Listen wurden verworfen, weil sie die gemeinsame führende Listenquelle und konsistente globale Filterung aufbrechen würden.

### Menüeinträge aus registrierten, lesbaren Inhaltstypen

Die Sidebar leitet die Unterpunkte aus der registrierten Studio-Content-Type-Metadatenmenge ab. Sie zeigt nur Typen, deren vollständig qualifizierte Read-Action im aktuellen Kontext gewährt ist und deren Modulzuweisung erfüllt ist. Bezeichnungen werden über die vorhandenen Plugin-Übersetzungen aufgelöst. Die Reihenfolge folgt der stabilen Registry-Reihenfolge; `Alle` steht immer zuerst.

### Eindeutiger aktiver Zustand

Die Sidebar berücksichtigt für die Content-Gruppe neben dem Pfad den normalisierten `type`-Search-Parameter:

- ohne Typfilter ist nur `Alle` aktiv;
- mit gültigem Typfilter ist nur der entsprechende Typ aktiv;
- auf einem registrierten typbezogenen Create- oder Detailpfad bleibt der zugehörige Typ aktiv und die Gruppe geöffnet;
- ein nicht zuordenbarer Content-Pfad aktiviert die Gruppe, aber keinen falschen Typ-Unterpunkt.

### Schnellfilter und Dropdown ohne Duplikate

Die Toolbar zeigt zugängliche Schnellfilter für `Alle`, Nachrichten und Veranstaltungen. Ein Schnellfilter wird nur angezeigt, wenn der jeweilige Typ lesbar ist; `Alle` bleibt verfügbar. Das Dropdown enthält ausschließlich die übrigen lesbaren Typen. Ist einer dieser Typen aktiv, zeigt das Dropdown dessen Auswahl; bei `Alle`, Nachrichten oder Veranstaltungen zeigt es den neutralen Zustand für weitere Typen.

Jeder Typwechsel setzt `page` auf `1`. `status`, `sort`, `sortDirection` und `pageSize` bleiben erhalten. Filterzustände bleiben teilbar und reload-stabil in der URL.

### Accessibility und Responsive-Verhalten

Die bestehende Sidebar-Gruppe mit `Collapsible`, Flyout und mobilem `Sheet` bleibt die Interaktionsbasis. Schnellfilter sind echte Buttons oder gleichwertige Design-System-Primitives mit eindeutigem zugänglichem Namen und erkennbarem ausgewähltem Zustand. Fokus, Tastaturbedienung und Screenreader-Semantik werden durch Tests abgesichert.

## Risks / Trade-offs

- Viele aktivierte Inhaltstypen verlängern das Untermenü. Die bestehende scrollbare Sidebar und das Collapse-Flyout begrenzen das Layout-Risiko; ein weiteres Gruppierungsniveau ist nicht Teil dieses Changes.
- Pfad- und Search-Param-Aktivität erhöhen die Zustandslogik der Sidebar. Die Logik wird in kleinen, rein ableitenden Helfern gekapselt und separat getestet.
- Ein Benutzer kann eine gespeicherte URL mit inzwischen entzogenem Typrecht öffnen. Die vorhandene lesbare Typmenge und serverseitige Autorisierung bleiben maßgeblich; der Typ erscheint dann weder als Menüeintrag noch als auslesbarer Tabellenbestand.

## Migration Plan

Die Änderung ist rein additiv auf der bestehenden Route. Vorhandene Links auf `/admin/content` und bestehende URLs mit `type` bleiben gültig. Ein Rollback stellt den bisherigen einzelnen Sidebar-Link und das bisherige Dropdown wieder her; Datenmigrationen sind nicht erforderlich.

## Open Questions

Keine.
