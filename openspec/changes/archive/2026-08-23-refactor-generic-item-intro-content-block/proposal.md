# Change: Einleitungen auf Content-Blocks umstellen

## Warum

Die Top-Level-Mutation `createGenericItem` des SVA-Mainservers akzeptiert kein Argument `teaser`. Der Studio-Vertrag modelliert dieses nicht beschreibbare Feld dennoch für GenericItems und verhindert dadurch gültige Mutationen. Der Mainserver bietet mit `ContentBlockInput.intro` bereits einen schreibbaren Vertrag für redaktionelle Einleitungen.

## Was sich ändert

- Der gemeinsame GenericItem-Vertrag entfernt `teaser` vollständig aus Query-Dokumenten, Eingaben, Ausgaben, Mappern und Feldmatrizen.
- Redaktionelle Einleitungen werden ausschließlich über `contentBlocks[].intro` gelesen und geschrieben; ein Legacy-Fallback auf Top-Level-`teaser` findet nicht statt.
- Der offene GenericItem-Editor entfernt das separate Teaser-Feld und verwendet die bereits vorhandenen `intro`-Felder der einzelnen Content-Blocks.
- Featured Projects bilden `Description` auf `contentBlocks[0].intro` und `FullText` auf `contentBlocks[0].body` ab. Weitere Content-Blocks und fachfremde Bestandsfelder bleiben bei Updates erhalten.
- FAQ und Cockpit Cards behalten ihre bestehenden Body-Verträge. Sie erzeugen keine künstliche Einleitung.
- News verwenden für Einleitung und Inhalt ausschließlich `contentBlocks[].intro/body`; `payload.teaser/body` werden weder gelesen noch als Fallback übernommen.

## Auswirkungen

- Betroffene Spezifikationen: `content-management`, `sva-mainserver-integration`.
- Betroffener Code: `@sva/sva-mainserver`, `@sva/plugin-generic-items`, `@sva/plugin-news`, Featured-Projects-Adapter, IAM-Payload-Validierung sowie zugehörige Tests.
- Betroffene arc42-Abschnitte: [05 Bausteinsicht](../../../docs/architecture/05-building-block-view.md), [06 Laufzeitsicht](../../../docs/architecture/06-runtime-view.md) und [08 Querschnittliche Konzepte](../../../docs/architecture/08-cross-cutting-concepts.md).

## Nicht im Scope

- Migration oder Übernahme historischer Top-Level-`teaser`-Werte.
- Änderungen am externen SVA-Mainserver-Schema.
- Eine neue gemeinsame Form-Engine für GenericItem-Fachplugins.
