# Design: Kommunaler Anwendungsarbeitsplatz

## Kontext und vorhandene Pfade

`packages/plugin-sdk/src/plugin-definition-types.ts` beschreibt bereits Routen, Actions, Berechtigungen, Module-IAM und Übersetzungen. Ein deklarierter Einstieg für Plugin-Einstellungen fehlt. `Header.tsx` rendert globale Aktionen hostseitig; `AppShell.tsx` zeigt für angemeldete Benutzer die Seitenleiste und den mobilen Navigationseinstieg. Die Modulübersicht unterscheidet bereits Tenant-Transparenz und Root-Modulzuweisung. Diese Zuständigkeiten werden erweitert.

`packages/iam-core/src/ui-access.ts` unterscheidet authentifizierte Oberflächen und berechtigungsgebundene Tenant-Aktionen. Das bloße Authentifiziertsein prüft dort keine Modulzuweisung: Die Host-Integration muss deshalb zusätzlich die wirksame Aktivierung im aktuellen Instanzkontext durchsetzen. Es entsteht kein pauschaler Bypass für andere Plugin-Seiten.

## Entscheidungen

### Zuschnitt und Alternativen

Empfohlen ist ein eigenständiges Plugin für die neue Fachlichkeit und eine kleine Erweiterung der bestehenden Host-Verträge. Ein fester Core-Anwendungskatalog würde die gewünschte Aktivierbarkeit verlieren; eine umfassende Portal-/SSO-Plattform würde externe Systemverantwortung und unnötige Infrastruktur in diesen Abschnitt ziehen. Beide Alternativen werden verworfen.

Die belegte Lücke für das externe Paket `@sva/plugin-application-workspace` ist die bisher fehlende instanzbezogene Kachelverwaltung samt Übersetzungen; unmittelbare Verbraucher sind Übersicht und Einstellungsseite. Das bestehende Cockpit-Plugin stellt einen einzelnen Navigationslink bereit und wird für diese abweichende Fachlichkeit weder umgedeutet noch ersetzt.

### Einstieg und Layout

Der Host zeigt rechts in der Kopfzeile einen semantischen Link mit einem 3×3-Grid-Icon. Deutsch: zugänglicher Name und Tooltip „Anwendungen“; Englisch: „Applications“. Das SVG ist dekorativ und wird für assistive Technik verborgen. Die Sichtbarkeit folgt dem aktuellen, aufgelösten Instanz- und Aktivierungszustand, nicht einem festen Rollennamen. Anonyme und reine Plattformkontexte ohne konkrete angemeldete Instanz erhalten keinen kommunalen Katalog.

`/plugins/application-workspace` verwendet dieselbe App-Shell mit einem hostkontrollierten Layout ohne Seitenleiste. Auch Rail, reservierter Sidebar-Abstand und mobiler Menüknopf entfallen dort. Header, Konto, Sprachwahl, Theme, vorhandene Rechts-/Sitzungsprüfungen und Hauptinhalts-Landmark bleiben bestehen. Andere Routen behalten ihre Navigation; der Wechsel speichert keine neue Sidebar-Präferenz. Es gibt keine zweite Shell und keine allgemeine Header-Extension-Plattform.

### Kacheln und Navigation

Die erste Kachel wird aus Plugin-Übersetzungen erzeugt: Name „SVA Studio“, Beschreibung und CtA passend zur Studio-Sprache, festes Studio-Icon und internes Ziel `/`. Sie ist weder löschbar noch verschiebbar oder in ein externes Ziel umwandelbar. Auch ohne weitere Einträge ist die Übersicht damit nutzbar.

Weitere Kacheln haben eine stabile Kennung, ein Icon aus der im Studio verwendeten Tabler-Bibliothek, eine Ziel-URL, übersetzbare Namen/Beschreibungen/CtA-Texte und eine Reihenfolge. Auswählen von Tabler-Icons genügt im ersten Abschnitt; Bild-Uploads, beliebiges SVG/HTML und externe Icon-Abrufe entfallen. Ein unbekannt gewordenes Icon erhält ein sicheres Standardsymbol.

### Tabler-Icon-Auswahl als Design-System-Komponente

Die vorhandene UI nutzt `@tabler/icons-react`; das bestehende Designsystem-Briefing legt Tabler mit Standardkontur 2 fest. Die Auswahl umfasst die Outline-Icons der im Studio eingesetzten Tabler-Version, nicht lediglich die schon in der Navigation verwendeten Symbole. Eine durchsuchbare Auswahl zeigt Symbol und Namen, markiert die aktuelle Auswahl und bietet eine Vorschau im Formular. Gespeichert wird ausschließlich eine stabile Tabler-Kennung; Namen oder SVG-Inhalt sind keine frei ausführbare Konfiguration. Suchfeld, Feldbeschriftung, Status- und Fehlertexte folgen der Studio-Sprache; technische Tabler-Namen bleiben zusätzlich suchbar.

Eine bestehende spezialisierte Icon-Auswahl wurde in `@sva/studio-ui-react` nicht gefunden; unmittelbarer Verbraucher ist das Kachelformular. Auf ausdrücklichen Produktwunsch wird die Auswahl als gemeinsame Komponente im bestehenden UI-Package umgesetzt, aufgebaut auf vorhandenen Formular- und Auswahl-Primitives statt als pluginlokale Parallelkomponente. Die bisherige Architekturregel für fachnahe Spezialcontrols wird für diesen ausdrücklich gemeinsamen Baustein nachvollziehbar fortgeschrieben; es entstehen weder ein neues Package noch eine konfigurierbare Icon-Provider-Schicht.

Auslöser und Auswahlfläche unterstützen Tastaturbedienung, erkennbare Auswahl, sichtbaren Fokus, Escape zum Schließen sowie Fokusrückgabe zum Auslöser. Abbrechen verändert den gespeicherten Wert nicht. Definiert sind mindestens leer, ausgewählt, Hover, Tastaturfokus, deaktiviert, schreibgeschützt, Validierungsfehler und Suche ohne Treffer. Eine schreibgeschützte Ansicht zeigt das gewählte Icon mit Namen, ohne eine ausführbare Auswahl anzubieten. Der Katalog wird so ausgeliefert und dargestellt, dass weder die Kopfzeile noch gewöhnliche Studio-Seiten sämtliche Icons vorab laden oder rendern müssen.

Im bestehenden Figma-Designsystem „SVA Studio“ wird dieselbe Komponente vor ihrer Code-Implementierung gestaltet und abgestimmt: Formularfeld, Auswahlfläche mit Suche und Icon-Raster, aktuelle Auswahl, leere Suche sowie alle genannten Interaktionszustände. Vorhandene Komponenten, semantische Variablen, Typografie, Abstände und Tabler-Kontur werden verwendet; Light/Dark und unterstützte Themes bleiben konsistent. Die Dokumentation hält Bedienverhalten und Code-Zuordnung fest. Figma-Link/Node-ID und Screenshots der geprüften Zustände gehören zum Nachweis; eine reine Figma-Illustration ersetzt weder eine editierbare Komponente noch deren Code-Abnahme. Die konkrete bestehende Bibliotheksdatei und das verwendete Konto werden vor der Figma-Bearbeitung eindeutig zugeordnet.

Externe Ziele öffnen über echte Links in einem neuen Tab mit `noopener noreferrer` und lokalisiertem Hinweis. Das interne Studio-Ziel öffnet im selben Tab. Externe URLs müssen absolute HTTPS-Adressen ohne eingebettete Zugangsdaten sein. URLs dürfen keine Geheimnisse enthalten; es gibt keine Token-Anhänge, serverseitigen URL-Abrufe oder Redirect-Endpunkte. Die Sicherheit einzelner Zielanwendungen bleibt deren Verantwortung.

### Plugin-Einstellungen in der Modulübersicht

Ein optionaler serialisierbarer Einstellungsbeitrag im bestehenden Plugin-Vertrag referenziert eine registrierte Plugin-Route und deren Action-/Access-Bezug. Descriptor, Validierung und Snapshot werden im bestehenden Pfad ergänzt. Der Host akzeptiert nur bekannte Routen desselben Plugins mit konsistentem Modul- und Berechtigungsbezug; Plugins ohne Beitrag erhalten keinen leeren Einstellungsbutton. Browser-Komponenten werden weiterhin nur über den Browser-Entry geladen.

Die Instanzansicht von `/modules` bietet bei aktivem Plugin und passendem Recht den Einstieg zur Einstellungsroute `/plugins/application-workspace/settings`. Der Modulübersichtszugriff für diesen Fall wird um die passende Einstellungsberechtigung ergänzt; pauschale Adminrollen sind keine zusätzliche Voraussetzung. Root-Modulzuweisung bleibt unverändert Root-only. Die Root-Sammelansicht erhält keinen neuen tenantübergreifenden Einstellungseditor.

Die Einstellungsseite nutzt das normale Studio-Layout mit Seitenleiste und vorhandene Formular-/Listenkomponenten. Berechtigte können Kacheln hinzufügen, bearbeiten, nach oben/unten verschieben und nach Bestätigung löschen. Damit ist Sortierung auch ohne Drag-and-drop zugänglich. Die feste Studio-Kachel wird als unveränderlich kenntlich gemacht. Lade-, Leer-, Speicher-, Validierungs- und Fehlerzustände sind übersetzt; ein fehlgeschlagener Speichervorgang erhält die Eingaben und zeigt keinen Erfolg an.

### Rechte, Persistenz und Trust Boundaries

Alle angemeldeten Benutzer einer wirksam aktivierten Instanz dürfen die veröffentlichte Übersicht lesen, auch ohne zugewiesene Fachrolle. Dafür wird kein individuell zu vergebendes Leserecht vorausgesetzt. Der Host verwendet den vorhandenen authentifizierten Access-Vertrag plus explizite instanzgebundene Aktivierungsprüfung für Route und Lesehandler.

`application-workspace.settings.read` erlaubt Einsicht in den Einstellungsarbeitsplatz, `application-workspace.settings.update` dessen Mutationen. Der Module-IAM-Vertrag und die bestehende Rechteverwaltung führen beide Rechte; ein standardmäßiger Verwaltungsrollenzuschnitt enthält beide. Speichern erfordert beide Rechte und aktive Modulzuweisung serverseitig, auch bei direktem API-Aufruf. Bestehende system_admin-Semantik bleibt erhalten. Sichtbare Kacheln übertragen keine Rechte oder Rollen in Zielanwendungen.

Fachliche Validierung und Kacheldarstellung liegen im Plugin; Sitzungsprüfung, Instanzbindung, Routing, Persistenzanbindung und Audit nutzen bestehende Host-Ausführungskontexte. Es wird die bestehende Studio-DB-Infrastruktur verwendet, kein neuer Dienst und kein allgemeines Settings-Framework. Die konkrete Migration wird nach Prüfung der aktuellen Schemaquellen im Implementierungsabschnitt festgelegt. Kachelkonfiguration gehört zur Instanz, nicht zur aktuell gewählten Organisation oder zu einem einzelnen Benutzer.

Der Server leitet die Instanz ausschließlich aus dem verifizierten Kontext ab; frei übermittelte Instanz-/Kachelkennungen begründen keinen Zugriff. Änderungen werden atomar einschließlich Reihenfolge gespeichert. Eine Versionsprüfung lehnt veraltete Speicherstände als Konflikt ab, damit zwei Editoren sich nicht unbemerkt überschreiben. Audit dokumentiert Instanz, Action und betroffene Kachelkennungen über den bestehenden Vertrag; reguläre Logs enthalten keine vollständigen URLs oder Inhaltspayloads. Server-Code verwendet `@sva/server-runtime`.

Bei Kontextwechsel oder Deaktivierung werden alte Daten und überholte Antworten verworfen. Fehlgeschlagene Ladevorgänge zeigen einen wiederholbaren Fehler, keine erfolgreiche leere Konfiguration. Die feste Studio-Kachel darf als gekennzeichneter Restinhalt stehen bleiben. Neuaktivierung startet mit der Studio-Kachel; deaktivieren blendet Einstieg und Zugriff aus, löscht aber nicht die Konfiguration. Reaktivierung verwendet denselben Bestand.

### Übersetzungen

Feste UI-Texte verwenden den vorhandenen `t('key')`-Pfad; initial werden Deutsch und Englisch gepflegt. Konfigurierbare Texte werden pro Kachel und unterstützter Studio-Sprache als Inhalt gespeichert, nicht als frei erfundene UI-Übersetzungsschlüssel. Die Sprachauswahl folgt dem zentralen Studio-Sprachkatalog und ist nicht auf zwei Eingabefelder fest verdrahtet.

Für jede zusätzliche Kachel sind Name, Beschreibung und CtA auf Deutsch erforderlich. Weitere Sprachen sind optional; leere oder nur aus Leerraum bestehende Werte fallen je Feld auf Deutsch zurück. Ein Sprachwechsel ändert nur die Anzeige und überschreibt keine gespeicherten Übersetzungen. Keine maschinelle Übersetzung und kein neuer Sprachverwaltungsdienst werden eingeführt. Die Einstellungsseite macht fehlende Übersetzungen und den Fallback verständlich sichtbar.

### SSO-Grenze

Der Arbeitsplatz öffnet reguläre Anwendungs-URLs. Eine gemeinsame IP-Adresse bewirkt keine gemeinsame Anmeldung. Anwendungen können eine bestehende Sitzung eines gemeinsamen Identity Providers, etwa desselben Keycloak-Realms, über ihre eigene OIDC-/SAML-Anbindung nutzen. Dieses Plugin teilt oder kopiert keine Studio-Cookies, Passwörter oder Tokens. Sitzungsablauf, MFA und fehlende Zielberechtigung können weiterhin eine Anmeldung oder Ablehnung auslösen.

SSO-Abnahme erfolgt später separat je Anwendung und tatsächlich betriebener Version. Dieser Abschnitt richtet keine Clients, Redirect-URIs, Konten oder externen Anwendungen ein und verspricht keinen universellen angemeldeten Zustand.

## Kritische Invarianten und geplanter Nachweis

| Invariante                                                                                     | Geplanter Nachweis                                                                                                       |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Aktivierung genügt für alle angemeldeten Instanznutzer, nicht für anonyme oder fremde Kontexte | Benutzer ohne Fachrolle; anonym; Plattformkontext; aktive/deaktive Instanz; direkte Route und API testen                 |
| Bearbeitung setzt aktuelle Rechte und Instanzbindung voraus                                    | Read-only, Update-only ohne Read, fehlende Rechte, manipulierte IDs, fremde Kachel und Entzug während Bearbeitung testen |
| Keine Konfiguration einer anderen Instanz erreicht UI oder Schreibpfad                         | Zwei Instanzen, gleiche Kachelkennungen, Kontextwechsel und verspätete Antworten in Integrationstests                    |
| Die Studio-Kachel bleibt zuerst und unveränderlich                                             | Lösch-/Sortier-/URL-Manipulation über UI und direkte Mutation zurückweisen                                               |
| Texte sind vollständig und deterministisch übersetzbar                                         | DE/EN, teilweise fehlende Übersetzung, Leerraum, Sprachwechsel und zentralen Sprachkatalog testen                        |
| Links transportieren keine Studio-Zugangsdaten                                                 | HTTPS-/Credentials-/Schema-Negativtests, echte Linkziele und Netzwerkverhalten prüfen                                    |
| Atomare Speicherung verhindert stillen Datenverlust                                            | Fehlgeschlagene Speicherung, Versionskonflikt, sortierte Readbacks und Deaktivierung/Reaktivierung testen                |
| Shell und vorhandene Rechte-/Sitzungsgates bleiben intakt                                      | Desktop/Mobil, Tastatur/Fokus, Rückkehr ins Studio, Such-Einstieg und unveränderte Sidebar-Präferenz prüfen              |
| Plattformbeitrag bleibt konsistent validiert                                                   | Fremde/unbekannte Settings-Route, falscher Namespace und deaktiviertes Plugin im Snapshot testen                         |

## Lieferung, Dokumentation und Rücknahme

Ein zusammenhängender Lieferabschnitt umfasst Plugin, erforderliche Host-Verträge, Einstellungen und Übersicht; kein künstlicher PR-Stack. Neue Mechanismen erhalten sofort das kleinste passende Unit-/Type-Gate. DB-/Datenintegritäts-, IAM- und Server-Runtime-Pflichtprüfungen richten sich nach `DEVELOPMENT_RULES.md`, Abschnitt 5.2. Datenbankintegration prüft echte Persistenzgrenzen; UI-Abnahme deckt Desktop, Mobil und WCAG 2.1 AA ab.

Bei Umsetzung werden Plugin-Guide, Anwenderhandbuch DE/EN, kontextbezogene Seitenhilfe, Schemaquellen und die im Proposal benannten arc42-Abschnitte fortgeschrieben. Eine Deaktivierung nimmt die Funktion zurück, ohne verlinkte Anwendungen zu ändern oder Konfiguration zu löschen. Reguläre spätere Rollouts folgen ausschließlich `docs/guides/studio-rollout-process.md`.

## Umsetzungsnachweis

Freigabe zur vollständigen Umsetzung durch den Nutzer am 8. November 2026. Isolierter Branch: `feature/application-workspace`, Basis `origin/main` bei `68bbc61e3`. Die Figma-Arbeit erfolgte im verbundenen Konto Philipp Wilimzig in der bestehenden Datei „Designsystem SVA Studio“. Die Icon-Auswahl wurde vor ihrer Code-Implementierung erstellt und in Light/Dark visuell geprüft: [Komponente 262:5037](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=262-5037), [Light 262:5237](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=262-5237), [Dark 262:5462](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=262-5462).

Figma-Varianten der Komponente: Empty `262:5028`, Selected `262:5029`, Hover `262:5030`, Focus `262:5031`, Disabled `262:5032`, Readonly `262:5033`, Error `262:5034`, Open `262:5035`, NoResults `262:5036`.

XERJ wurde in `studio-code` und `payload-code` einschließlich semantischer Suche konsultiert. Der Studio-Index referenzierte Revision `60059753b161236d0fd0b1ca6ffd99ab5feb2a48` und war älter als die Arbeitsbasis; die maßgeblichen Registrierungs-, Access- und Auswahlpfade wurden deshalb im aktuellen Quellstand geprüft. Es wurde kein Payload-Code übernommen.

Das aktuelle Studio-Handbuch wird in einem getrennten Repository gepflegt; die frühere Datei `src/lib/translations/manual.ts` existiert in diesem Stand nicht. Der lokale redaktionelle Übergabepfad und der erzeugte Seitenkatalog werden hier aktualisiert. Dieser Auftrag schreibt nicht in das externe Hilfe-Repository.


### Lokale Verifikation am 8. November 2026

- Studio-Produktionsbuild einschließlich SSR, Nitro-Paketierung und Distributionsmanifest erfolgreich. Der neue UI-Katalog-Subpfad ist im bestehenden Vite-Alias-Pfad abgebildet. Tabler-Glyphen liegen in einem getrennten, erst bei Verwendung geladenen Chunk (472,74 kB gzip); der bestehende globale Chunk-Hinweis bleibt sichtbar.
- Vollständiger Server-Runtime-Guard erfolgreich: 21 Projekte mit 25 abhängigen Tasks (46 erfolgreiche Tasks).
- Studio-Typcheck, gezielter SDK-Vertragstest (78 Tests), Handler-Dispatcher (34), Shell (46), Modulübersicht (15), IconPicker (3), Distributionsartefakt (20) sowie Plugin-Tests (33) erfolgreich. Plugin-Coverage: Statements 91,46 %, Branches 86,63 %, Funktionen 92,72 %, Zeilen 94,73 %.
- Sechs Integrationstests mit einer ausschließlich lokalen, separaten PostgreSQL-Testdatenbank prüfen Readback, zwei Instanzen, fehlenden Instanzkontext, konkurrierende Versionsänderungen, Transaktionsabbruch und Migration-Down/Up mit erhaltenem Datenbestand. Keine produktive Datenbank wurde verändert.
- Playwright im tatsächlichen Studio: Übersicht bei 1440×1000 und 390×844, feste erste Studio-Kachel, externe OpenProject-Beispielkachel, erhaltene Kopfzeile und fehlende Seitenleiste geprüft. Mobil kein horizontaler Überlauf. Einstellungsformular mobil sichtbar; Tabler-Suche und Enter-Auswahl funktionieren; Escape gibt den Fokus zurück.
- Englischer Sprachwechsel und Dark-Theme im Browser geprüft. Axe 4.12.1 meldet für den geöffneten Picker und die englische Dark-Übersicht keine Befunde in den geprüften WCAG-2-A/AA- und 2.1-AA-Regeln. Dies ist keine vollständige manuelle Screenreader- oder produktive Fachabnahme.
- Lokale, nicht versionierte Screenshots: `.nx/application-workspace-ui/`. Figma-Varianten und Light-/Dark-Prüfflächen sind über die oben dokumentierten Node-IDs dauerhaft erreichbar.
- i18n-, Dateiplatzierungs-, Dokumentations- und strikte OpenSpec-Prüfung erfolgreich. Die vorhandenen Vite-/Nx-Migrationshinweise und die bestehende Warnung zur nicht registrierten User-Options-Hilfsdatei gehören nicht zum Feature-Scope.

Der Studio-Branch und sein Arbeitsbaum bleiben lokal. Kein Studio-PR, Studio-Push, Merge, Deployment, Figma-Library-Publish oder SSO-Umbau wurde ausgeführt. Die getrennte Handbuchpublikation und die produktive Fachabnahme bleiben ausstehend.


## Auslagerung in ein eigenständiges Repository

Der Nutzer hat nach der lokalen Implementierung ausdrücklich die Auslagerung beauftragt. `@sva/plugin-application-workspace` erhält ein eigenes Git-Repository `studio-plugin-application-workspace`, einen selbständigen TypeScript-/Vitest-Build, eigenen Lockfile, Lizenz, Manifest, publiccode und Installationsdokumentation. Es gibt keine `workspace:*`-Abhängigkeiten oder Imports auf Studio-Quelldateien. SDK und gemeinsame UI werden als öffentliche Peer-Pakete konsumiert; lokale Links sind ausschließlich Entwicklungsverknüpfungen. Die bisherige Workspace-Kopie wird entfernt, sobald der externe Paket-Build und seine Tests erfolgreich sind und Studio auf die Paketquelle umgestellt ist.

Die Host-Integration bleibt klein und explizit: Studio-Datenbankmigration, instanzgebundene Speicherung und transaktionales Audit bleiben im vorhandenen DB-/Host-Pfad. Das externe Servermodul definiert den öffentlichen `ApplicationWorkspaceHost`-Adaptervertrag. Es werden kein eigener Datenbankdienst und kein universelles Settings- oder Migrationsframework eingeführt.

Die bisherigen festen Arbeitsplatz-Verweise in Header und AppShell entfallen. Stattdessen ergänzt der bestehende Navigationsvertrag `section: header` mit dem aktuell benötigten Glyph `grid-dots`; der Beitrag muss auf eine eigene registrierte Route mit derselben Action und Access-Anforderung zeigen. Die Route kann `layout: content-only` deklarieren. Der Header prüft weiterhin aktuelle Tenant-Sitzung, Modulzuweisung und Access-Entscheidung. Sidebar-Einträge ignorieren Header-Beiträge. Fehlende oder deaktivierte Pakete erzeugen keinen Beitrag; die bestehende Host-/API-Autorisierung wird nicht umgangen.

Der bestehende OpenSpec bleibt der koordinierende Vertrag für diesen Lieferabschnitt über beide Repositories. Der gemeinsame Tabler-Picker und seine Figma-Komponente bleiben Eigentum des Studio-Designsystems. Eine Registry-/GitHub-Veröffentlichung wird durch diese Trennung nicht ausgeführt.


### Stand der Repository-Trennung

Eigenständiges lokales Git-Repository nach gezielter Pfadfreigabe unter `../studio-plugin-application-workspace` neben dem ursprünglichen Studio-Hauptcheckout, eigener Branch `main`, initialer Commit `3e13bbb`. Im aktiven Studio-Worktree verweist der bisherige, ignorierte Entwicklungspfad nur noch als Symlink auf diesen neuen Ort; es gibt keine zweite Quellkopie. Diese lokale Verknüpfung entfällt mit dem temporären Studio-Worktree. Das vom Nutzer benannte, bereits vorhandene öffentliche GitHub-Repository ist `smart-village-solutions/sva-studio_plugin-application-overview`. Der Plugin-Branch `main` wurde über das angemeldete Konto `pwilimzig` hochgeladen; Remote und lokaler Commit `66e3e9ba51c2b8a2410d09f3603d9927e87821ef` stimmen nach unabhängigem Readback überein. Der Plugin-Arbeitsbaum ist sauber.

Der aktive Studio-Worktree bindet den benachbarten Plugin-Checkout über eine relative `link:`-Abhängigkeit und den vorhandenen `linked-package`-Katalog ein. Die alte Workspace-Kopie ist vollständig entfernt. Keine lokalen absoluten Pfade, `workspace:*`-Protokolle oder Studio-Source-Aliase befinden sich im versionierten Plugin-Paket oder seinem Lockfile. Eigenständiger Build, Typecheck, 34 Tests und Coverage-Grenzen (alle Kennzahlen >85 %) wurden mit öffentlichen gebauten Peer-Paketen geprüft. `pnpm pack` liefert Manifest, öffentliche `dist`-Entries, Metadaten und Lizenz; der Server-Entry importiert in Node ohne Browser-Abhängigkeiten.


Nach der Trennung erfolgreich geprüft: Studio-Produktionsbuild (Client, SSR, Nitro), Studio-Typen, SDK-Runtime-Guard, 11 SDK-Vertragstests, 99 Header-/Shell-/Sidebar-Tests, 21 Breadcrumb-Tests, 10 Server-Loader-Tests einschließlich des real installierten externen Server-Entrys und 20 Distributionsartefakt-Tests. Das erzeugte Studio-Manifest enthält `application-workspace` genau einmal als installiertes Paket. Die frühere feste Eintragung in die Workspace-Distributionslisten wurde entfernt.

Die Browserprüfung mit dem tatsächlich extern geladenen Paket zeigt einen Header-Einstieg, keine Sidebar auf der Übersicht, drei Desktop-Spalten, keinen mobilen Überlauf und eine funktionierende Tabler-Auswahl in den Einstellungen. Lokale Screenshots liegen unter `.nx/application-workspace-ui/external-plugin-*.png`. i18n-, Dokumentations-, Dateiplatzierungs- und strikte OpenSpec-Prüfung sind erfolgreich. Beim UI-Lint bleiben die bereits vorhandenen projektfremden Warnungen sichtbar; die geänderten Pfade haben keine Lint-Fehler. Der nicht typisierte Tabler-Metadaten-Subpfad wird durch eine öffentliche Vendor-Deklaration unter `studio-ui-react/types/` referenziert; dadurch kollidieren Source- und Paket-Deklarationen nicht mehr.

Nach dem Verschieben außerhalb des Studio-Verzeichnisses wurde der eigenständige Build erneut geprüft. Der Test-Toolchain-Vertrag enthält nun Vite und Node-Typen ausdrücklich als Dev-Abhängigkeiten, statt sie aus einem übergeordneten Studio-Verzeichnis aufzulösen. Alle 34 Tests samt Coverage-Grenzen bestehen am endgültigen lokalen Repository-Pfad. Eine NPM-Veröffentlichung oder Studio-Auslieferung wurde nicht ausgeführt.
