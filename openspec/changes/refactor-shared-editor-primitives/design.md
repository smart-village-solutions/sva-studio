## Context

Mit `update-poi-editor-full-redaction-flow` wurde ein vollständiger redaktionsorientierter POI-Editor ausgeliefert. Dabei wurde bereits entschieden, dass mehrere UI-Muster eigentlich hostweit oder paketweit wiederverwendbar sein sollten, die erste Delivery aber zugunsten eines klaren fachlichen Schnitts nur den unmittelbaren Produktnutzen absichert.

In der Codebasis zeigt sich das aktuell an drei typischen Mustern:

- pluginlokale Abschnittskarten wie `PoiDetailSectionCard`
- pluginlokale `useFieldArray`-basierte Listenbereiche für Links, Öffnungszeiten, Preise, Zertifikate oder Medien
- wiederkehrende Formularflächen mit ähnlicher Fehler-, Titel- und Aktionsstruktur

`StudioDetailTabs` ist bereits in `packages/studio-ui-react` angekommen und dient damit als Ausgangspunkt für den nächsten Konsolidierungsschritt.

## Goals / Non-Goals

- Goals:
  - Ownership für wiederkehrende Detaileditor-UI in gemeinsame, hosteigene Primitives verschieben
  - POI und mindestens ein zweiter Editor sollen dieselben neuen UI-Bausteine real nutzen
  - Plugin-spezifische Fachlogik von allgemeinen Formular- und Layoutmustern trennen
  - die Review- und Änderungsfläche für künftige Content-Editoren verkleinern
- Non-Goals:
  - keine neue fachliche Erweiterung des POI- oder News-Datenmodells
  - keine generische Abstraktion ohne nachgewiesene Mehrfachnutzung
  - keine Verlagerung von Mainserver-, Mapping- oder Validierungslogik aus den Fachplugins
  - kein Komplettumbau aller Content-Plugins in einem Schritt

## Decisions

- Decision: Extrahiert werden nur Primitives mit nachgewiesener Mehrfachnutzung oder klarer unmittelbarer Zweitnutzung.
  - Rationale: Der Change soll Ownership reduzieren, nicht abstrakte UI-Baukästen ohne reale Verwendung schaffen.

- Decision: `studio-ui-react` bleibt der Zielort für hosteigene Editor-Primitives.
  - Rationale: Dort liegen bereits `StudioDetailTabs`, `StudioFormSummaryErrors` und weitere gemeinsame Studio-Oberflächen.

- Decision: Repeater-Primitives bleiben klein und RHF-kompatibel, aber nicht vollständig datenmodell-agnostisch um jeden Preis.
  - Rationale: Zu generische Abstraktionen würden die lokalen Plugins in indirekte APIs zwingen und die Wartung verschlechtern.

- Decision: Karten- und adressnahe UI werden nur dann extrahiert, wenn sich ihre Verantwortung sauber von POI-spezifischen Geschäftsregeln trennen lässt.
  - Rationale: Die jetzige POI-Kartenintegration ist fachlich funktionsfähig, aber nicht jede ihrer Regeln ist schon hostweit.

## Candidate Extractions

### Nach `studio-ui-react`

- generische Detail-Section-Card für Titel, Beschreibung, optionalen Aktionsslot und Inhaltsfläche
- kleine Repeater-/List-Section-Primitives für `useFieldArray`-basierte Mehrfacheinträge
- gemeinsame Formularsektionen für strukturierte Editorbereiche, soweit sie nicht POI- oder News-spezifisch sind
- optional adress-/kartennahe Form-Primitives nur mit klar getrennter Verantwortung

### In den Plugins verbleibend

- fachliche Feldmodelle, Defaultwerte und RHF-Namenspfade
- Mapping, Validierung und Save-Logik
- plugin- und domänenspezifische Labels, Fehlertexte und Geschäftsregeln
- provider- oder hostgebundene Geocoding-/Mainserver-Verträge

## Risks / Trade-offs

- Zu frühe Generalisierung kann indirekte APIs schaffen, die weniger wartbar sind als der Istzustand.
- Zu spätes Extrahieren hält Ownership-Schuld unnötig lange in `plugin-poi` fest.
- Die wichtigste Gegenmaßnahme ist, jede Extraktion sofort gegen mindestens zwei reale Editorverwendungen und bestehende Tests zu härten.

## Migration Plan

1. Bestehende POI- und News-Section-/Repeater-Muster systematisch gegeneinander schneiden.
2. Neue gemeinsame UI-Primitives in `studio-ui-react` einführen und dort isoliert testen.
3. Zuerst `plugin-poi`, dann einen zweiten Referenzeditor wie `plugin-news` auf die neuen Bausteine umstellen.
4. Lokale Rest-Helfer nur dann behalten, wenn sie fachlich begründet plugin-spezifisch sind.

## Open Questions

- Welche adress- oder kartenbezogenen Teilflächen sind stabil genug für eine Extraktion im selben Change?
- Reicht POI plus News als Zweitnutzung für die Repeater-Primitives aus, oder ist ein dritter Referenzeditor nötig?
