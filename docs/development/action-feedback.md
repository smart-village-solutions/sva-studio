# Kontextgebundenes Aktionsfeedback

## Ziel und Abgrenzung

Studio stellt dauerhafte Ergebnisse dort dar, wo die bearbeitete Ressource oder der gestartete Job weiterhin nachvollziehbar ist. Normale Speichervorgänge, destruktive Aktionen und langlebige Jobs besitzen getrennte Verträge. Es gibt keine globale Outcome-Registry und keine pluginlokale Toast-Infrastruktur.

Destruktive Aktionen haben ausdrücklich kein Undo. Ein fachlich vorhandener Restore-Pfad ist eine neue, separat autorisierte Aktion und keine zeitlich begrenzte Rücknahme einer Löschung.

## Inventur destruktiver und hochwirksamer Aktionen

Die Inventur vom 25. August 2026 gruppiert gleichartige Oberflächen. Serverseitige Repository-Löschungen ohne direkte Benutzerinteraktion sind über ihren aufrufenden UI-Flow erfasst.

| Bereich                                                        | Aktion und Wirkung                                                                                          | Bestehende Bestätigung                                                   | Autorisierung                                                 | Ergebnis und Fehler                                                                                                     | Einordnung                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Host: Instanzschnittstellen                                    | Schnittstelle einschließlich gespeicherter Konfiguration löschen                                            | `StudioDestructiveActionDialog`, Zielname und endgültige Wirkung         | schnittstellenspezifische Host-Berechtigung                   | Erfolg persistent in der Schnittstellenliste; Fehler persistent im offenen Dialog                                       | Host-Referenzfluss                                                |
| Host: Inhaltsliste                                             | Einzel- und Bulk-Löschung von Mainserver-Inhalten; serverseitig Tombstone beziehungsweise Provider-Löschung | `StudioDestructiveActionDialog`, Ziel und endgültige Wirkung             | namespaced `*.delete`, Principal- und Scope-Prüfung           | Erfolg persistent in der Liste; Fehler persistent im offenen Dialog; partielle Bulk-Fehler bleiben für Retry ausgewählt | vollständig migriert                                              |
| Host: Inhaltsliste und Editor                                  | Archivieren sowie Wiederherstellen eines archivierten Inhalts                                               | Statusdialog beziehungsweise Bulk-Aktion                                 | `content.archive` beziehungsweise `content.restore`           | aktualisierter Inhaltskontext                                                                                           | Restore bleibt eigenständige Fachaktion                           |
| Host: IAM-Administration                                       | Gruppen, Rollen, Organisationen, Benutzer und Modulzuweisungen löschen oder entziehen                       | app-lokaler `ConfirmDialog`                                              | jeweilige `iam.*`- oder Instanz-Action                        | jeweiliger Detail- oder Listenkontext                                                                                   | Folgemigration auf gemeinsame Primitives                          |
| Host: Medien                                                   | Asset-Löschung bei fehlenden Referenzen und zulässigem Lifecycle                                            | fachlicher Medienkontext                                                 | `media.delete` plus Referenzprüfung                           | Medienliste oder persistenter Konflikt                                                                                  | fail-closed, keine Rücknahme                                      |
| Plugin: Veranstaltungen                                        | Mainserver-Veranstaltung endgültig löschen                                                                  | `StudioDestructiveActionDialog`, Titel und Wirkung                       | `events.delete` plus Acting-Principal                         | einmaliger Router-State zur Inhaltsliste; dort persistentes Ergebnis; Fehler im Dialog                                  | Plugin-Referenzfluss                                              |
| Plugins: News und POI                                          | Mainserver-Inhalt endgültig löschen                                                                         | `StudioDestructiveActionDialog`, Titel und endgültige Wirkung            | `news.delete` beziehungsweise `poi.delete`                    | einmaliger Router-State zur Inhaltsliste; Fehler im offenen Dialog                                                      | vollständig migriert                                              |
| Plugins: FAQ, Projekte, generische Inhalte und Cockpit-Kacheln | Inhalt endgültig löschen                                                                                    | `StudioDestructiveActionDialog`, Ziel und endgültige Wirkung             | jeweilige namespaced Delete-Action                            | einmaliger Router-State zur Inhaltsliste; Fehler im offenen Dialog                                                      | vollständig migriert                                              |
| Plugin: Umfragen                                               | Fragen oder Optionen lokal aus dem Entwurf entfernen; Umfrage serverseitig löschen oder archivieren         | gemeinsamer destruktiver Dialog für Entwurfsentfernungen                 | Editorrecht beziehungsweise `surveys.delete`/Lifecycle-Action | unmittelbar aktualisierter Entwurf beziehungsweise Host-Inhaltsliste                                                    | lokale Entwurfsaktion bleibt vom persistierten Datensatz getrennt |
| Plugin: Waste                                                  | Stammdaten, Touren, Zuordnungen, Termine und Regeln löschen; Datenbestand zurücksetzen                      | gemeinsamer destruktiver Dialog, beim Reset zusätzlich Bestätigungstoken | jeweilige `waste-management.*`-Action                         | aktualisierte Fachliste oder persistenter Dialogfehler                                                                  | vollständig migriert; fachliche Reset-Hürde bleibt erhalten       |

Neue oder migrierte Flows verwenden keine browsernative Bestätigung. Sie sperren Bestätigung und Abbruch während der Mutation, lassen technische oder fachliche Fehler im Dialog sichtbar und zeigen den bestätigten Erfolg im nächsten stabilen Kontext.

Nicht-destruktive Sicherheitsabfragen bleiben bewusst getrennt: die Bestätigung eines globalen Push-Versands, das Überschreiben korrigierter degradierter Felder, Statuswechsel sowie das Überschreiben bestehender Feiertagsregeln verwenden weiterhin ihre fachlich passende allgemeine Bestätigung. Diese Flows löschen keine Ressource und gehören deshalb nicht zum destruktiven Dialogvertrag.

## Gemeinsame destruktive Primitives

`@sva/studio-ui-react` stellt bereit:

- `StudioDestructiveActionDialog` für Ziel, Konsequenz, Pending-Sperre und persistenten Dialogfehler,
- `StudioPersistentActionResult` für nicht automatisch verschwindende Ergebnisse,
- die `StudioDestructiveNavigationFeedback`-Hilfen für einen einmaligen, ressourcengebundenen Navigationsübergang.

Der jeweilige Host- oder Plugin-Flow bleibt Owner von Berechtigung, Mutation, Zieltext, Konsequenz und Fehlerübersetzung. Nach der Übernahme entfernt die Zielroute den transienten Feedback-State mit `replace`, damit Zurücknavigation oder Reload keinen alten Erfolg erneut anzeigen.

## Inventur der Plugin-Operations-Pfade

| Pfad                 | Führende Daten                                                                                        | Aktualisierung                                                     | Dauerhafter Kontext                        | Folgeaktionen                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------- |
| Generischer Jobstart | Hostantwort mit Job-ID und initialem Status                                                           | anschließender Detailabruf                                         | `/monitoring/jobs/$jobId`                  | nur Host-Capabilities                                                            |
| Waste-Import         | zentraler Studio-Job für `waste-management.import-data`                                               | aktiver Job wird gepollt; Reload stellt den letzten Job wieder her | Ergebnis-Kurzsicht plus Link zum Jobdetail | Cancel im Jobdetail, kein manueller Retry                                        |
| Weitere Waste-Tools  | zentrale Jobs für Provisionierung, Initialisierung, Migration, Seed, Reset, Sync, Export und Reminder | gemeinsame Job-Kurzsicht; Terminalstatus beendet Polling           | technische Historie und Jobdetail          | fachliche Ergebnis-/Downloadaktionen nur bei bestehendem Vertrag                 |
| Monitoring-Liste     | `iam.studio_jobs` und letztes Lifecycle-Event                                                         | aktive Ansicht pollt                                               | `/monitoring/jobs`                         | Navigation zum Jobdetail                                                         |
| Monitoring-Detail    | Job, Progress, Runtime und Event-History aus demselben Hostvertrag                                    | aktive Jobs pollen; Terminalstatus stoppt                          | `/monitoring/jobs/$jobId`                  | `availableActions`; derzeit ausschließlich `cancel` für aktive, berechtigte Jobs |

Der Host liefert `availableActions`. Die UI leitet Cancel oder Retry nicht aus einem Statusstring ab. Cancel ist nur bei `iam.monitoring.write`, einem aktiven Status und fehlender früherer Abbruchanforderung verfügbar. Der konditionale Repository-Write verhindert doppelte oder verspätete Abbruchanforderungen. Ein manueller Retry wird mangels Hostvertrag nicht angeboten; automatische Runner-Retries bleiben als Status `retrying` im selben Job sichtbar.

## Darstellung und Accessibility

`StudioJobSummaryCard` stellt Status, Metadaten und Folgeaktionen gemeinsam dar. Der auslösende Waste-Bereich zeigt Job-ID, initialen Status und den Link zum Jobdetail. Monitoring ergänzt vollständigen Verlauf, Runtime, Ergebnis und Fehler.

Status- und Phasenwechsel werden über eine höfliche Live-Region angekündigt. Rein numerische Fortschrittsänderungen erzeugen keine zusätzliche Ansage. Fehler und Terminalzustände bleiben sichtbar; Navigation oder Reload darf die zentrale Job-History nicht verlieren.

## Prüfkriterien

- Destruktive Dialoge benennen Ziel und endgültige Konsequenz und besitzen keinen Undo-Pfad.
- Während einer laufenden Mutation sind Bestätigung und Abbruch gesperrt; ein zweiter Submit wird zusätzlich im Action-Hook verhindert.
- Erfolg nach Navigation ist ressourcengebunden, persistent und einmalig konsumiert.
- Dialog-, Rechte- und Technikfehler bleiben im Handlungskontext sichtbar.
- Jobstatus stammt ausschließlich aus dem Hostvertrag; UI-Folgeaktionen stammen ausschließlich aus `availableActions` oder einem ausdrücklich bestehenden Ergebnisvertrag.
- Host und Plugins verwenden die Primitives aus `@sva/studio-ui-react` und führen keine neue Toast-, Dialog- oder Feedback-Basis ein.
