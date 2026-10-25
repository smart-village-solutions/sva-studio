# Keycloak-Theme: Organisationsanmeldung und Fokusrahmen

Stand: 26. Oktober 2026, nach Produktivprüfung. Auftrag: die besprochenen
Login-Verbesserungen umsetzen und auf dem zentralen Keycloak ausrollen.

## Ergebnis und Umfang

Quellstand: Commit `f05501139`, Branch `fix/keycloak-login-usability`, isolierter
Worktree `.worktrees/keycloak-login-usability`. Kein Push oder Merge ausgeführt.

- Organisationsanbieter stehen im DOM und sichtbar vor dem lokalen Formular.
- Überschrift, Erklärung und Trenntext sind auf Deutsch und Englisch übersetzt.
- Anbieterbuttons sind 52 px hoch, mit deutlicher Fläche, Kontur und Tastaturfokus.
- Bei vorhandenen Anbietern zieht das lokale Benutzerfeld nicht automatisch den Fokus an sich.
- Der Feldcontainer zeichnet den Fokusindikator; innere Controls und
  PatternFly-Pseudoelemente erzeugen keinen zusätzlichen Rahmen.
- Validierungsfehler, Autofill-Attribute, Passwortanzeige und die geerbten
  Formular-/Passkey-/Anbietermakros bleiben erhalten.

`login.ftl` basiert auf Keycloak 26.8.1, Apache-2.0. Bei späteren Upgrades ist
sein Abgleich mit dem Upstream erforderlich. Es wurden keine Anmeldeflows,
Realm-Einstellungen, Berechtigungen, Datenbankschemata oder Images geändert.

## Durchgeführter Betriebsschritt

Ziel: Quantum-Endpoint `sva` (64), Stack `sva-keycloak`, Service `keycloak`,
Theme-Verzeichnis `/opt/keycloak/themes/sva-kern2` im bestehenden Volume `themes`.
Dies war eine Aktualisierung des eigenständigen Keycloak-Themes gemäß dessen
Installations-/Cache-Hinweisen, kein Studio-App-Promote und keine Änderung des
kanonischen Studio-App-Rolloutpfads.

1. Live-Theme über die bestehende Quantum-/Portainer-API gelesen; die bisherigen
   Login-Dateien stimmten mit dem Repository überein.
2. Vollständiges bisheriges Theme lokal als
   `.worktrees/keycloak-preview/live-theme-before.tar` gesichert, Modus `0600`.
3. Neues Theme separat im bestehenden Volume bereitgestellt. Der erste
   Aktivierungsversuch scheiterte an den Dateirechten des Containerbenutzers;
   unabhängiges Readback bestätigte den unveränderten Altstand. Danach wurden
   ausschließlich für den Dateiaustausch Root-Rechte verwendet und die bisherigen
   Eigentümer `911:911` beibehalten.
4. Bisheriges Verzeichnis nach `.sva-kern2-before-20261026` umbenannt und den
   vorbereiteten Stand aktiviert. Alle ausgelieferten Dateien unabhängig
   zurückgelesen und mit dem Quellstand verglichen.
5. Bei der Paketübernahme zunächst mitkopierte, zuvor live nicht vorhandene
   E-Mail-Theme-Dateien nach exaktem Inhaltsvergleich wieder entfernt. Der finale
   Stand enthält ausschließlich das Login-Theme; der vorherige E-Mail-Theme-Zustand
   bleibt erhalten.
6. Zur Cache-Neuladung ausschließlich `TaskTemplate.ForceUpdate` des vorhandenen
   Keycloak-Services von 0 auf 1 erhöht. Zeitpunkt: 26. Oktober 2026, 00:50:57 MEZ.
   MariaDB und Filebrowser wurden nicht neu gestartet.

Image unverändert:
`registry.gitlab.tpwd.de/smart-village-app/keycloak@sha256:59a782cc56ae810f0140a71b42c47c50a73d5880594a5d5088df93c5bc76f3ef`.
Service-Update terminal `completed`, eine laufende Replik. Kein Docker-Healthcheck
konfiguriert; daraus wird kein `healthy`-Nachweis abgeleitet.

Rückweg: das gesicherte vorherige Theme wieder an den ursprünglichen Pfad setzen
und denselben Keycloak-Service erneut zur Cache-Neuladung starten. Keine
Datenbankänderung oder Datenbankwiederherstellung für diesen Theme-Rückweg nötig.
Die Sicherungen wurden bewusst aufbewahrt.

## Nachweise und Grenzen

- Direkter Vitest-Lauf der bestehenden Theme-Testdatei: fünf Tests bestanden,
  einschließlich Kontrastverträgen und Vollständigkeit der zusätzlichen Übersetzungen.
- Nx im isolierten Worktree blockierte vor dem Test an fehlenden fachfremden
  Workspace-Abhängigkeiten. Ein separater Nx-Lauf im Hauptcheckout bestand die
  dortige unveränderte Testdatei einschließlich ihrer Abhängigkeiten; er ersetzt
  nicht den direkten Nachweis der fünf Tests im geänderten Worktree.
- Skript-Typecheck im isolierten Worktree ebenfalls durch fehlende
  Workspace-Abhängigkeiten blockiert; kein grüner Gesamt-Typecheck behauptet.
- Formatierung, `git diff --check` und Dateiplatzierungsprüfung bestanden.
- Lokaler echter Keycloak 26.8.1: Hell/Dunkel bei 1280 und 390 px, keine horizontale
  Überbreite, Anbieter vor Formular, Fokus, Eingabefehler, Englisch,
  Passwortanzeige, Autofill-Attribute und Tastaturreihenfolge geprüft.
- Beide produktiven Studio-Einstiege (`bb-guben` und `ni-osnabrueck`) unabhängig
  im Browser geöffnet: neue Texte sichtbar, Anbieter vor Formular, Höhe 52 px,
  innerer Outline-Stil `none`, Container-Outline `solid`, zusätzliche
  Pseudoelement-Ränder `0px`.
- Öffentliche CSS-Datei bytegleich mit dem Commit; SHA-256:
  `4139c36cdb996ed80ccae0f1a2504305d4f8a9df44eed8747b4d0c5c9c4fc598`.
- Öffentliche Realm-Discovery nach dem Neustart HTTP 200.
- Die echte 1Password-Erweiterung war im automatisierten Browser nicht geladen.
  Deren eigener Overlay-Zustand ist damit noch nicht separat abgenommen.
- Kein vollständiger authentifizierter Login oder externer Provider-Login
  durchgeführt; Gegenstand war die Darstellung, nicht eine Änderung der Authentifizierung.

Screenshots, lokales Vorher-Archiv und redigierte technische Evidenz liegen unter
`.worktrees/keycloak-preview/`. Zugangsdaten wurden nicht in diesen Nachweis übernommen.
