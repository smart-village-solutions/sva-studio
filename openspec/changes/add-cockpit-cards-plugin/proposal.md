# Change: Eigenständiges Cockpit-Cards-Plugin ergänzen

## Warum

Cockpit Cards benötigen im Studio eine schlanke, fachlich eindeutige Redaktionserfahrung. Das offene Generic-Items-Plugin stellt dafür zu viele fachfremde Felder bereit; das FAQ-Plugin ist strukturell passend, kennt jedoch weder Kategorien, Bilder noch einen weiterführenden Link.

## Was sich ändert

- Ein neues eigenständiges `@sva/plugin-cockpit-cards` folgt dem Fachplugin-Muster von FAQ und wird über die gemeinsame Inhaltsübersicht erreichbar.
- Cockpit Cards werden als `GenericItem` mit dem unveränderlichen Diskriminator `genericType: "COCKPIT_CARD"` gespeichert und als `cockpit-cards.cockpit-card` projiziert.
- Das Fachmodell umfasst Überschrift, Nur-Text-Inhalt, Sprachcode, genau eine bestehende Mainserver-Kategorie, mindestens ein Bild, höchstens einen HTTPS-Link, Sortiergewicht, Sichtbarkeit und Veröffentlichungszeitpunkt.
- Der Tab `Inhalt` enthält gemeinsam den Text und die Bilder. Es gibt keinen separaten Medien-Tab.
- Kategorie, Bilder und Link verwenden die vorhandenen GenericItem-Felder `categories`, `mediaContents` und `webUrls`; Kategorien werden aus dem Kategorien-Plugin geladen und Bilder über die bestehende Medienauswahl beziehungsweise den bestehenden Upload zugeordnet.
- Das Plugin erhält die Actions `cockpit-cards.read`, `cockpit-cards.create`, `cockpit-cards.update` und `cockpit-cards.delete`.

## Auswirkungen

- Betroffene Spezifikationen: `content-management`, `plugin-platform`, `sva-mainserver-integration`.
- Betroffener Code: neues Workspace-Package, Plugin-Registry, Modul-IAM-Vertrag, Instanz-Bootstrap, Host-Fassade, GenericItem-Routen und Inhaltsprojektion.
- Betroffene arc42-Abschnitte: [05 Bausteinsicht](../../../docs/architecture/05-building-block-view.md), [06 Laufzeitsicht](../../../docs/architecture/06-runtime-view.md) und [08 Querschnittliche Konzepte](../../../docs/architecture/08-cross-cutting-concepts.md).

## Nicht im Scope

- Eine gemeinsame Basisklasse oder Form-Engine für FAQ und Cockpit Cards.
- Freie Kategorien, mehrere Kategorien, Nicht-Bild-Medien, mehrere Links, Rich Text, Kontakte oder Orte.
- Änderungen an öffentlichen App- oder Web-Clients.
