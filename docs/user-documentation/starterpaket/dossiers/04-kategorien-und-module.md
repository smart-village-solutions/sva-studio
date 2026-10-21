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
