# Change: Kategorieauswahl nach Content-Typ filtern

## Why

News-, Event- und POI-Editoren laden derzeit dieselbe ungefilterte Liste aktiver Mainserver-Kategorien. Dadurch bietet das Studio Kategorien an, deren `dataTypes` nicht zum bearbeiteten Content-Typ passen, obwohl der vorhandene Mainserver-Lesevertrag die Datentypen bereits ausliefert.

Der Change verbessert bewusst nur den regulären Studio-Workflow. Ohne Mainserver-Anpassung ist die Filterung keine systemweite Datenintegritätsregel: manipulierte Requests, direkte Mainserver-Clients und spätere Änderungen an Kategorie-Datentypen bleiben außerhalb dieser Zusicherung.

## What Changes

- News-, Event- und POI-Editoren laden aktive Kategorien mit einem festen kanonischen Datentypfilter:
  - News: `news_item`
  - Events: `event_record`
  - POI: `point_of_interest`
- Eine Kategorie ohne `dataTypes` gilt für alle Content-Typen. Bei einem oder mehreren `dataTypes` gilt sie für jeden exakt aufgeführten Typ.
- Die bestehende Active-only-Kategorienroute des Studios erhält einen validierten optionalen `dataType`-Parameter. Sie lädt die aktiven Kategorien einmalig mit `dataTypes` und filtert sie in der Studio-Fassade nach `dataTypes.length === 0 || dataTypes.includes(dataType)`.
- Ohne `dataType` bleibt der bestehende Vertrag unverändert. Ungültige Filterwerte werden im Studio abgelehnt.
- Schlägt das Laden oder Validieren der Kategoriedaten fehl, zeigt der Editor keine ungefilterte Ersatzliste an.
- Bereits am Content gespeicherte, im gefilterten Katalog fehlende Kategorien bleiben sichtbar und entfernbar, werden aber nicht erneut angeboten.
- Es sind weder Code-, Schema- noch Deployment-Anpassungen am Mainserver erforderlich.

## Non-Goals

- Keine serverseitige oder anderweitig nicht umgehbare Durchsetzung der Kategorie-Datentyp-Kompatibilität.
- Keine Änderung der Mainserver-Content-Mutationen, der namensbasierten Kategorienauflösung oder der impliziten Kategorieanlage.
- Kein Blockieren der Entfernung verwendeter Datentypen in der Kategorienverwaltung.
- Kein Bestandsaudit, keine Datenbereinigung und keine automatische Reparatur historischer Zuordnungen.
- Keine Umstellung der Content-Mutationen auf Kategorie-IDs.
- Keine Erweiterung auf Tours, Generic Items oder weitere Content-Typen.
- Keine neue Registry, kein neues Package, kein neuer Service und kein zweiter Kategorien-Endpunkt.
- Keine Studio-Datenbankschemaänderung.

## Dependencies

- Der Ziel-Mainserver muss im bereits vorhandenen Kategorien-Read das bestehende Feld `dataTypes` liefern; dieser Change erweitert den Mainserver-Vertrag nicht.
- Der Change ist nicht von Mainserver-Schreiblogik oder einer Mainserver-Bereitstellung abhängig.

## Impact

- Affected specs: `content-management`, `sva-mainserver-integration`
- Affected code: `packages/plugin-news`, `packages/plugin-events`, `packages/plugin-poi` und das Studio-Integrationspackage `packages/sva-mainserver`
- Affected external systems: keine Codeänderung am Mainserver; ausschließlich Nutzung seines bestehenden GraphQL-Lesevertrags
- Affected docs: Nutzerhinweise zur gefilterten Kategorieauswahl, sofern die vorhandene Bedienungsdokumentation diesen Bereich beschreibt
- Affected arc42 sections: keine; der vorhandene Plugin-, Host-Fassaden- und Mainserver-Read-Pfad bleibt unverändert
- Database impact: keine
- ADR impact: keine neue Architekturentscheidung
