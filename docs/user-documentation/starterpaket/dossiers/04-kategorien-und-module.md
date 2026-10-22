# Dossier 4: Kategorien und Module

## `categories.overview` – Kategorien

- **Route / Typ / Owner:** `/categories`, Übersicht, Host.
- **Nutzerziel:** Mainserver-Kategorien und ihre Hierarchie verwalten.
- **Produktfakten:** Die Seite zeigt aktive und inaktive Kategorien mit Hierarchie, Position und
  Datentypen. Je nach Berechtigung lassen sich Kategorien anlegen, bearbeiten, als Unterkategorie
  einordnen und nach einer Bestätigung sicher löschen. Statusänderungen mit Unterkategorien werden
  vor dem Speichern bestätigt; bestehende Verwendungen blockieren das Löschen und werden nach Art
  und Anzahl angezeigt.
- **Kontextabhängig:** Laden erfordert `categories.read`, aktive Mainserver-Integration und passende
  persönliche oder organisatorische Credentials.
- **Redaktionelle Leitfragen:** Wie liest man die flache Hierarchiedarstellung? Welche Auswirkungen
  hat eine Statusänderung auf Unterkategorien? Welche Zuordnungen blockieren das Löschen?
- **Stichwörter / Querverweise:** Kategorie, Hierarchie, Datentyp, Status, Mainserver, Safe-Delete;
  weiter zu Inhaltstypen mit Kategorieauswahl.
- **Evidenz:** `packages/plugin-categories/src/categories.pages.tsx`,
  `packages/plugin-categories/src/plugin.translations.ts`.

## `modules.overview` – Module

- **Route / Typ / Owner:** `/modules`, Übersicht, Host.
- **Nutzerziel:** Modulfreigaben einer Instanz prüfen oder administrativ verwalten.
- **Produktfakten:** Im Tenantkontext zeigt die Seite alle bekannten Module mit aktivem oder
  inaktivem Status und Beschreibung. Ohne tenantgebundene Sitzung muss zuerst ausdrücklich eine
  Instanz ausgewählt werden; es gibt keine automatische Vorauswahl. Erst danach können deren Module
  zugewiesen oder entzogen werden; zusätzlich bestehen Aktionen zum Neuaufbau der
  IAM-Basis und zur Initialisierung der Tenant-Admin-Struktur.
- **Kontextabhängig:** Die Verwaltungsansicht benötigt Instanz- und Modulrechte. Beim Entziehen
  werden zugehörige Berechtigungen und IAM-Basis entfernt.
- **Redaktionelle Leitfragen:** Wann sieht man die reine Statusansicht? Was bewirkt Modulzuweisung im
  Unterschied zu Rollenrechten? Wann ist ein Neuaufbau der IAM-Basis fachlich zulässig?
- **Stichwörter / Querverweise:** Instanzmodul, Fachbereich, IAM-Basis, zuweisen, entziehen;
  weiter zu Instanzdetails, Rollen und Berechtigungen.
- **Evidenz:** `routes/admin/modules/-modules-page.tsx`,
  `i18n/resources/de/admin/instances/instanceModules.resources.ts`.

## Deutsche App-Texte und Sprachen

Root pflegt unter „App → Gemeinsame App-Texte“ die deutschen Standards. Importiert wird eine von der App-Entwicklung vorbereitete JSON-Datei mit Textkennungen, Ausgangswerten und Platzhalterregeln; `texts.js` wird vorerst manuell in dieses Format überführt. Der Import erzeugt einen Entwurf. „Textstand sichern“ bleibt lokal und veröffentlicht nichts an die Mobile-App.

Instanzen passen unter „App → App-Texte“ die deutschen Texte mit eigenen Les-/Schreib-/Sicherungsrechten an. Das Mehrsprachigkeitsmodul ist dafür nicht nötig. Erst dort wird ein kommunaler Ausgangsbestand angelegt oder seine gemeinsame Basis ausdrücklich gewechselt.

Der eigenständige Navigationspunkt „Sprachen“ entfällt. Nach Aktivierung des Mehrsprachigkeitsmoduls wird DeepL im Bereich „Schnittstellen“ angeboten. Ein berechtigter Instanzadministrator hinterlegt dort den eigenen API-Key und Tarif, speichert, führt „Verbindung prüfen und Sprachen laden“ ausdrücklich aus und wählt anschließend die gewünschten technisch unterstützten Zielsprachen. Alle von DeepL als stabile Zielsprachen gemeldeten Sprachen werden alphabetisch angeboten, unabhängig vom Umfang des Magdeburger Piloten. Deutsch bleibt Ausgangssprache. Pro Sprache wird genau eine Variante gewählt; bei mehreren Varianten erscheint das kompakte Dropdown rechts in derselben Zeile erst nach Auswahl der Sprache. Es gibt keine zweite Sprachfreigabeliste. Die Prüfung steht neben Speichern und Abbrechen; nach Erfolg bleiben ein dezenter Prüfstatus und „Verbindung erneut prüfen“ verfügbar. Änderungen an Sprachwahl oder Anzeigename sperren die Prüfung nicht und bleiben beim Aktualisieren des Prüfergebnisses erhalten. Änderungen an Key, Tarif oder Aktivierung müssen zunächst gespeichert werden. Das Modul zeigt bis dahin einen Einrichtungshinweis. Ohne `integration.manage` wird die Einrichtung durch einen berechtigten Administrator erklärt. Erst eine geprüfte Konfiguration mit mindestens einer gespeicherten Zielsprache erlaubt neue abhängige Katalogänderungen. Deutsch bleibt ohne Modul nutzbar; vorhandene Texte bleiben bei Providerstörungen erhalten. Der Abschnitt verändert noch keine ausgelieferten Apps und keine Studio-Oberflächensprache.

Unter „App → Mehrsprachigkeit“ übernimmt die Aktion „Aktuelle Sprachauswahl übernehmen“ die erlaubten zusätzlichen Sprachen in den bestehenden Entwurf. Dort werden Fremdsprachen bearbeitet; deutsche Ausgangstexte bleiben im Hostbereich. Bestehende Sprachkorrekturen bleiben bei einer Sperre gespeichert.

Die Aktion „Fehlende Übersetzungen erstellen“ startet ausdrücklich einen DeepL-Auftrag für fehlende oder veraltete Standardtexte. Manuelle Korrekturen bleiben erhalten. Quelle ist der gewählte gemeinsame deutsche Ausgangsstand; eigene deutsche Texte lassen sich gezielt im Editor „Diesen deutschen Text übersetzen“. Die Aktion erscheint nur beim gespeicherten eigenen deutschen Text. Zuerst werden die Zielsprachen ausgewählt; das Überschreiben einer manuellen Korrektur muss anschließend für jede betroffene Sprache separat bestätigt werden. „Auf Standard zurücksetzen“ entfernt nur den eigenen Wert. Fortschritt wird gespeichert; eine konkurrierende Bearbeitung stoppt einen alten Auftrag. DeepL kann Kosten verursachen. „Textstand sichern“ bleibt eine getrennte lokale Aktion; die Apps werden dadurch noch nicht beliefert. Falls Texte fehlen oder eine Korrektur für die aktuelle Quelle beziehungsweise Sprachvariante bestätigt werden muss, zeigt die Aktion die betroffenen Sprachen und Textkennungen an. Ein Klick öffnet den Eintrag; „Korrektur bestätigen“ behält den manuellen Text bei. Gesicherte Textstände zeigen ihre enthaltenen Sprachen und ihren Bearbeitungsstand direkt in der Liste und über der Vorschau. Ein älterer gesicherter Stand ändert sich durch neue Übersetzungen im Entwurf nicht.

Gesicherte Textstände werden unter „App-Texte“ und „Mehrsprachigkeit“ vollständig mit allen enthaltenen Sprachen und dem zugehörigen Bearbeitungsstand angezeigt. Die unveränderliche Vorschau darf auch frühere, inzwischen nicht mehr aktivierte Sprachfassungen zeigen. Die Bearbeitung unter „App-Texte“ bleibt ausschließlich deutsch; die aktuelle Sprachfreigabe begrenzt weiterhin die Bearbeitung und das neue Sichern im Mehrsprachigkeitsmodul.

Bei vorhandenem kommunalem Entwurf wird die aktuell verwendete zentrale Basis mit Textbestand, Textstandnummer und Sprachen angezeigt. Die Auswahl bleibt geschlossen. Nur wenn eine andere zentrale Basis desselben Textbestands verfügbar ist, lässt sich „Ausgangsstand wechseln“ öffnen und anschließend ausdrücklich übernehmen oder abbrechen. „Eigenen App-Textentwurf anlegen“ erscheint ausschließlich ohne bestehenden Entwurf. Eigene gesicherte Instanzstände sind keine zentralen Basisangebote.

Vor einem Sammelauftrag werden die tatsächlich fehlenden oder veralteten Standardtexte insgesamt und je Zielsprache gezählt. Ist nichts zu übersetzen, werden weder ein Job noch eine DeepL-Anfrage erzeugt. Der gespeicherte Fortschritt unterscheidet übersetzte und übersprungene Texte und nennt die zuletzt bearbeitete Sprache. Bei einem Abbruch oder Fehler bleiben nicht gespeicherte Texte offen; der sichere Fehlerstatus erklärt die Ursache. Ein späterer Lauf setzt auf dem gespeicherten Stand auf.
