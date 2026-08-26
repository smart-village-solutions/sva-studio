# Dossier 2: Inhalte verwalten

## Nutzerreise

Die gemeinsame Inhaltsliste bündelt generische und plugin-spezifische Inhalte. Beim Anlegen wird
zuerst ein im aktuellen Kontext erlaubter Inhaltstyp gewählt. Danach führt der jeweilige Editor
durch die fachlichen Felder. Bearbeitbarkeit hängt sowohl von Listenrechten als auch vom konkreten
Ressourcenprincipal ab.

## `content.list` – Inhalte verwalten

- **Route / Typ / Owner:** `/admin/content`, Liste, Host.
- **Nutzerziel:** Inhalte finden, ihren Zustand beurteilen und eine zulässige Aktion starten.
- **Produktfakten:** Suche erfasst Überschrift, Autor und Inhaltstyp. Zusätzlich bestehen Typ-,
  Sprach- und Statusfilter. Die Liste unterstützt Sortierung nach Titel sowie Veröffentlichungs-,
  Erstellungs- und Änderungsdatum, Pagination und Statusdarstellung. Archivieren und Löschen
  wirken in der aktuellen Oberfläche ausschließlich auf die explizit ausgewählten Inhalte;
  Aktionen für die gesamte aktuelle Seite oder alle Filtertreffer werden nicht angeboten.
- **Kontextabhängig:** Einträge können bearbeitbar, nur lesbar, gesperrt oder serverseitig
  verweigert sein. Während Mainserver-Synchronisation kann die Liste einen letzten Stand oder eine
  nur lokal vollständige Teilmenge zeigen.
- **Redaktionelle Leitfragen:** Worauf beziehen sich Filter, Sortierung und Trefferzahl? Warum ist
  ein Eintrag nur lesbar? Welche Wirkung haben Bulk-Archivierung und Löschen?
- **Stichwörter / Querverweise:** Inhaltsliste, Suche, Filter, Status, Sortierung, Pagination,
  Archivieren; weiter zu Inhalt anlegen oder bearbeiten.
- **Evidenz:** `routing/admin-resources.ts`, `routes/content/-content-list-page.tsx`,
  `i18n/resources/de/content.resources.ts`.

## `content.create` – Inhalt anlegen

- **Route / Typ / Owner:** `/admin/content/new`, Anlegen, Host.
- **Nutzerziel:** Einen erlaubten Inhaltstyp auswählen und dessen Erstellungsseite öffnen.
- **Produktfakten:** Die Seite ist zunächst eine Typauswahl. Sie zeigt nur Inhaltstypen, die im
  aktuellen Kontext tatsächlich angelegt werden dürfen, und leitet anschließend in den
  zugehörigen Host- oder Plugin-Editor weiter. Fehlt ein anlegbarer Typ, erscheint ein eigener
  Leerzustand.
- **Kontextabhängig:** Sichtbare Typen hängen von Plugin, Modul, Berechtigungen und Principal ab.
  Einige generische Inhalte können direkt im gemeinsamen Editor landen.
- **Redaktionelle Leitfragen:** Welcher Inhaltstyp passt zur Aufgabe? Warum fehlt ein Typ? Was ist
  vor dem Wechsel in den Fach-Editor noch nicht angelegt?
- **Stichwörter / Querverweise:** Neuer Inhalt, Inhaltstyp, Typauswahl, Erstellungsrecht; weiter zu
  Nachrichten, Veranstaltungen, Orten, Umfragen und generischen Inhalten.
- **Evidenz:** `routes/content/-content-type-picker-page.tsx`,
  `i18n/resources/de/content.resources.ts`.

## `content.detail` – Inhalt bearbeiten

- **Route / Typ / Owner:** `/admin/content/$id`, Detail, Host.
- **Nutzerziel:** Kernmetadaten eines generischen Inhalts prüfen und bearbeiten.
- **Produktfakten:** Der allgemeine Bereich umfasst Überschrift, Typ, Status,
  Veröffentlichungsdatum und freie JSON-Zusatzdaten. Metadaten wie Autor, ID sowie Erstellungs- und
  Änderungszeit werden angezeigt. Nach dem ersten Speichern zeigt die Historie automatisch
  protokollierte Änderungen mit Aktion, Zeitpunkt, handelnder Person, Zusammenfassung und
  betroffenen Feldern. Eine Revisionsauswahl oder Wiederherstellung früherer Revisionen bietet der
  aktuelle Editor nicht an.
- **Validierung:** Überschrift ist Pflicht. Zusatzdaten müssen gültiges JSON sein. Veröffentlichte
  Inhalte benötigen ein gültiges Veröffentlichungsdatum in der Fachzeitzone Europe/Berlin.
- **Kontextabhängig:** Felder und Speichern bleiben bei nur lesbarem oder ungeklärtem Principal
  deaktiviert. Statuswechsel können über einen eigenen Dialog erfolgen. `content.restore`
  autorisiert dabei den Statuswechsel eines archivierten Inhalts zurück in einen anderen
  Lebenszyklusstatus; die Action stellt keine frühere Revision wieder her.
- **Redaktionelle Leitfragen:** Wann genügt der generische Editor und wann sollte der Fach-Editor
  verwendet werden? Welche Änderungen zeigt die Historie? Was bedeutet „Wiederherstellen“ beim
  Statuswechsel eines archivierten Inhalts?
- **Stichwörter / Querverweise:** Metadaten, JSON, Veröffentlichungsdatum, Historie, Statuswechsel,
  archivierter Inhalt; zurück zur Inhaltsliste.
- **Evidenz:** `routes/content/-content-editor-page.tsx`,
  `routes/content/-content-status-dialog.tsx`,
  `packages/plugin-sdk/src/standard-content-access.ts`.
