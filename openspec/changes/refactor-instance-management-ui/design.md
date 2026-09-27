# Design: Aufgabenorientierte Instanzverwaltung

## 1. Ausgangspunkt und Entscheidung

Die drei bestehenden Routen `/admin/instances`, `/admin/instances/new` und
`/admin/instances/:instanceId` bleiben die Einstiegspunkte. Die UI arbeitet mit
dem aktuellen Registry-, Readiness-, Plan-, Tenant-IAM- und Plugin-Vertrag.
Aufgabenbezogene Darstellung ist der gewählte Entwurf: Einsteiger sehen die
aktuelle Entscheidung; Experten öffnen die zugehörige technische Tiefe.

Eine reine Umbenennung der Tabs beseitigt die wiederholten Karten und getrennten
Modullisten nicht. Ein globaler Expertenmodus würde den Sichtbarkeitszustand über
mehrere Aufgaben verteilen. Stattdessen werden Details lokal mit beschrifteten
Disclosure-Elementen geöffnet; ein Blocker bleibt unabhängig davon sichtbar.

Belegte Ausgangspunkte:

- `-instance-detail-page.tsx` rendert Kopf und Einrichtungscockpit auch für
  Bestandsinstanzen; Tabs liegen bei `status !== active` in einer Sammel-Disclosure.
- `-instance-detail-header.tsx` und `-instance-detail-cockpit-section.tsx`
  wiederholen Identität, Gesamtstatus und Lifecycle.
- `-instance-detail-betrieb-section.tsx` kombiniert Modul-Workspace,
  Transparenz-Tabelle, Plugin-Readiness-Karte und vollständigen Audit.
- `-instance-detail-doctor-section.tsx` zeigt die empfohlene Aktion als Text,
  während `runDetailAction` auf der Detailseite die vorhandene Ausführung besitzt.
- `onSaveAccountInvitationTemplate` baut seinen Update-Payload aus
  `detailFormValues` und kann dadurch andere lokale Änderungen mitspeichern.
- `IamInstanceListItem` besitzt Lifecycle und letzten Provisioning-Lauf, aber
  keine vollständige Tenant-IAM-/Plugin-Readiness. Die Liste darf diese nicht
  durch zusätzliche Detailabfragen für jede Zeile vortäuschen.

## 2. Informationshierarchie und Seitengerüst

1. **Aufgabe:** Zustand, notwendige Eingaben, Auswirkung und nächste Aktion sind sichtbar.
2. **Handlungsbedarf:** aktuelle Blocker und notwendige manuelle Schritte sind sichtbar.
3. **Technische Details:** Checks, Plan-Einzelheiten, Quellen, Serviceidentitäten,
   Request-/Run-IDs und Historie sind bei Bedarf erreichbar.

Kompakter Detailkopf: Anzeigename, Hostname, Instanz-ID, explizit benannter
Lifecycle und davon getrennter Betriebszustand. Ein kurzer Setup-Hinweis erscheint
nur, soweit erforderlich. `Doctor öffnen` bleibt an fester Stelle; ein relevanter
Befund verstärkt denselben Einstieg. Es gibt keine zweite Reihe gleicher Karten.

| Vorhandener Zustand                      | Hauptfläche                                        | Verhalten                                                                                                   |
| ---------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Daten werden geladen                     | Kompakter Ladezustand                              | Keine voreiligen Status- oder Aktionsbehauptungen.                                                          |
| `requested`, `validated`, `provisioning` | Einrichtung mit aktueller Aufgabe                  | Serverprojektion bestimmt wartet/läuft/blockiert/aktivierbar; Tabs darunter sichtbar.                       |
| `failed` mit Anlagekontext               | Einrichtung mit konkretem Fehler                   | Teilerfolge bleiben sichtbar, Fortsetzung nur nach vorhandener Serverfreigabe.                              |
| `active`                                 | `Betrieb`                                          | Aktuelle Probleme erscheinen als Betriebsbefund; kein automatischer Rücksprung zur Neuanlage.               |
| `suspended`, `archived`                  | `Betrieb` mit Lifecycle-Hinweis                    | Keine Darstellung als neu anzulegende Instanz; vorhandene zulässige Verwaltungsaktionen bleiben maßgeblich. |
| Fehlende/unklare Evidenz                 | Sichere bestehende Ansicht mit `Nicht verifiziert` | Keine erfundene erfolgreiche Prüfung oder mutierende Fallback-Aktion.                                       |

Diese Tabelle bestimmt ausschließlich die sichtbare Arbeitsfläche. Sie erzeugt
keinen neuen fachlichen Status und keine Freigabe. `active` ist keine behauptete
Live-Gesundheit. Ein fehlender Bootstrap-/IAM-Nachweis wird nach dem vorhandenen
Vertrag als Befund ausgewiesen; ein fehlender historischer Auditmarker erzeugt
keinen neuen verpflichtenden Setup-Nachlauf. Bereits erfolgreiche Schritte,
fachlicher Bootstrap-Vertrag und manuelle Aktivierung bleiben erhalten.

## 3. Liste und Anlage

Die Liste nutzt `StudioListPageTemplate` und `StudioDataTable`. Name/ID, Adresse,
Lifecycle, Suche und Statusfilter bleiben. Parent-Domain bleibt als sekundäre
Angabe zugänglich. Name öffnet das Detail; Suspendieren/Archivieren liegen im
beschrifteten Zeilenmenü `Weitere Aktionen` mit unveränderten Mutation-Guards.
Eine direkte Aktivierung wird nicht eingeführt.

Handlungsbedarf in der Liste stammt nur aus dem vorhandenen Listeneintrag oder
einem ausdrücklich gestarteten Gesamt-Audit. Ohne Evidenz wird keine gesunde
Tenant-IAM-Achse behauptet. Kein N+1-Detail-Laden beim Listenaufbau. Der bestehende
Gesamt-Audit bleibt eine sekundäre Aktion; Ergebnisse werden an einer Stelle
auf Anforderung aufgeklappt.

| Anlageschritt                       | Sichtbare Eingaben                                                                          | Details / Verhalten                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `Instanz`                           | Instanz-ID, Anzeigename, Parent-Domain                                                      | Studio-Kontext unverändert read-only; abgeleitete Adresse als Vorschau, servernormalisierter Host im Review.                      |
| `Nutzer-Datenbank (Keycloak-Realm)` | `Neu einrichten` / `Bestehende verwenden`; bei bestehend die aktuelle durchsuchbare Auswahl | Realm-Modus wandert aus Schritt 1 hierher. Abgeleitete Clients/Issuer bleiben read-only. Deaktivierte Realms behalten Begründung. |
| `Erster Administrator`              | Benutzername, E-Mail, Vorname, Nachname                                                     | Bestehende Pflichtangaben und Formatregeln bleiben erhalten.                                                                      |
| `Prüfen und anlegen`                | Alle fachlichen Werte einschließlich aller vier Admin-Angaben                               | Je Gruppe `Ändern`; nach Korrektur direkt zurück zum Review, soweit keine neue abhängige Eingabe nötig ist.                       |

Der bestehende Default `new`, Standard-Client-IDs, Secret-Vertrag und
Realm-Namensableitung bleiben erhalten. Technische Standards werden nicht als
zusätzliche Pflichtentscheidungen präsentiert. Keine Secrets in Review oder
Diagnose; nur konfigurierte/fehlende/automatisch erzeugte Zustände.

Jede relevante Entwurfsänderung invalidiert die bisherige Draft-Readiness.
Verspätete Antworten dürfen keinen neueren Entwurf freigeben. Vor dem Submit
werden alle Schritte erneut validiert; Create bleibt an die vorhandene
serverseitige Prüfung gebunden. Review-Befunde:

- `Vor der Anlage zu beheben`: Blocker offen, direkte Feld-/Schrittzuordnung.
- `Wird von Studio eingerichtet`: kompakte Aufgabenliste; normale geplante
  Arbeiten neutral. Wartende/blockierte Fähigkeiten mit Auswirkung sichtbar.
- `Vor der Aktivierung noch erforderlich`: notwendige Nutzerhandlungen sichtbar,
  technische Nachweise aufklappbar. Aktivierungsblocker werden nicht zu neuen
  Anlageblockern umgedeutet.

Erfolgreicher Create navigiert auf die vorhandene Detailroute. Die Persistenz
wird bestätigt, ohne eine fertige Einrichtung oder Aktivierung zu behaupten.

## 4. Einrichtung auf der Detailseite

Die bestehende Fünferfolge bleibt: `Bereitstellung vorbereiten`, `Änderungen
bestätigen`, `Technische Bereitstellung`, `Betriebsbereitschaft prüfen`,
`Aktivieren`. Eine schmale Statusfolge ersetzt die großflächigen parallelen
Karten. Genau die aktuelle Aufgabe erhält einen ausführlichen Abschnitt.

Dieser Abschnitt zeigt Ergebnis, Auswirkung, nächste Handlung und höchstens eine
hervorgehobene Aktion. Deren Aktionstyp, Plan-Fingerprint, Instanz-/Run-Bezug,
Retry-Klasse und vorhandene Fresh-Reauth-/Bestätigungsbedingungen werden aus dem
bestehenden Pfad übernommen. Fehlende Freigabe führt zu einer lesenden Prüfung
oder Diagnose, niemals zu einer aus lokalen Badges abgeleiteten Mutation.

Vor einer Planfreigabe stehen die relevanten Create-/Update-Auswirkungen sichtbar
in fachlicher Sprache. Vollständige Planschritte und Fingerprint sind
aufklappbar. Ein veralteter Plan oder geänderte Daten verlangen die bestehende
erneute Prüfung/Bestätigung; der alte Button bleibt nicht ausführbar.

Bei laufender Verarbeitung bleiben aktueller Schritt, tatsächlicher Zeitstempel
und bereits abgeschlossene Teilaufgaben sichtbar. Ein angenommener Auftrag ist
kein abgeschlossener Lauf. Keine erfundene Prozentanzeige oder Dauerprognose.
Polling aktualisiert die Evidenz, ohne Fokus, offene Details oder Formulardaten
bei jedem Refresh zurückzusetzen. Ein fehlgeschlagener Refresh lässt den letzten
bekannten Zustand als solchen stehen und kennzeichnet die fehlende Aktualisierung.

`Aktivieren` bleibt eine eigenständige, ausdrücklich bestätigte Mutation auf
aktueller Serverfreigabe. Die UI erweitert weder die Aktivierungsvoraussetzungen
noch die Pflichtaktionen nach ihrem Erfolg.

## 5. Betrieb und gemeinsame Modulansicht

Der vorhandene `InstanceModulesWorkspace` bleibt der fachliche UI-Einstieg für
Instanzdetail und `/admin/modules`. Seine Mutationscallbacks bleiben führend.
Die separate Transparenz-Tabelle und danebenstehende Plugin-Readiness-Liste
werden in der Instanzansicht durch eine gemeinsame Zeile je Modul ersetzt.

| Standardzeile                                                                      | Aufklappbare Vertiefung                                                     |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Aufgelöster Modulname, technische ID bei Bedarf                                    | Beschreibung aus vorhandenen Metadaten bzw. vorhandener Fallback            |
| Zuweisung: zugewiesen/nicht zugewiesen/nicht verfügbar                             | Aktivierungsrichtlinie, Herkunft, manueller Override, effektive Aktivierung |
| Bereitschaft: bereit/läuft/wartet/blockiert/nicht verifiziert oder nicht anwendbar | Einzelchecks, Fehler, aktueller Job, verfügbare Lifecycle-Reparatur         |
| Explizite passende Aktion                                                          | Systemrollen, Permissions und technische Wartung                            |

Es bleibt erkennbar, welche Module zugewiesen und welche verfügbar sind: über
Gruppierung oder den vorhandenen Tabellenfilter, ohne neue Kataloglogik. IDs
werden nur über die vorhandene Plugin-/Modul-Zuordnung verbunden; ungeklärte oder
nicht mehr installierte Zuordnungen bleiben sichtbar und werden nicht geraten.
Ein Modul ohne Lifecycle-Vertrag erhält `Keine technische Prüfung vorgesehen`;
ein erwarteter, aber fehlender/fehlerhafter Readiness-Datensatz erhält
`Nicht verifiziert`. Beides wird nicht als geprüft bereit gewertet.

Zuweisung und IAM-Seeding bleiben unmittelbar ausführbar wie im bestehenden
Workspace. Entzug behält seine explizite Bestätigung und Folgenvorschau. Policy,
fehlende Rechte, Nichtverfügbarkeit und aktive Jobs schränken Aktionen weiterhin
ein. `Reparieren` verwendet nur die vom vorhandenen Lifecycle-Vertrag angebotene
Operation und keine neue pauschale Reparatur. Ein leerer Modulsatz bleibt erlaubt.

Auf `/admin/modules` bleiben Instanzauswahl, Root-only-Zugriff und der bestehende
Bootstrap-Einstieg erhalten; die detailgebundene Darstellung ergänzt ihn nicht
um einen neuen Bootstrap-Pflichtschritt. Geteilte Komponentenanpassungen müssen
beide Verbraucher durch dieselben fachlichen Mutationen bedienen.

## 6. Befunde und Doctor

Ein Befund besitzt eine sichtbare Aussage, belegte Auswirkung und passende
Handlung. Die technische Tiefe zeigt freigegebenen Fehlercode/Klassifikation,
Quelle, Serviceidentität, Zeitpunkt und Run-/Request-ID, soweit vorhanden.
Fehlende Ursache oder fehlender Zeitpunkt werden nicht erfunden.

Die vorhandene Fehlerabbildung bleibt zuständig: `IamHttpError`,
`getInstanceErrorMessage` und die bestehenden Diagnosedetails werden verwendet.
`normalizeKeycloakWorkflowError` in `use-instances.ts` darf bei Detail-Laden,
Preflight und Planung vorhandene Fehler nicht pauschal in
`502/keycloak_unavailable` umdeuten. Status, Code, Request-ID, Klassifikation,
Diagnosestatus, Handlungsempfehlung, sichere Details und Berechtigungsbefund
bleiben, soweit vorhanden, bis zur zuständigen Darstellung erhalten. Unbekannte
Codes erhalten einen sicheren übersetzten Fallback ohne erfundene Ursache;
Rohantworten und ungeprüfte Fehlermeldungstexte werden nicht ausgegeben. Daraus
entsteht weder ein neuer Fehlervertrag noch eine allgemeine Fehler-Engine.

| Befund                                | Sichtbare Behandlung                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Ungültige Eingabe                     | Feldfehler plus verlinkte Summary; Format/erforderliche Änderung nennen.                                         |
| Realm-/Ownership-Konflikt             | Betroffenes Artefakt und Konflikt nennen; Auswahl/Konfiguration korrigieren.                                     |
| Session abgelaufen                    | Bestehenden Anmelde-/Reauth-Pfad verwenden; Entwurf nur ohne vollständigen Seitenwechsel erhalten.               |
| Fehlende Berechtigung                 | Fehlende administrative Handlung erklären; keine identische blinde Wiederholung anbieten.                        |
| Dienst nicht erreichbar               | Nicht bestätigte Prüfung erklären; lesende Prüfung erneut anbieten.                                              |
| Teilweise erfolgreiche Bereitstellung | Erfolge erhalten, fehlgeschlagene Phase und blockierte Folge erklären; Mutation nur bei sicherer Serverfreigabe. |
| Unbekannter/terminaler Fehler         | Sichere Diagnose und Korrelation; kein generischer mutierender Retry.                                            |
| Reine Warnung                         | Auswirkung und Geltungsbereich nennen; keine neue Sperre erzeugen.                                               |

Lokale Fehler und Reauth ohne vollständigen Seitenwechsel erhalten den Entwurf
in der geöffneten Oberfläche. Der vorhandene AuthProvider kann bei abgelaufener
Session vollständig zur Anmeldung navigieren; für diesen Fall wird kein
Entwurferhalt zugesagt. Auth-Verhalten und Session-Recovery bleiben unverändert.
Es wird keine zusätzliche Entwurfspersistenz eingeführt, insbesondere keine
Speicherung von Secret-Eingaben in Browser-Storage, URLs oder Logs.

Zusammenfassung gleicher Befunde ist nur zulässig, wenn Instanz, betroffene
Achse/Artefakt, Ursache, Aktualität und Folgeaktion zusammenpassen. Access-Probe,
Provisioner-Struktur und Rollen-Reconcile dürfen nicht durch dieselbe
Statusfarbe oder eine generische Überschrift als identischer Befund verschwinden.

Im Doctor bleibt die Reihenfolge `Überblick`, `Empfohlene Maßnahme`, `Reparatur
ausführen`, `Validieren`. Offene Befunde stehen zuerst, erfolgreiche Prüfungen
sind als Zusammenfassung sichtbar und vollständig aufklappbar. Die aktuell
zulässige Diagnose-/Reparaturmaßnahme ruft denselben Detail-Handler wie das Einrichtungscockpit auf;
keine doppelte lokale Aktionslogik. Die primäre Aktionsfläche des Cockpits wird
bei aktivem Doctor nicht zusätzlich gerendert; die kompakte Fortschrittsfolge
kann sichtbar bleiben. In Einstellungen steht die Formularaktion im Vordergrund.

Die Aktivierung bleibt ausschließlich im Einrichtungscockpit. Lautet die
serverseitige nächste Aktion `instance.status.activate`, führt der Doctor über
einen Link zum bestehenden Aktivierungsabschnitt und fokussiert dessen
Überschrift. Diese Navigation löst keine Mutation aus. Erst dort werden die
aktuellen Betriebsnachweise, manuellen Hinweise und die bestehende geschützte
Bestätigung angeboten; Fresh-Reauth und revisionsgebundene Freigabe bleiben
unverändert. Dafür entsteht weder eine neue Route noch ein zweiter Aktionshandler.

Nach einer Mutation zeigt der Doctor deren tatsächliches Ergebnis und erlaubt
die vorhandene Folgeprüfung. Ein HTTP-Erfolg/Queue-Eintrag darf nicht allein den
Betriebsstatus grün schalten. Vollständiger Instanz-Audit und historische Läufe
liegen in den aufklappbaren Bereichen `Prüfergebnisse` und `Technische Historie`.
Der Audit bleibt beim Detail-Laden im bisherigen Umfang verfügbar; seine neue
Position erzeugt keine zusätzliche automatische Access-Probe oder Prüfung.

## 7. Einstellungen und Speichergrenzen

Gruppen: `Allgemein`, `Erster Administrator`, `Account-Einladung`,
`Nutzer-Datenbank und Clients`, `Zugangsdaten`. Die ersten beiden sind offen;
Vorlage ist eine kompakte Karte mit bestehendem Dialog; die letzten beiden
sind eingeklappt mit Zustand/Zusammenfassung. Fehlende Zugangsdaten bleiben außen
sichtbar. Bootstrap-Angaben werden nicht als allgemeiner Benutzereditor erklärt.

Ein gemeinsamer Save speichert die Instanzeinstellungen einschließlich bewusst
bearbeiteter technischer Felder. Ausblenden verwirft keine Werte. Die Secret-
Eingabebedingungen bleiben erhalten: bestehendes Secret nie anzeigen, leere
Eingabe bedeutet unverändert, neue Werte nach erfolgreichem Save entfernen.
Kein automatisches Speichern durch Tabwechsel oder Aufklappen.

Der Vorlagen-Dialog besitzt einen eigenen Entwurf und Speicherstatus. Sein
Save/Reset verwendet den bestehenden Update-Endpunkt mit Template-Revision;
benötigte übrige Pflichtwerte stammen aus dem zuletzt geladenen gespeicherten
Instanzsnapshot, nicht aus dem offenen Einstellungsentwurf. Dies verhindert das
heutige Mitspeichern lokaler Draft-Werte, ohne einen neuen PATCH-Vertrag zu erfinden.
Instanz-Save und Vorlagen-Save werden nicht gleichzeitig ausgeführt. Ein
Vorlagenerfolg aktualisiert die Vorlagenquelle/-revision, lässt sonstige lokale
Änderungen dirty und erklärt sie nicht als gespeichert. Vorlagenkonflikte behalten
den `conflict`-Zustand statt ihn auf ein generisches Boolean zu reduzieren.

Das ist keine neue globale Nebenläufigkeitsgarantie: der vorhandene
Instanz-Update-Vertrag besitzt keine allgemeine Konfigurationsrevision. Ein
strenger Schutz vor gleichzeitig in anderen Sitzungen geänderten Stammdaten
wäre ein gesonderter Fachvertragsauftrag.

## 8. Implementierung, Accessibility und i18n

Die überarbeiteten Create-/Settings-Formulare verwenden den bestehenden
`react-hook-form`-/`zodResolver`-Standard und Studio-Form-Primitiven. Serverdaten,
Polling und Aktionsstatus bleiben außerhalb des Feldentwurfs. Der gemeinsame
Vorlagen-Editor verwendet bei notwendiger Formularüberarbeitung denselben
Standard; sein Servervorlagen-Verbraucher muss weiter funktionieren.

Feldvalidierung erweitert keine fachlichen Pflichten. Die lokale Prüfung
spiegelt die vorhandenen Vertragsregeln, der Server bleibt maßgeblich. Neue
oder wesentlich überarbeitete HTTP-Tests nutzen die vorhandenen MSW-Helfer;
keine parallele formularweite Eigenorchestrierung, keine neue Bibliothek.
Für Speichergrenzen und Fehlerweitergabe prüfen diese Tests den tatsächlichen
HTTP-Payload beziehungsweise die strukturierte Fehlerantwort über den bestehenden
Hook-/API-Pfad. Ein gemockter `useInstances`- oder `onSave`-Callback allein ist
dafür kein Nachweis. Die vorhandenen Komponententests bleiben für Darstellung
und Interaktion zuständig.

Alle Texte verwenden `t(...)` mit de/en-Ressourcen. Im Standardflow gilt
`Nutzer-Datenbank (Keycloak-Realm)`; Studio-Kontext bleibt exakt `Smart Village App`
oder `KasselDIALOG`. Bestehende native/shadcn-/Studio-Komponenten haben Vorrang.
Eine neue lokale Section-Datei ist nur bei belegtem Bedarf zulässig und ersetzt
ihren bisherigen Renderblock im selben Abschnitt.

- Bei Submit-Fehler erhält die Summary den Fokus. Ihr Fehlerlink aktiviert
  zuerst Tab/Schritt/Disclosure und fokussiert dann das Feld.
- Eingaben, Dirty-State und Fehler bleiben bei Tab-/Schrittwechsel erhalten.
  Hintergrundaktualisierung stiehlt keinen Fokus. Bei Instanzwechsel werden
  Daten/Antworten nicht dem falschen Tenant zugeordnet.
- Statusänderungen werden mit `aria-live`, Feldfehler mit `aria-invalid` und
  `aria-describedby` angekündigt; Farbe ist nie der einzige Bedeutungsträger.
- Menüs/Dialogs sind per Tastatur bedienbar; Schließen gibt Fokus zurück.
- Bei 320 CSS-Pixeln und 200 % Zoom bleiben Hauptaktion, Fehler und alle Bereiche
  ohne horizontales Seiten-Scrolling erreichbar. Tabellen nutzen vorhandenes
  responsives Verhalten; Formulare werden einspaltig.

## 9. Invarianten und geplante Nachweise

| Invariante                                                      | Geplanter direkter Nachweis                                                                                                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gleicher fachlicher Ablauf und bestehende Guards                | HTTP-nahe Tests prüfen Payload, Aktionsauswahl, fehlende/veraltete Freigabe, unveränderte Create-/Aktivierungsgrenze.                                                                                  |
| Aktivierung bleibt im Einrichtungscockpit                       | Detailtest mit `instance.status.activate`: Doctor-Link navigiert/fokussiert ohne Mutation; erst die bestehende Bestätigung im Cockpit aktiviert.                                                       |
| Strukturierte Fehler bleiben wahrheitsgemäß                     | HTTP-naher Hook-Test für Detail-Laden, Preflight und Planung: `database_unavailable` mit Klassifikation/sicheren Details bleibt erhalten; unbekannter Code ergibt keinen behaupteten Keycloak-Ausfall. |
| Lokaler Entwurferhalt überschreitet keine Session-Grenze        | Formularfall mit Fehler/Reauth ohne Dokumentwechsel erhält Werte und Dirty-State; bestehender vollständiger Anmeldewechsel bleibt unverändert und setzt keine neue Entwurfspersistenz voraus.          |
| Sichtbarer Fehler bei gleichzeitigen Teilerfolgen               | Komponenten- und Browserfall: Keycloak erfolgreich, lokales IAM fehlgeschlagen; kein Gesamtgrün und kein erneuter Create.                                                                              |
| Aktive/suspendierte/archivierte Instanz startet kein Onboarding | Zustandsfälle mit eingeschränkter/fehlender Evidenz in Detailtests.                                                                                                                                    |
| Planfreigabe und Ausführung beziehen sich auf denselben Stand   | Test mit Planänderung vor Ausführung und fehlendem Fingerprint; keine veraltete Mutation.                                                                                                              |
| Zuweisung ist nicht gleich Readiness                            | Fälle assigned+pending, required+missing, ohne Lifecycle, nicht installiert und leere Modulliste.                                                                                                      |
| Getrennte lokale Speicherbereiche                               | MSW-Test mit ungespeichertem Namen/Realm/Secret und Vorlagen-Save/Reset; Draft nicht im Payload, Dirty-State bleibt, Revisionskonflikt sichtbar.                                                       |
| Fehler und Expertenbereiche sind zugänglich                     | Tastatur-/Fokustests, bestehende A11y-Gates, Browsercheck bei schmalem Viewport und Zoom.                                                                                                              |
| Keine technischen Fähigkeiten gehen verloren                    | Zielort-Matrix unten gegen alte Renderpfade und Tests prüfen; gemeinsame Modul-/Vorlagen-Verbraucher regressionsprüfen.                                                                                |

Ein separates Assurance-Dokument ist nicht erforderlich: Es werden keine neuen
Trust Boundaries eingeführt. Die sicherheitsrelevanten bestehenden Grenzen und
ihre Nachweise sind hier ausdrücklich benannt.

## 10. Ablösung und Abnahme

| Heute                                              | Führender Zielort / Entfernung                                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Kopfkarten plus CockpitMetrics                     | Ein kompakter Kopf; doppelte Identitäts-, Lifecycle- und Gesamtstatuskarten entfernen.                                        |
| Setup- und TechnicalProgress-Karten                | Schmale Fünferfolge plus aktuelle Aufgabe; Teilschritte innerhalb dieser Aufgabe.                                             |
| Mehrfacher Fehler in Seitenalert/Anomalien/Evidenz | Ein führender Befund im betroffenen Arbeitsbereich; Kopf nur kurzer Hinweis/Link.                                             |
| Drei Modulflächen                                  | Ein gemeinsamer Modul-Workspace mit aufklappbarer Vertiefung; ersetzte Tabellen/Karten entfernen.                             |
| Vollaudit im Betrieb                               | Aufklappbare Prüfergebnisse im Doctor; globaler Audit bleibt in der Liste.                                                    |
| Empfohlene Maßnahme nur als Text                   | Diagnose/Reparatur samt vorhandenem Handler im Doctor; Aktivierung verlinkt ausschließlich zum bestehenden Cockpit-Abschluss. |
| Lange technische Settings-Fläche                   | Fachgruppen mit lokalen Disclosures und einem Instanz-Save.                                                                   |
| Einladung speichert Settings-Draft mit             | Vorlagen-Payload aus gespeichertem Snapshot; eigener Entwurf/Status.                                                          |

Schritte werden in der bestehenden Oberfläche ersetzt, ohne Feature-Flag,
Shadow-Ansicht oder neue Route. Aufgabenfolge und gezielte Gates stehen in
`tasks.md`; kein künstlicher PR-Stack ist vorgeschrieben. Vor Abschluss werden
hinzugefügte/entfernte Dateien, Renderwege und Konzepte auf unnötige Oberfläche
geprüft. Ein Wiederherstellen des vorherigen App-Builds benötigt keine
Datenmigration.

Aktualisiert werden `docs/reference/instance-lifecycle-navigation.md`, die
Formmigrationsinventur sowie die UI-Verantwortung in arc42 05 und Fehler-/Form-
Konzepte in arc42 08. Die veraltete Bezeichnung `Control Tower + Workbench`
wird am bisherigen Ort ersetzt. arc42 04/06 werden auf Widersprüche geprüft.

Abnahme: New-Realm-Anlage ohne technische Disclosures, Auswahl eines geeigneten
Bestands-Realms mit Korrekturrückkehr, gemischter Bereitstellungsfehler mit sicherer
Fortsetzung, aktiver Tenant mit Störung, Modulzuweisung mit ausstehender
Bereitschaft und voneinander unabhängige Settings-/Vorlagen-Saves. Browser-QA ist
ein Nachweis für die UI-Lieferung, kein neuer Schritt der Tenant-Erstellung.
