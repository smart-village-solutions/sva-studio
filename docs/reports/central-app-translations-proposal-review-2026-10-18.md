# Proposal Review – Zentrale App-Übersetzungen

**Geltung nach Überarbeitung vom 20. Oktober 2026:** Die Fachreview-Bewertungen und Nachweise unter „Historischer Fachreview“ beziehen sich ausschließlich auf den damaligen Entwurf vom 18. Oktober. Der Benutzer hat danach im Interview wesentliche Produktentscheidungen bestätigt und die Überarbeitung der sieben Planungsdateien beauftragt. Sie sind im Nachtrag festgehalten. Die historische Empfehlung „keine verbleibenden konkreten Review-Blocker“ ist **keine erneute Fachreview-Bestätigung des geänderten Entwurfs**. Das bestätigte gemeinsame Verständnis und der Dokumentationsauftrag sind ausdrücklich keine Implementierungsfreigabe. Alles bleibt uncommittet.

**Aktueller Anschlussreview:** Die nachfolgend dokumentierte spezialisierte Reviewrunde vom 19. Oktober prüfte die Interviewfassung und fand drei P2-Lücken. Deren vom Benutzer beauftragte Planpräzisierungen und Nachweisstatus stehen im Abschnitt zum Anschlussreview. Die spätere Cachevereinfachung wurde nicht erneut durch diese Reviewer geprüft.

**Aktueller Planungsstand — 20. Oktober:** Die im Main-Server-Interview bestätigte 90-Tage-Cache-Regel ersetzt sämtliche älteren Anforderungen dieses Reports an Löschung nach letzter Originalverwendung und den dafür vorgeschlagenen Originalabgleich. Die folgenden Review-/Vorabcheckabschnitte bleiben historische Befunde, keine aktuelle Lieferpflicht für Originalregister, Journal, Snapshot oder Sync. Der jüngste Nachtrag dokumentiert die Übernahme ohne neue unabhängige Fachabnahme.

## Historischer Fachreview — 18. Oktober 2026

## Meta

| Feld | Wert |
| --- | --- |
| Change-ID | `add-central-app-translations` |
| Proposal | [Zentrale App-Kataloge und dynamische Übersetzungen](../../openspec/changes/add-central-app-translations/proposal.md) |
| Review-Datum | 18. Oktober 2026 |
| Branch / Basis | `feature/central-app-translations`, `main` bei `4fd685eb4` |
| Phase / Modus | Planungsreview, lesende Fachreviews mit anschließender Überarbeitung des noch nicht freigegebenen Entwurfs durch den Autor |
| Reviewer | `translations_architecture_review`, `translations_security_review`, `translations_docs_review` |
| Fachabdeckung | Architektur, Interoperabilität, System-Assurance, Testqualität; Security/Privacy, Operations, Logging, Performance; Dokumentation, i18n/Content, UX/Accessibility, User Journey |
| Bündelung | Drei parallele Fachreviews statt eigener Läufe je Rolle gemäß flexibler Trigger-Matrix der Review-Governance; keine relevante kritische Fachperspektive ausgelassen |
| Ausführung | Keine Implementierung, Migration, externen Systemänderungen, Commits, Pushes, PRs oder Deployments |

## Gesamtbewertung

| Aspekt | Bewertung | Grundlage |
| --- | --- | --- |
| Architektur / Interoperabilität | Planungsreif | Bestehende Main-Server- und Graphile-Pfade; Empfängerschutz und Referenz-CAS als echte neue Abhängigkeit benannt |
| Security & Privacy | Planungsreif mit dokumentierten Aktivierungsvoraussetzungen | Serviceidentität, kanonische Bindung, zusätzliche Organisationsisolation, wertfreie Vorlagen und Profilprüfung |
| System-Assurance / Tests | Angemessene Nachweisplanung | INV-01 bis INV-08 mit direkten DB-, Empfänger-, Konkurrenz-, Crash-, Lease- und Negativnachweisen |
| Dokumentation / i18n | Nach Überarbeitung abgedeckt | YAML-Austausch und Sprachwechsel-Bootstrap ergänzt; erneutes Fachreview bestätigt |
| UX / Accessibility | Keine belegte normative Planabweichung | Zustands-/Freigabetrennung, Fokus/Tastatur/Statussemantik vorgesehen; reale WCAG-Abnahme erst an Umsetzung möglich |
| Operations / Performance | Risiken benannt, Aktivierung noch nicht freigegeben | Budgets, Workerbereitschaft, Restore-/Recovery-Nachweis, Datenschutz-/Anbieterentscheidung und Pilotgrenzen offen |
| Logging | Angemessen geplant | Sichere Codes/IDs und aggregierte Metriken; keine Texte, Secretwerte oder Text-Hashes in Logs |

**Gesamtempfehlung:** Fachlich als Proposal zur menschlichen Freigabe geeignet. Keine verbleibenden konkreten Review-Blocker. Dies ist weder Implementierungsfreigabe noch Nachweis bereits funktionierender Schnittstellen oder eines gewählten Anbieters.

## Findings – konsolidiert

### Blocker

Keine kritischen Architektur- oder Sicherheitsblocker in der Planungsprüfung gefunden. Die Main-Server-Empfängeränderung, Auth-ADR und menschlichen Entscheidungen bleiben ausdrücklich Liefer-/Aktivierungsvoraussetzungen.

### Wichtige Punkte

| ID | Befund / Gegenbeispiel | Korrektur am Entwurf | Nachprüfung |
| --- | --- | --- | --- |
| W1 | Profilprüfung gefordert, aber kein identifizierbares Profil im Batch; gleicher Darstellungskontext erlaubt keine Auswahl verschiedener HTML-Regeln | `profileId`/`profileVersion`, serverseitige Allowlist und Ablehnung vor Persistenz/Job; Schutzsemantik durch Kontext/Schlüsselversion eindeutig | Security-Reviewer: geschlossen |
| W2 | Erst spätere Tokenisierung würde `Hallo Anna`/`Hallo Ben` bereits persönlich speichern und getrennt hashen | Wertfreie freigegebene Vorlage vor Studio-Request, Hash und Persistenz; persönliche Werte ausschließlich lokal; eigenes Szenario/Negativnachweis | Security-Reviewer: geschlossen |
| W3 | Gepinnter Export beschrieb nur vollständiges Deutsch; erster Sprachwechsel hätte keine vereinbarten zielsprachlichen Lade-/Fehlertexte | Benannte `bootstrapKeys`, Auszug aus derselben Quelle/Revision für alle Zielsprachen; App-Bündelung bleibt beim App-Team | Dokumentations-/i18n-Reviewer: geschlossen |
| W4 | Beschlossenes YAML-Austauschformat fehlte | Kontrollierter YAML-Roundtrip mit denselben Berechtigungen/Validierungen, sicheren Parsergrenzen und Entwurfsimport; JSON für App/Build | Dokumentations-/i18n-Reviewer: geschlossen |

Zusätzliche Präzisierung des Autors: Kurze Snapshot-/Indexnamen gelten nur bei nachgewiesen kommunal isoliertem Main-Server-Namensraum; sonst kanonischer Kommunenpräfix. Architekturreview bestätigt keine neue Vertragsinkonsistenz.

### Hinweise

Vor Pilotabnahme akzeptierte Laufzeit-/Backloggrenzen und Degradationskriterien festlegen. Dies wurde in Design und Tasks aufgenommen; die Planung behauptet keine noch nicht gemessene Leistung oder vollständige Anbieterabdeckung.

## Konflikte und offene Entscheidungen

Keine widersprüchlichen Empfehlungen zwischen den Reviewern. Der erneute lesende Review bestätigt die vier Korrekturen und die unveränderte Planungsreife.

Menschlich offen bleiben die im Proposal nummerierten Entscheidungen: Pilot und fachliche Owner, erster Anbieter samt Datenschutz/Kosten, Identitätsbetreiber, Main-Server-Empfänger-/Buildzugang, App-Pilotverhalten und `zh`-/`pt`-Varianten sowie Aufbewahrung und verbindliche Betriebsbudgets. Historische tief integrierte App-Regeln wurden nicht als V1-Pflicht übernommen.

## Nachweise dieser Planungsrunde

- Bestehende OpenSpec-Changes und Specs gelistet; keine vorhandene zentrale App-Translation-Capability gefunden.
- Studio-DB-Übersicht und Soll-Snapshot vor dem Schemaentwurf geprüft; keine Änderungen an beiden vorgenommen, da keine Migration implementiert wird.
- Vorhandener Static-Content-Adapter, Serviceauth-Vorbild und Graphile-/Host-Jobpfad lesend geprüft.
- `openspec validate add-central-app-translations --strict`: erfolgreich.
- Dateiablageprüfung: erfolgreich.
- Dokuprüfung: erfolgreich; neue Planlinks zusätzlich geprüft.
- Keine Unit-, Type-, E2E- oder Live-Systemtests erforderlich/ausgeführt für diese reine Dokumentationsplanung. Geplante Implementierungsnachweise sind keine bestandenen Tests.

## Damalige nächste Schritte — durch den Nachtrag konkretisiert

1. Menschliche Proposal-Freigabe und Entscheidungen aus Abschnitt 1 des Lieferplans.
2. Erst danach einen konkret freigegebenen Lieferabschnitt umsetzen; keine stillschweigende Freigabe durch diesen Report.
3. Alle Planungsdateien bis dahin uncommittet belassen. Das MagdeApp-Projekt bleibt unverändert.

## Nachtrag — bestätigtes Interview und Planüberarbeitung am 19. Oktober 2026

### Umfang und Freigabestatus

Der Benutzer bestätigte das gemeinsame fachliche Verständnis und beauftragte ausschließlich die Überarbeitung der sieben vorhandenen Planungsdateien. Keine Implementierung, Migration, Änderungen an externen Quellprojekten/Systemen, Commits, Pushes, PRs oder Deployments. Während der Interviewüberarbeitung wurde keine neue Fachreviewrunde durchgeführt; der spätere Anschlussreview steht separat unten. Die bestehende historische Reportdatei bleibt erhalten; kein neuer Reviewbericht oder zusätzliches Governance-Artefakt.

### Bestätigte Entscheidungen

| Thema | Verbindlicher neuer Planungsstand |
| --- | --- |
| Erste Auslieferung | Feste und dynamische Strecke gemeinsam; sämtliche zulässigen Anzeigetexte unabhängig vom Inhaltstyp, nicht auf News/Events/POIs begrenzt |
| Pilot und Sprachen | Magdeburg mit allen 19 Zielsprachen; vereinfachtes Chinesisch und Portugiesisch aus Portugal. Andere Kommunen wählen selbst aus zentral geprüfter Sprachliste; Deutsch bleibt vorhanden |
| Anbieter | Ein zentral betriebener DeepL-Anbieter für feste und dynamische Texte, keine kommunale Anbieterwahl und kein zusätzlicher SSF-Adapter |
| Feste Standards | Einmal zentral übersetzen; veröffentlichte Änderungen automatisch kommunal übernehmen, ohne kommunale Zusatzfreigabe. Veröffentlichte Overrides und unveröffentlichte Entwürfe schützen |
| Overrides | Je Schlüssel und Sprache, kein automatisches Erzeugen anderer Sprachfassungen aus deutschem Override. Ausdrückliche Übernahmeaktion kann weitere Overrides erzeugen; vorhandene manuelle Korrekturen schützen |
| Korrekturen | Zunächst nur feste Kataloge manuell korrigieren. Bei Änderung ihrer tatsächlichen deutschen Quelle Korrektur erhalten und vor Veröffentlichung bestätigen oder ausdrücklich neu übersetzen |
| Veröffentlichung | Speichern bleibt Entwurf; ausdrückliche Veröffentlichung startet Übersetzung und technische Prüfungen, keine obligatorische sprachliche Einzelabnahme. Erst vollständigen kommunalen Satz aus Deutsch und allen angebotenen Sprachen gemeinsam aktivieren |
| Begrenzte Ausnahme | Ausschließlich neue Schlüssel dürfen bei ausdrücklich bestätigtem App-Release vorübergehend gekennzeichnet Deutsch verwenden; keine allgemeine Ausnahme für Änderungen bestehender Texte oder Integritätsfehler |
| Dynamische Anzeige | Beim Anzeigen anfordern; kommunal getrennt wiederverwenden. Je Inhaltseintrag alle sichtbaren Textfelder gemeinsam anzeigen; maximal fünf Sekunden warten, dann bei Timeout/Fehler Deutsch für diese Ansicht beibehalten. Späte Ergebnisse erst bei späterem Aufruf verwenden |
| Offline und Hinweis | Sofort vollständige lokale Übersetzung oder Deutsch ohne Wartefrist. Dezenter Hinweis je Ansicht in gewählter Sprache; keine Dialoge/Marker/Original-Buttons je Inhalt |
| Build und Sprachwahl | Deutsch plus alle angebotenen kommunalen Kataloge gepinnt bündeln. Sprachwahl lokal ohne Konto; Erststart mit angebotener gebündelter Gerätesprache, sonst Deutsch |
| Downloads und Updates | Neue Sprachen auch in installierten Apps nach vollständigem geprüftem Download. Bis Erfolg bisherige Sprache, bei Fehler Fehlermeldung. Vorhandene Sprachen sofort wechseln; automatische Katalogupdates erst beim nächsten Öffnen einer Ansicht |
| Sprachsperre | Deaktivierte Sprache nach erkanntem Abgleich vollständig sperren, keine Bestandsschutzversorgung. Verpflichtender verständlicher Sprachwahldialog, Deutsch vorausgewählt. Bei Downloadfehler offenhalten und gebündeltes Deutsch anbieten; unbekannte Offline-Sperren erst nach Abgleich erkennbar |
| Quellen und Datenschutz | Mehrsprachigkeitsvereinbarung umfasst Zustimmung für eingebundene Inhalte, auch öffentliche redaktionelle Namen. Kein technischer Freigabeprozess pro Mandant oder Quelle. Private Nutzerwerte, direkte Freitexteingaben, technische Felder und externe Webseiten bleiben ausgeschlossen; nur Deutsch als Quelle |
| Löschung (historisch, am 20. Oktober ersetzt) | Damals Entfernung nach letzter Originalverwendung; aktuell ausschließlich tägliche dynamische Cachebereinigung nach 90 Tagen ohne serverseitigen Abruf. Kein Originalregister/-abgleich; keine zusätzliche Gerätelöschung |
| Originalveröffentlichung | Unabhängig von DeepL-/Übersetzungsausfällen weiterhin möglich |
| Budget | Ausreichendes Budget wird zunächst angenommen; keine kommunale monetäre Budgetsperre. Technische Eingabe-/Rate-/Retry-/Parallelitätslimits und Kostenbeobachtung bleiben bestehen |

### Änderungen an Verträgen und Nachweisplanung

- Gemeinsame Katalogsatz-Aktivierung statt unabhängiger Sprachaktivierung: Empfänger muss alle angebotenen Sprachreferenzen und Sprachkonfiguration per generationellem Indexwechsel gemeinsam aktivieren. Die eng bestätigte Neuschlüssel-Ausnahme wird explizit am Release/Export geführt.
- Automatische Standardjobs arbeiten ausschließlich mit veröffentlichten kommunalen Overrides, nicht mit offenen Entwürfen. Sprachbezogene Overrides und Korrekturen werden nach tatsächlichem Quellbezug behandelt, nicht pauschal durch jeden deutschen Override invalidiert.
- Originalreferenz/-revision ergänzt den dynamischen Vertrag außerhalb des Cache-Keys. Der Main-Server muss tatsächliche verbleibende Verwendungen autoritativ feststellen; bloße Zählung beobachteter Geräteanfragen reicht nicht. Separates Recht `appTranslations.dynamicSync`, Lösch-/Änderungsordnung und Worker-Fencing sind geplant, nicht implementiert.
- INV-01 bis INV-08 wurden angepasst; INV-09 (letzte tatsächliche Originalverwendung), INV-10 (Anzeige-/Sprachzustände) und INV-11 (vollständige App-Abdeckung) ergänzt. Das sind geplante Implementierungsnachweise, keine bestandenen Tests.
- W3 aus dem historischen Review bleibt als Erkenntnis erhalten; der damalige kleine Bootstrap-Auszug wird jetzt durch Bündelung aller kommunal angebotenen vollständigen Kataloge abgelöst. Bootstraptexte bleiben Teil derselben Quelle. W1/W2/W4 bleiben fachlich relevant; technische Profile sind kein zusätzlicher Quellenfreigabeprozess.

### Prüfungen dieser Überarbeitung

- Strict OpenSpec: erfolgreich, `Change 'add-central-app-translations' is valid`, Exitcode 0. Wegen fehlender asdf-Zuordnung des Standardaufrufs wurde die bereits installierte OpenSpec-CLI direkt ausgeführt. Deren abschließende Telemetrie meldete einen Netzwerkfehler; die lokale Validierung war erfolgreich.
- Dateiablage: erfolgreich über `node --import tsx scripts/ci/check-file-placement.ts` (9059 versionierte Dateien). Zusätzlich dieselbe vorhandene `findFilePlacementViolations`-Funktion auf alle sieben unversionierten Planungsdateien angewandt: erfolgreich. Nichts dafür gestagt.
- Dokumentationsprüfung: erfolgreich über `node --import tsx scripts/ci/check-documentation.ts`; Links, Indizes und Wiki-Publikation konsistent. Die normalen pnpm-Aufrufe scheiterten am gesperrten IPC-Socket des tsx-CLI-Starters; dieselben Prüfer ohne CLI-Starter liefen erfolgreich, ohne Konfigurationsänderung oder Eskalation.
- Alle sieben Planungsdateien zusätzlich auf 15 relative Dateilinks, nachgestellte Leerzeichen und Szenarien je Requirement geprüft: erfolgreich. Inhaltlicher Abgleich der bestätigten Interviewentscheidungen zwischen Proposal, Design, Tasks und Delta-Specs durchgeführt.
- Keine Unit-, Type-, E2E-, Live-System- oder DeepL-Tests und keine erneuten Fachreviews. Historisch bestandene Prüfungen werden nicht als aktuelle Implementierungsnachweise ausgegeben.

### Verbleibende Voraussetzungen und nächster Schritt

Offen bleiben benannte Owner und konkrete Pilotbindung, technische Serviceidentität/ADR, DeepL-Vertrag und verifizierte Abdeckung der 19 Pilotsprachen, revisionsfester Main-Server-Empfänger samt lesendem Buildzugang und autoritativem Originalabgleich, konkrete technische Betriebsgrenzen sowie Betriebsdaten-/Backup-Aufbewahrung und Löschweitergabe. Pilot, Anbieter, Sprachvarianten, Anzeigeverhalten und kommunale Sprachwahl sind entschieden und werden nicht erneut als offene Produktentscheidungen geführt.

Vor Umsetzung den konkreten Lieferabschnitt und die technische Nachweisplanung freigeben lassen. Keine stillschweigende Implementierungsfreigabe durch Interview, Planprüfungen oder diesen Nachtrag. Alle sieben Dateien bleiben uncommittet; MagdeApp bleibt unverändert.

## Spezialisierter Anschlussreview und beauftragte Korrekturen — 19. Oktober 2026

### Reviewumfang

Drei lesende Subagents prüften die vollständigen sieben Planungsdateien nach dem Interview. Die Fachperspektiven wurden gemäß Review-Governance gebündelt:

| Subagent | Fachabdeckung | Ergebnis |
| --- | --- | --- |
| `catalog_contract_review` | Architektur, Interoperabilität, System-Assurance und Testqualität der festen Kataloge | Ein P2: persistierte veröffentlichte globale Standardrevisionen im Releasebestand explizit ergänzen |
| `dynamic_security_review` | Security/Privacy, dynamischer Lebenszyklus, Operations, Logging und Performance | Ein P2: aktuelle Inhaltsberechtigung auch bei Treffer-/Statusausgabe prüfen |
| `app_i18n_review` | Dokumentation, i18n/Content, UX/Accessibility und User Journey, DeepL-Sprachumfang | Ein P2: tatsächliche Textsprache für Screenreader/Vorlesen einschließlich deutscher Rückfälle verwenden |

Keine P1-Blocker und keine widersprüchlichen Empfehlungen. Die technischen Implementierungsnachweise müssen im Planungsreview noch nicht ausgeführt sein; ausdrücklich offene Lieferabhängigkeiten wurden nicht allein als Findings gewertet. Satzaktivierung/Read-back/CAS, kommunaler Override-/Entwurfsschutz, Mandantentrennung, Job-Recovery/Fencing und Löschung nach letzter tatsächlicher Verwendung sind ansonsten angemessen geplant.

Die offizielle [DeepL-Sprachdefinition](https://github.com/DeepLcom/deepl-dotnet/blob/main/DeepL/LanguageCode.cs) ergab keinen belegten grundsätzlichen Ausschluss der 19 Pilotziele. Konkrete Konto-/API-/Featureabdeckung und Übersetzungsqualität bleiben nachzuweisen; kein Live-DeepL-Aufruf durchgeführt. Für sprachbezogene Accessibility gilt [WCAG Language of Parts](https://www.w3.org/WAI/WCAG21/Understanding/language-of-parts.html).

### Findings und auf Benutzerauftrag eingearbeitete Planpräzisierungen

| ID | Befund / Gegenbeispiel | Kleinste eingearbeitete Korrektur | Geplanter direkter Nachweis | Status |
| --- | --- | --- | --- | --- |
| R1 / P2 | Artikel beim Erstbatch sichtbar, vor Poll unsichtbar; reine Tenant-/Entry-ID-Prüfung könnte Text weiter ausgeben | Main-Server bindet jede App-seitige Treffer-/Statusausgabe an aktuell lesbare Originalreferenz/-revision. Keine Löschung des gespeicherten Treffers; Zugriff über anderen sichtbaren Bezug bleibt möglich. Design 6, App-/Main-Server-/IAM-Spec, Tasks 4.3/4.5, INV-01 | Zwischen zulässigem Erstbatch und Treffer-/Statusabruf Sichtbarkeit oder Leserecht entziehen; keine Ausgabe über diesen Bezug, anderer zulässiger Bezug weiter bedienbar | Auf Planungsebene eingearbeitet |
| R2 / P2 | Standard S1 veröffentlicht, kommunaler Job wartet, globaler Draft S2 überschreibt veränderliche Basis | Bestehender Releasebestand speichert globale und kommunale versiegelte Revisionen. Kommunale Jobs pinnen veröffentlichte globale Werte statt aktueller Drafts. Keine zusätzliche Tabelle. Design 3/8, App-Spec, Tasks 2.1/2.5/2.7, INV-02 | S1 veröffentlichen, Fan-out verzögern, S2 nur als Draft speichern und Job nach Prozessabbruch wiederanlaufen lassen: ausschließlich S1 plus veröffentlichte kommunale Overrides | Auf Planungsebene eingearbeitet |
| R3 / P2 | Ukrainische Ansicht mit deutschem Rückfallartikel oder neuem deutschen Ersatzschlüssel würde mit pauschal ukrainischer Sprache vorgelesen | Sprachkennzeichnung und Screenreader-/Vorlesesprache folgen tatsächlichem Text: deutscher Inhalt `de`, ukrainischer Hinweis/Oberfläche ukrainisch. Vorhandene Ausgabemittel, keine neue Metadateninfrastruktur. Design 9, App-Spec, Tasks 6.6, INV-10 | Gemischte Ansicht mit deutschem dynamischem Rückfall und bestätigtem deutschem Neuschlüssel-Ersatz vorlesen und Sprachkennzeichnung prüfen | Auf Planungsebene eingearbeitet |

Alle drei Korrekturen wurden vom Benutzer ausdrücklich beauftragt. Proposal, Design, Tasks und betroffene Specs sind konsistent ergänzt; keine Produktentscheidung erneut geöffnet. Der Autor prüft die Einordnung und Verweise gezielt nach; **keine zusätzliche unabhängige Subagent-Nachprüfung der Korrekturen** wird behauptet. Diese Runde ergänzt die vorhandene Reportdatei statt einen weiteren Bericht anzulegen.

### Nachweise der Korrekturrunde

Strict OpenSpec, Dateiablage und Dokumentationsprüfung der korrigierten Planung sind erfolgreich. Die bestehende installierte OpenSpec-CLI wurde mit `DO_NOT_TRACK=1` direkt aufgerufen; Dateiablage und Doku liefen wie zuvor über dieselben vorhandenen Prüfer mit `node --import tsx`, ohne gesperrten CLI-IPC-Starter. Zusätzlich alle sieben unversionierten Planungsdateien über den vorhandenen Dateiablageprüfer sowie relative Dateilinks, Whitespace und Requirement-Szenarien geprüft. Kein neues Prüfskript angelegt und nichts gestagt.

Ausschließlich Planungsdateien geändert; keine Implementierung, Migration, Unit-/Type-/E2E-/Live-Tests, Commits, Pushes, PRs oder Deployments. Geplante Negativ-, Wiederanlauf- und Accessibility-Tests sind keine bereits bestandenen Implementierungstests. Alle sieben Dateien bleiben uncommittet; die technische Implementierungsfreigabe steht weiter aus.

## Lesender technischer Vorabcheck — 19. Oktober 2026

Auf Benutzerauftrag die vier Voraussetzungen am bestehenden Code und öffentlichen offiziellen DeepL-Quellen geprüft; Resultate und konkrete Datei-/Zeilenbelege stehen direkt in **Design 1.1**, Zusammenfassung im Proposal, offene Lieferaufgaben in Tasks 1.1–1.7. Task 0.6 bezeichnet ausschließlich diesen abgeschlossenen Vorabcheck, keine erfüllte Integrations-/Implementierungsabnahme. Kein zusätzlicher Report oder neues Planungsartefakt.

| Bereich | Vorhanden | Gezielt zu erweitern | Noch offen |
| --- | --- | --- | --- |
| DeepL | Offizielle Sprachdefinition enthält alle 19 Pilotziele samt `pt-PT`, `zh-Hans`, Thai; Text-API und aktuelle v3-Sprach-/Featureabfrage dokumentiert | Zentraler serverseitiger Adapter fehlt im geprüften Studio-Laufzeitcode | Tatsächliches API-Konto, Features/Status, bewusste `en`-Zielvariante, Vertrag und Qualität; kein Live-Aufruf |
| Katalogempfänger / Build | Kommune-/Name-/Versionsmodell, kompatibler JSON-Leser und ausgehender OAuth-Transport | Create-or-confirm für alle Writer, Inhalts-Read-back, gemeinsamer Satz-CAS, erwartete Identität statt SemVer-Fallback, App-/Buildpinning | Reale Größen-/Zeichensatzgrenzen, dedizierter lesender OAuth-Owner, technischer Publisher und Main-Server-Vertragsabgleich |
| Originallebenszyklus | Tatsächliche Rollen-/Sichtbarkeits-/Providerfilter, globale Quellen, verschachtelte Texte und einzelne Cache-/Importereignisse | Allgemeiner Originalrevisions-/Verwendungs-/Löschabgleich einschließlich bisher nie angefragter Originale; sichere aktuelle Treffer-/Statusausgabe | Konkreter minimaler Abgleich am bestehenden Inhaltsweg; vorhandene TMB-Webhooks sind nur importbezogen |
| Serviceidentität | Keycloak-JWKS/RS256/Issuer/Audience, Callerbeispiele für Client-/Actionprüfung, OIDC-/SSF-Provisionierungsvorbilder und ausgehende organisationsgebundene Credentials | Neue Übersetzungsfassade mit kanonischer Client→Instanz/Org-Bindung und Main-Server→Studio-Tokenclient | Tatsächlicher Issuer/Realm, Audience/Clientanlage, Rotation/Widerruf, Secretzustellung und ADR |

### Quellstand und Abgrenzung

- Studio: `4fd685eb4cc6a6892d7932d39700488e9f5f4c60`, `feature/central-app-translations`.
- Main-Server: `76d2e12af092197f3cf58f2e4886fa8fe2a30c5b`, `feature/app-translation-gateway`; bereits vorher `plans/README.md` geändert und `plans/002-app-translation-gateway.md` unversioniert.
- MagdeApp: `69c01e89e0d409d22731f9fb0823970bdb763f25`, `feature/SVAK-212-mehrsprachigkeit`; bereits vorher drei unversionierte Übersetzungsplanungsdateien.
- Externe Repositories nur gelesen. Ihre vorhandenen Änderungen bleiben fremdes Eigentum; kein Branchwechsel, Reset oder externer Schreibzugriff. Keine Remote-Aktualität, Live-Deployments, DB-Schemata oder Kontoberechtigungen durch den lokalen Quellstand belegt.
- Der parallele Main-Server-Plan ist ausdrücklich **keine implementierte Schnittstelle**. Insbesondere sprachweise Aktivierung und bisher deutschzentrierter Buildvertrag müssen vor Umsetzung an die bestätigten Studio-/App-Regeln angepasst werden. Kein anderes Chat wurde angeschrieben und keine technische Abstimmung vorgetäuscht.
- Die vorhandene `publicJsonFile`-Versionssuche ist eine Kompatibilitätsauswahl (`<=`), keine exakte Revisionsabfrage. Das geplante Empfänger-/Exportverhalten prüft daher Name, gespeicherte Version, Envelope und Prüfsumme. Aktuelles `text`/`utf8mb3`-Schema ist kein Nachweis ausreichender Kataloggröße/Unicodefähigkeit.
- Kein allgemeiner Übersetzungs-Verwendungsindex, keine übersetzungsspezifische Servicebindung und kein DeepL-Adapter im geprüften Quellstand gefunden. Die einschlägigen bestehenden Pfade bleiben Ausgangspunkt; keine zusätzliche Provider-/Provisionierungsplattform entworfen.

### Nachweise dieses Vorabchecks

Quellstellen und offizielle API-Referenzen lesend ausgewertet; keine Unit-/Type-/E2E-, DB-, Token-, Netzwerk- oder Providerfunktionstests durchgeführt. Öffentliche Webdokumentation wurde abgerufen, aber kein Konto verwendet, kein Secret gelesen und kein Text an DeepL gesendet. Konkrete Vertrags-/Kontoprobes und spätere Integrationstests bleiben offene Liefernachweise.

Strict OpenSpec erfolgreich (`Change 'add-central-app-translations' is valid`, Exitcode 0), bestehende Dateiablageprüfung erfolgreich (9059 versionierte Dateien), zusätzlich alle sieben unversionierten Planungsdateien geprüft. Dokumentationsprüfung erfolgreich; zusätzlich 15 relative Planlinks, Requirement-Szenarien und Whitespace geprüft. Prüfsummen der fünf bereits vorhandenen fremden Planungsdateien nach dem Check unverändert; keine versionierten oder gestagten Studio-Änderungen. Ausschließlich die vorhandenen Planungsdateien ändern; keine Implementierung, Migration, Commits, Pushes, PRs oder Deployments. Alles bleibt uncommittet.

## Konkretisierung Originalabgleich und Katalogvertrag — 19. Oktober 2026

Auf Benutzerauftrag ausschließlich bestehende Studio-Planungsdateien überarbeitet. [Design](../../openspec/changes/add-central-app-translations/design.md) 7.1 enthielt damals den technischen Vorschlag zum Originalabgleich; dieser wurde am 20. Oktober durch die bestätigte dynamische Cachepflege ersetzt. Abschnitt 4.1 enthielt den damaligen Vergleich mit dem unveränderten Main-Server-Plan 002 und den Studio-seitigen Zielvertragsvorschlag. Task 0.7 dokumentiert diesen Planungsschritt; keine Integrationsaufgabe wird damit als implementiert oder beiderseitig freigegeben markiert.

### Originalabgleich — historischer Vorschlag, am 20. Oktober vollständig ersetzt

- Vollständiger unveränderlicher Anfangsbestand aller zulässigen Originalfelder einschließlich unsichtbarer/noch nie angefragter und global eingebundener Inhalte, mit Studio-vergebener Epoch, CAS auf den bisherigen Stand, fester Commitgrenze, Seiten-/Gesamtprüfung und explizitem Abschluss.
- Danach dauerhafte technische Änderungsmetadaten aus demselben lokalen Originalcommit. Vollständige Feldersetzung beziehungsweise Löschmarke pro Original, geordnete Folge und idempotenter Cursorfortschritt in Studio. Metadaten enthalten keine Original-/Ergebnistexte, Anbieterjobs oder Zielsprachen. Originalveröffentlichung wartet nicht auf Studio/HTTP/Queue/DeepL.
- Quellenbestand `translation_source_refs` und Abgleichzustand an vorhandener Service-/Scopebindung konkretisiert. Erforderlicher nicht eindeutiger `source_identity`-Gruppenindex an Entries dient der Zuordnung aller Zielergebnisse bei letzter Verwendung, nicht einer neuen Cache-Lookup-/Unique-Strecke. Dies ist die begründete Präzisierung des bisher bewusst offenen Originalbezugsmodells; kein Main-Server-Ergebnisspeicher, keine Tabelle je Inhaltstyp, keine weitere Providerqueue und keine Gerätelöschung.
- App-Batches dürfen keine Originalbezüge neu anlegen; unbestätigter Quellenstand liefert `source_sync_pending` ohne Entry-/Jobanlage. Gateway prüft aktuelle Ausgabe weiterhin am Original. Worker darf einen geteilten Text bei anderer verbleibender Verwendung bearbeiten, bei fehlender Verwendung aber keine gelöschte Entry per Upsert wiederherstellen.
- Löschung erst am vollständig bestätigten Quellschnitt. Lücken, Teilbestand, Restore oder unbekannte Epoch bereinigen nicht; authentifizierter Replay beziehungsweise vollständiger Neuabgleich erforderlich. Kein Echtzeit-/Exactly-once-Versprechen über beide Datenbanken: eine erst nach dem Schnitt tatsächlich neu entstandene Verwendung kann nach Abgleich eine neue Entry-ID und Übersetzung benötigen. Maximales Abgleichalter und Recovery-/Journal-/Snapshotgrenzen bleiben vor Pilotaktivierung festzulegen.
- Ergänzte Szenarien: nie angefragter zweiter Bezug, paralleles Schreiben beim Snapshot, fehlende/doppelte/vertauschte Seiten/Intervalle, ACK-Verlust, alter Snapshotbeginn, Restore, neuer Bezug gegen Bereinigung und legitime Neuanlage nach bestätigtem Löschschnitt. Diese Tests sind geplant, nicht ausgeführt.

### Katalogvertrag und Abgleich mit Main-Server-Plan 002

| Übernommen aus Plan 002 | Studio-seitig konkretisiert / dort nachzuführen |
| --- | --- |
| Vorhandener Static-Content-Transport und direkte Mutationantwort, revisionsfeste Create-or-confirm-Idee | Kanonischer Scopepräfix, unveränderliche Vertrags-/Locale-/Sprachnamen, gemeinsame Kanonisierungsfixtures und zusätzliche Satz-/Ausnahmemetadaten |
| `publicJsonFile` als Leseweg mit kontrolliertem Versionsfallback | Vollständige Metadaten-/Envelope-/Digestprüfung und gepinnter kommunaler Vollsatz für den Build |
| Dedizierter geschützter Index und erwartete Generation | `activateAppTextCatalogSet` mit vollständigem Deskriptor, Sprachauswahl und `setChecksum`; keine sprachweise Teilaktivierung |
| ACK-/Konfliktbehandlung und Read-back | Gleicher aktiver Satz als No-op; abweichender Inhalt derselben Satzrevision und ältere Satzrevision auch mit frischer Generation ablehnen |
| Eng begrenzte Eingriffe statt globalSettings-Rewrite | Ableitbarer Indexname, für V1 überhaupt kein globalSettings-Write und kein paralleler Discoverypfad |
| Vorhandener Gateway, Quellenprüfung und Statushandle als Vorschläge | Sämtliche zulässigen Profile, kein zusätzlicher Quellenfreigabeprozess, zusätzlicher Originalmetadatenabgleich und getrennte technische Limits statt monetärer Budgetsperre |

Der Main-Server-Plan wurde **nicht** geändert, seine API ist nicht implementiert und eine Zustimmung seines Teams wird nicht behauptet. Ein konkreter Satzvertrag und eine explizite Delta-Tabelle ersetzen die bisher nur allgemeine Abhängigkeit. Beiderseitige Übernahme, tatsächliche Publisher-/Buildidentitäten, Pilot-App-Version sowie Größen-/Storage-/Unicode- und Integrationsnachweise stehen weiterhin aus.

### Prüfung und Ausführungsgrenzen

Strict OpenSpec erfolgreich (`Change 'add-central-app-translations' is valid`, Exitcode 0). Bestehende Dateiablageprüfung erfolgreich (9059 versionierte Dateien), zusätzlich alle sieben unversionierten Planungsdateien geprüft. Dokumentationsprüfung erfolgreich; 16 relative Planlinks, Requirement-Szenarien und Whitespace zusätzlich geprüft. Prüfsummen der fünf bereits vorhandenen fremden Planungsdateien unverändert; keine versionierten oder gestagten Studio-Änderungen. Die Prüfungen validieren Dokumentationsstruktur/-konsistenz, nicht die geplanten DB-, Netzwerk-, Konkurrenz- oder Recoveryeigenschaften. Keine erneute breite Fachreviewrunde, keine Implementierung, Migration oder Unit-/Type-/E2E-/Live-Tests; keine Nachrichten an andere Chats, externen Änderungen, Commits, Pushes, PRs oder Deployments. Die vorhandenen sieben Planungsdateien bleiben uncommittet; MagdeApp- und Main-Server-Planungsdateien unverändert.

## Übernahme der bestätigten Cachevereinfachung — 20. Oktober 2026

Auftrag: ausschließlich die sieben bestehenden Studio-Planungsdateien ändern; keine Implementierung, Migration, Featuretests, Commits oder externe Änderungen. Den aktuellen Main-Server-Plan `plans/002-app-translation-gateway.md` nur gelesen. Seine Produktentscheidung ersetzt die ältere Studio-Regel für sämtliche dynamischen Inhalte einschließlich Bus; konkrete Katalog-/Service-APIs bleiben technische Vorschläge ohne behauptete beiderseitige Abnahme.

- Design 7.1, Proposal, Tasks und alle drei Delta-Specs auf `last_used_at` umgestellt: erfolgreiche Fertigstellung initialisiert; autorisierte App-Batch-/Statusantwort mit fertigem Ergebnis aktualisiert nach Studio-Serveruhr nur die ausgegebene Sprachfassung. Abruf ist kein Nachweis tatsächlichen Lesens.
- Verweigerte Anfragen, reine Pending-/Processing-Polls, Worker-/Wartungs-/Hintergrundzugriffe und lokale/Offline-Nutzung verlängern nicht. Keine Nutzungs-Heartbeats oder Geräte-/Benutzerhistorie.
- Tägliche zentrale Bereinigung nach mindestens 90 Tagen mit atomarer erneuter Frist-/Zustandsprüfung, Schutz aktiver Jobs/Leases und gefencten Updates bestehender Entry-IDs statt Worker-Upsert. Jobausfall kann Ablage verlängern; spätere berechtigte Anzeige darf erneut übersetzen und Kosten verursachen.
- Originalregister, Textgruppenindex, Journal/Commitfolge, Originalbestandssnapshots, Sync-Epochen/Cursor/Replay/Tombstones, Verwendungsprüfung, letzte-Verwendung-Löschung, `dynamicSync`, Sync-Endpunkt/-Jobs/-Hooks und Sync-Pending-Gates aus aktuellem Lieferumfang, Datenmodell und Nachweisen entfernt. Diese historischen Vorschläge werden nicht unter anderem Namen weitergeführt.
- Aktuelle Herkunfts-/Text-/Lesbarkeitsprüfung pro Anfrage/Treffer/Status erhalten, auch bei externen konfigurierten Quellen/Gebieten. Unsichere Herkunft oder Timeout/404/Teilantwort ist keine Cache-Löschanweisung. Originalveröffentlichung wartet auf keinen Bestandsabgleich.
- Feste Katalogrevisionen, redaktionelle Standards/Overrides, vollständige Satzaktivierung und Sprachwahl bleiben unberührt. Die Cachefrist gilt nicht automatisch für Backups/Logs; besondere Löschpflichten bleiben getrennte Betriebsfälle.

Geplante Nachweise ersetzen die früheren Originalabgleich-Invarianten: kontrollierte Studio-Uhr bei Fertigstellung und Ready-Ausgaben, Sprachisolation, nicht verlängernde Zugriffe, Grenze vor/bei/nach 90 Tagen, täglicher Lauf samt Ausfall/Wiederholung, paralleler Abruf gegen Bereinigung, aktive Lease, später Worker und legitimer neuer Submit. Das sind keine ausgeführten Implementierungstests.

Offen bleiben konkrete SQL-/Sperrfolge und Batchgröße des Bereinigungsjobs, verifizierte Unterscheidung von App-Abruf und Betriebs-/Hintergrundprüfung im Servicevertrag, kurzlebige Statuskorrelation/-laufzeit, externe Quellenfrische sowie die bereits dokumentierten Katalog-, Serviceidentitäts-, DeepL-Konto- und Betriebsentscheidungen. Kein neues Produktinterview erforderlich, keine Implementierungsfreigabe.

Prüfstand dieser Überarbeitung: strict OpenSpec erfolgreich; bestehende Dokumentationsprüfung und Dateiablageprüfung erfolgreich. Die sieben untracked Planungsdateien zusätzlich geprüft: Dateiablage, 16 relative Links, Szenarien je Requirement und nachgestellte Leerzeichen erfolgreich. Getrackte Dateien und Index unverändert. Keine Implementierungs-, Unit-/Type-/E2E- oder Live-Systemtests und kein neuer unabhängiger Subagent-Review durchgeführt.

## Bestätigte Vereinfachung des Studio-Vertrags — 20. Oktober 2026

Auf Benutzerauftrag die drei vorgeschlagenen Vereinfachungen in den bestehenden Studio-Plänen übernommen. Der Main-Server-/App-Abgleich ist ausdrücklich offen; keine fremden Dateien geändert, keine API-Abnahme oder Implementierungsfreigabe behauptet. Ältere Aussagen dieses Reports zu separaten Sprachrevisionen, Indexgeneration und Quellenangaben im Studio-Request sind damit historisch ersetzt.

- Eine gemeinsame Satzrevision je Scope/Vertrag identifiziert alle Sprachsnapshots zusammen mit ihrer Locale; eigene Sprachrevisionszähler entfallen. Manifest-/Draft-/Quellbasisrevisionen und Worker-Leases behalten ihre Zwecke.
- Gemeinsame Aktivierung vergleicht die erwartete aktive Satzrevision, bei Erstaktivierung `null`. Der neue Satz muss neuer sein; exakt aktiver Satz bleibt Retry-No-op, abweichende Bytes derselben Revision Konflikt. Jede Index-/Sprachauswahländerung wird neuer Satz; direkte Indexwrites/-deletes bleiben gesperrt. Keine separate Indexgeneration.
- Quellenlocators/-digests und App-seitige Statuskorrelation bleiben ausschließlich im Main-Server. Studio verarbeitet geprüfte wertfreie Vorlagen, technische Profil-/Format-/Kontextangaben und Sprache im verifizierten Scope. Das Gateway prüft Herkunft, passenden aktuellen Text und Lesbarkeit vor jedem Studio-Abruf; keine neue persistente Quellen-/Batchtabelle.

Die bereits bestätigten 90-Tage-, Override-, Satzaktivierungs-, Build- und Sprachwahlregeln bleiben erhalten. Geplante Nachweise berücksichtigen Erstaktivierung, falschen Vorgänger, überholten Satz, Retry/ACK-Verlust und aktuelle Gatewayprüfung bei fehlenden Studio-Quellenangaben. Keine Implementierungsnachweise ausgeführt und kein erneuter unabhängiger Subagent-Review.

Prüfstand: strict OpenSpec, bestehende Dokumentationsprüfung und Dateiablageprüfung erfolgreich. Zusätzlich sieben unversionierte Planungsdateien auf Ablage, 16 relative Links, Requirement-Szenarien und Whitespace geprüft. Getrackte Dateien und Git-Index bleiben unverändert; keine Implementierungs-/Laufzeittests, alles bleibt uncommittet.

## Abgrenzung des ersten Studio-Abschnitts A — 20. Oktober 2026

Auf Benutzerauftrag ausschließlich Planung konkretisiert: Proposal, Design 8.1, Tasks 2A und App-Delta-Spec beschreiben die interne serverseitige Katalogbasis, ohne Implementierung freizugeben. Keine zusätzlichen Planungsartefakte oder Änderungen an fremden Projekten.

A umfasst Manifestimport/-prüfung, globale/kommunale Entwürfe, sprachbezogene Overrides samt Korrekturschutz und lokale vollständige unveränderliche Versiegelung. Das Datenmodell konkretisiert die drei bereits geplanten Katalogbestände: Manifest, eine Draftzeile je Scope/Vertrag und eine Satzzeile je Scope/Vertrag/Satzrevision mit allen Sprachsnapshots. Die Ein-Zeilen-Granularität reduziert die lokale Satzbildung auf eine Transaktion; eigene Sprachzähler, Satz-/Konfigurationstabellen und ein weiterer Workflow entfallen. Historische Tabellenbeschreibungen mit einer Release-Zeile je Sprache sind dadurch präzisiert.

Lokales `sealed` ist weder veröffentlichter Standard noch remote aktiver kommunaler Satz. A-intern darf eine versiegelte globale Basis für die lokale Zusammenstellung gepinnt werden; spätere automatische Standardübernahme bleibt auf tatsächlich veröffentlichte Standards begrenzt. Keine neue UI/Route/CLI, DeepL-, Queue-, YAML-, Serviceauth-, Main-Server- oder App-Integration in A. Fehlende Sprachwerte verhindern Versiegelung; keine Fake-Übersetzung oder vorgezogene App-Release-Ausnahme.

Geplante direkte Nachweise: deterministische kanonische Artefakte, Importwiederholung/-rollback und Redaktionsschutz, sprachbezogener Reset, geschützte manuelle Korrektur bei Quelländerung, Organisations-/Instanzisolation und RLS mit Anwendungsrolle, konkurrierende Draftupdates/Versiegelungen, unveränderlicher Satz S1 trotz neuerem Draft S2 sowie fokussierte Type-/Unit-/PostgreSQL- und erforderliche Server-Runtime-/Migrationsgates. Nur relevante Teilinvarianten bilden A-Abschluss; Remote-CAS, echte Builds und Providerabnahme folgen später.

Der Main-Server-/App-Abgleich bleibt offen, blockiert aber A nicht. Vor Umsetzung sind interne Manifestdetails, zuständige vorhandene Session-/Repositorypfade und aktueller Migrationshead zu prüfen. Kanonische Schemaunterlagen und arc42 werden erst mit der gesondert freizugebenden Implementierung angepasst. Kein Code, keine Migration oder Implementierungstests ausgeführt; alles bleibt uncommittet.

Prüfstand: strict OpenSpec, Dokumentations- und Dateiablageprüfung erfolgreich; zusätzlich 7 unversionierte Planungsdateien, 18 relative Links, Requirement-Szenarien und Whitespace geprüft. Getrackte Dateien und Git-Index unverändert.

## Umsetzung des freigegebenen Abschnitts A — 20. Oktober 2026

Der Benutzer gab ausschließlich A zur Implementierung samt Tests frei, alles uncommittet. Umgesetzt: frameworkunabhängiger Manifest-/Platzhalter-/Wertvertrag und kanonische Artefakte in Core, transaktionsgebundene Repositoryoperationen sowie interne Sessionfassade ohne Route/UI. Drei neue Tabellen in Migration 0106, keine neuen Packages, Dependencies, Provider-/Jobpfade oder Services. Die neue Vitest-Integrationkonfiguration dient dem ungecachten `data-repositories:test:integration`; Unit-/Coverage-Läufe schließen DB-Dateien aus. Das bestehende allgemeine Integration-Gate nimmt diesen expliziten DB-Target nicht automatisch auf; sein separater Lauf ist erforderlich.

Explizite Präzisierung bei Umsetzung: `app-translations.*` ersetzt den vorgeschlagenen camelCase-Actionnamespace, damit bestehende IAM-Identifierregeln unverändert gelten. Root-Actions verwenden die vorhandene verifizierte Plattform-/Root-Administratorpolicy; Tenant-Actions werden mit realem Permission-Evaluator und der gespeicherten aktiven Organisation geprüft. Keine automatischen Tenantgrants. Katalogtabellen erzwingen RLS für Organisation/Instanz; aus bestehenden Default-Grants geerbte UPDATE-/DELETE-/TRUNCATE-Rechte auf unveränderliche Revisionen werden ausdrücklich entzogen.

Ausgeführte Evidenz:

- `core:test:unit --testFiles=src/app-translations.test.ts`: 5 Tests erfolgreich, einschließlich Unicode/Kanonisierung, Platzhalter/Werttypen, 20 Katalogsprachen und unabhängiger Sprachvererbung.
- `auth-runtime:test:unit --testFiles=src/app-translations.test.ts`: 6 Tests erfolgreich, einschließlich echter Actionentscheidung, Session-/Org-Bindung, verweigerter Imports, CSRF, Mutation per GET und Permissionausfall. Session-/DB-Ports sind in diesen Unit-Tests kontrolliert; es ist kein Live-Keycloak-/Redis-Nachweis.
- `APP_TRANSLATIONS_TEST_DATABASE_URL=… data-repositories:test:integration`: 9 Tests erfolgreich, ungecacht auf separatem PostgreSQL 16. Importwiederholung/-rollback, unverändertes S1 trotz neuerem Draft, gezielter Reset, Quellwechsel/Korrekturentscheidung, konkurrierende Schreiber/Versiegelungen, reale `iam_app`-RLS, verweigerte Cross-Org-Inserts und FK-Mismatch sowie geänderte globale Basis geprüft.
- Vollständige Goose-Migration 0→106→0→106 in einem eigenen temporären PostgreSQL-16-Container erfolgreich. Zuvor verworfene Versuche: PostgreSQL 14 scheiterte an bestehender PG15+-Syntax; eine separate DB im vorhandenen PG16-Cluster scheiterte am bereits vorhandenen rollenweiten Guard von Migration 0091. Keine bestehenden Rollen gelöscht; diese Versuche sind kein Migrationsnachweis. Die neu angelegte Testdatenbank im vorhandenen Cluster wurde entfernt; der eigene PostgreSQL-16-Testcontainer wurde gestoppt/automatisch entfernt und der temporäre PostgreSQL-14-Prozess gestoppt.
- Gezielte Typechecks für Core, Data-Repositories und Auth-Runtime erfolgreich. `check:server-runtime` für alle 20 konfigurierten Serverprojekte erfolgreich. Frühe Sandboxfehler durch Nx-/tsx-Sockets wurden mit gezielt genehmigten Testaufrufen außerhalb dieser Beschränkung behoben; keine Workspace-Schutzregeln geändert.
- ESLint auf den sechs neuen Code-/Testdateien: keine Fehler, Warnungen zu bewusst abgesicherten Non-null-Assertions. Schemaübersicht/-snapshot, arc42 05/08 und betroffene Package-READMEs aktualisiert.

Keine DeepL-/Main-Server-/App-Integration, keine produktive Veröffentlichung, kein Live-DB-Rollout, kein Commit/Push/PR/Deployment. Folgeabschnitte und technischer Main-Server-/App-Abgleich bleiben offen. Dieser Eigencheck ersetzt keinen unabhängigen Implementierungsreview.

Abschluss A: alle 20 gezielten Tests erfolgreich (5 Core, 6 Session, 9 PostgreSQL); die letzten Action-Namensanpassungen zusätzlich durch erneuten Auth-Test, alle drei Typechecks und Auth-Runtime-Check abgesichert. Strict OpenSpec, Dokumentationsprüfung, Dateiablage inklusive 15 untracked Dateien sowie `git diff --check` erfolgreich. Keine gestagten Änderungen. Main-Server-/App-Dateien wurden nicht bearbeitet; ihre Integration bleibt offen. Kein Vollsuite-/Live-Provider-/App-E2E-Nachweis in diesem internen Abschnitt.

## Ergänzung vom 20. Oktober 2026: Plugin- und Secretanschluss

Auf Benutzerauftrag ausschließlich bestehende Quellen geprüft und die vorhandenen Planungsdateien ergänzt. Aktueller Studio-Basisstand nach Rebase: `2b20ee755`; Implementierung A bleibt unverändert und uncommittet. Kein zusätzlicher Subagentreview, keine Pluginaktivierung, Secretabfrage oder Anbieterprobe ausgeführt.

Ergebnis und geprüfte Pfade stehen in Design 1.2: optionales Plugin `app-translations` mit instanzweitem Host-Lifecycle und zusätzlicher Organisationsisolation, vorhandener Modul-IAM-/Access-Entscheid auch für Service/Worker, reguläre Suspendierung vor vollständiger Modulabwahl, bestätigter Deutsch-only-Satz und datenbewahrende Reaktivierung. Vorhandene Host-Jobs erhalten Pluginzugangsschutz nicht automatisch. Zentraler DeepL-Key nutzt zunächst Runtime-Secrets; vorhandene verschlüsselte Schnittstellen sind instanzgebunden und erst bei einem späteren eigenen Mandantenzugang zu erweitern. Keine zweite Secretverwaltung oder vorsorgliche Provider-Registry.

Tasks 2B und Delta-Specs halten geplante Nachweise und Grenzen fest. Die konkrete Remoteordnung/Fencing gegen verspätete Publikationsjobs sowie die App-Übernahme sind mit Main-Server/App noch offen abzugleichen. Abschnitt A hat weiterhin keine Pluginregistrierung oder Pluginzugangsprüfung; die Ergänzung ist keine weitere Implementierungsfreigabe.

Planprüfungen dieser Ergänzung: strikte OpenSpec-Validierung für `add-central-app-translations`, Dokumentations-/Linkprüfung, Dateiablageprüfung und `git diff --check` erfolgreich. Keine erneuten Unit-/Datenbanktests, da ausschließlich Planungsdateien geändert wurden; die neuen Lifecycle-/Secret-/Empfängerfälle sind geplante Nachweise, keine bereits erfüllten Implementierungsgates.

## Ergänzung vom 20. Oktober 2026: neue Main-Server-Interviewentscheidungen und Formularanzeige

Delegierte Übergabe aus dem Main-Server-Chat übernommen und vorhandene Studio-Formularpfade lesend gegengeprüft; keine neue unabhängige Fachreview-/API-Abnahme. Die früher im Bericht enthaltene Empfehlung „Quellenangaben/Originalbezug ausschließlich im Gateway, nicht in Studio“ ist insoweit überholt und nicht mehr als bestätigte Informationsgrenze zu verwenden. Bestätigt ist die Status-/Sprachfassungsanzeige dynamischer Übersetzungen im jeweiligen Studio-Inhaltsformular. Genaue Übermittlung/Speicherung des Originalbezugs bleibt offen, ohne dauerhaften Referenzbestand, Journal oder Verwendungsabgleich. Manuelle dynamische Korrekturen bleiben später.

Design 6.1 und Tasks 5F halten den lesenden Formularbefund und den kleinsten Anschluss fest. News, POI und Events haben eigene Reiter-/Lademuster; der generische Editor deckt sie nicht allein ab. `warmTab` kann bereits bei Hover/Fokus mounten. Vorhandene Editor-Feldmatrizen sind keine Übersetzungsallowlist; A-Fassade/Repository liefern nur feste Kataloge. Gemeinsamer lesender Reiter, konkrete Statusbeschriftungen, Laden erst beim Öffnen, Hinweise auf gespeicherten Stand und rein lesender Cachezugriff ohne Jobanlage sind ausdrücklich **Empfehlungen**, keine bereits bestätigten UI-Details. Ein Anforderungsbutton bleibt unentschieden. Formular-/Vorschauabrufe verlängern die 90-Tage-Frist nicht.

Weitere bestätigte Entscheidungen nachgezogen: eine gemeinsame Satzrevision und CAS gegen erwartete aktive Satzrevision (kein eigener Generations-/Sprachzähler), App-REST für dynamische Batches/Status und GraphQL für feste Kataloge, authentifiziert verschlüsselte zehnminütige Abholnummer ohne Pollverlängerung/persistente Batchtabelle, Bus-Frische höchstens 300 Sekunden im vorhandenen Cache bei erhaltenen kürzeren Vorgaben/Cacheverboten und ohne STALE-/HIT-Verlängerung. Der Main-Server-Plan wurde nur gelesen; er enthält die Formularentscheidung laut Übergabe noch nicht. Konkrete API-/Token-/Busumsetzung und Pluginabschaltung bleiben offene abgestimmte Lieferarbeit. Kein neuer Code, keine Migration oder externe Mutation; alles bleibt uncommittet.

Planprüfungen nach diesem Abgleich: `openspec validate add-central-app-translations --strict`, Dokumentations-/Linkprüfung, Dateiablageprüfung und `git diff --check` erfolgreich. Keine erneuten Unit-/DB-/Browser- oder Live-Anbietertests, da nur bestehende Planungsdateien geändert wurden.

## Anschlussreview und Plankorrekturen — 20. Oktober 2026

Drei spezialisierte Subagents prüften Plugin-Lifecycle/Architektur/Security, Formularanbindung/Usability sowie Dokument-/Schnittstellenkonsistenz. Ergebnis: drei P2-Punkte und ein nicht blockierender Konsistenzhinweis; keine grundlegende Neuplanung erforderlich. Auf anschließenden Benutzerauftrag ausschließlich bestehende Pläne korrigiert:

| Befund | Korrektur | Status / geplanter Nachweis |
| --- | --- | --- |
| P2: 2B verlangt Remoteabschaltung, deren Publisher wiederum von 2B abhängt | 2B auf lokale Registrierung, Guards, Secretstatus und Hostübergänge begrenzt; Remote-Lifecycle in 3.8/3.9, Appnachweise in 6 | Im Plan korrigiert; Produktfreigabe bleibt bis integriertem Abschluss gesperrt, kein vorgezogener Publisher oder neue Kontrollschicht |
| P2: Hostabwahl erzeugt nach Suspendierung erneut Pending; Wiederzuordnung setzt vor `reactivate` bereits `active` | Konkrete Anpassung vorhandener Hostübergänge in Design 1.2, B.4/B.5 und Delta-Spec festgehalten | Code unverändert; zwei geplante Hostintegrationstests für Abwahl ohne neuen Suspendauftrag und Wiederzuordnung mit `suspended` bis bestätigtem Abschluss; integrierte Wiederholung in 3.9 |
| P2: Deutsch-only nur je Organisation lässt ältere aktive App-Verträge offen | Abschaltung/Read-back über sämtliche weiterhin ausgelieferten aktiven Vertragsindizes, Reaktivierung je weiterhin unterstütztem Vertrag präzisiert | Nachweis mit zwei parallelen App-Verträgen geplant; bestehender Release-/Indexbestand, kein neues Vertragsregister |
| Hinweis: F.3 setzt „ohne neue Jobs“ schon verbindlich, Design/Spec führen reinen Cache-Leseweg als Empfehlung | F.3 bindet Jobfreiheit ausdrücklich an die noch ausstehende Bestätigung des empfohlenen Cache-Lesewegs | Kein Anforderungsbutton, keine automatische Übersetzung und kein neuer UI-Detailbeschluss durch diese Bereinigung |

Die Reviewbefunde stammen aus lesender Prüfung, nicht aus reproduzierten Laufzeitfehlern. Die beschriebenen Hostkorrekturen, integrierten Remote-/Appabläufe und Tests sind geplante Arbeit; keine Implementierungsfreigabe weiterer Abschnitte. Main-Server-Abgleich zu Empfängerordnung/Fencing bleibt offen. Keine Änderungen an Code, Schema oder fremden Repositories; alles bleibt uncommittet.

Planprüfungen nach den Korrekturen: strikte OpenSpec-Validierung für `add-central-app-translations`, Dokumentations-/Linkprüfung, Dateiablageprüfung und `git diff --check` erfolgreich. Die betroffenen untracked Planungsdateien zusätzlich auf Zeilenend-Whitespace geprüft. Keine Unit-/DB-/UI-Tests ausgeführt, da nur Planungsunterlagen geändert wurden; die neuen Host-/Mehrvertragsnachweise bleiben ausdrücklich geplant.

## Umsetzung des freigegebenen lokalen Abschnitts 2B — 20. Oktober 2026

Der Benutzer gab ausdrücklich lokalen Pluginanschluss, Hostkorrekturen und vorgesehene Tests frei. Das optionale Package `@sva/plugin-app-translations` wurde nach Nx-Generatordiscovery/Dry-run erzeugt und auf die bestehenden ESM-/Pluginmuster zugeschnitten; generierte Dummylib und unbenötigte Root-Nx-Änderungen wurden entfernt. Katalog und direkte Studio-Dependency sind registriert; keine Instanz wurde live aktiviert. Das Package enthält Descriptor, Browser-Metadaten, Jobentry, notwendige öffentliche Modulmetadaten und einen fokussierten Test. Ausschließlich `@sva/plugin-sdk` als Workspaceabhängigkeit; keine neue Runtime, Anbieterregistry, UI-Route oder API. pnpm hat beim Workspace-Linking bestehende injizierte Workspace-Metadaten im Lockfile normalisiert; es wurde keine neue externe Featuredependency hinzugefügt.

`executeAppTranslationOperation` prüft kommunalen Pluginzugang zusätzlich zu Action und gespeicherter Organisation. Globale Standards/Manifestimport bleiben über den vorhandenen Plattformguard möglich. Das bestehende Modul-IAM vergibt nach ausdrücklicher Zuordnung die drei kommunalen Katalogrechte an `system_admin`; die Fassade selbst vergibt keine Grants. Die Host-Composition injiziert ausschließlich `readAppTranslationsLocalReadiness`; der Pluginjob bekommt Schema- und Konfigurationsmarker, niemals den zentralen Key. `APP_TRANSLATIONS_DEEPL_API_KEY` beziehungsweise `/run/secrets/sva_studio_app_translations_deepl_api_key` verwenden denselben bestehenden Runtime-Secretleser mit Rotation beim nächsten Aufruf. Kein echter Key wurde gesucht oder Anbieteraufruf ausgeführt.

Lokale `provision`-/`reconcile`-/`readiness`-Operationen prüfen aktiven Instanzscope und Katalogschema; fehlender Key degradiert lediglich lokale Bereitschaft. `suspend`/`reactivate` melden ausdrücklich `app-translations.remote-lifecycle-unavailable`, bis der spätere Publikationsabschnitt echte Remoteabschlüsse liefern kann. Die Registrierung ist keine Produktfreigabe. Globale Pflege und spätere zentrale Wartung werden nicht an beliebige Tenantaktivierung gebunden.

Hostkorrekturen: Beide SQL-Wege erhalten bei Wiederzuordnung `access_state = suspended` bis bestätigter Reaktivierung. Eine bestätigte, erfolgreiche Suspendierung wird bei anschließender Modulabwahl als No-op erhalten; Generation und Readiness werden nicht künstlich auf Pending gesetzt. Die bestehende Konfliktbehandlung bei aktiven/unvollständigen Aufträgen bleibt erhalten. Keine neue Migration oder Schemaänderung in B.

Direkte Nachweise:

- Auth-Fassade: 13 Tests erfolgreich, darunter Pluginzugang bei vorhandenen IAM-Grants, Registryausfall, gespeicherte Organisation und redigierter lokaler Status. Auth-/DB-Ports sind kontrolliert, kein Live-Keycloak-/Redisnachweis.
- Runtime-Secrets: 7 Tests erfolgreich, darunter Umgebungskey/Rotation, expliziter Secretdateipfad und fehlende/unlesbare/leere Datei; Dateizugriff in diesen Tests gemockt.
- Pluginvertrag/Job: 6 Tests erfolgreich, tatsächliche Build-time-Registry, optionale Aktivierung, lokaler Status und verweigerte Remoteabschlüsse.
- Host-Repository: 21 Unit-Tests erfolgreich. Zusätzlich 3 echte PostgreSQL-Fälle unter `iam_app`: bestätigte Suspendierung → Abwahl ohne neues Pending sowie Wiederzuordnung über direkten Assignment- und Reconcileweg → bestätigte Reaktivierung. Kontrollierte Lifecycle-Abschlussresultate ersetzen dabei ausdrücklich keinen Remoteempfänger. Reguläre Migrationen bis 0106 und bestehendes Graphile-Migrationsskript nur auf eigenem disponiblen PostgreSQL-16-Container ausgeführt; echte Enqueuefunktion verwendet.
- Studio-Serverkomposition: Katalogtest sowie 21 Runtime-Registrierungstests erfolgreich, einschließlich tatsächlicher Hostfactory-Injektion des lokalen Übersetzungsjobs. Keine Browserseiten auf dem Server geladen.
- Typechecks für `auth-runtime`, `data-repositories` und `plugin-app-translations` erfolgreich. Server-Runtime-Gate für alle 20 vorgesehenen Serverprojekte erfolgreich. Früher Sandboxabbruch durch tsx-IPC wurde mit genehmigtem Gateaufruf behoben.
- ESLint: keine neuen Fehler in den neuen/geänderten fachlichen Dateien; Non-null-Warnungen in Tests. Der bestehende Studio-Hostpfad `plugin-operation-runtime.server.ts` meldet drei `@nx/enforce-module-boundaries`-Fehler zu bereits vorhandenen statischen Imports. Per ESLint über den unveränderten HEAD-Inhalt identisch reproduziert; kein neuer Import auf diese Packages eingeführt.
- Plugin-UI-Boundary grün. Architekturguard meldet ausschließlich Review-Required-Dateinamen `server.ts` für das neue Plugin sowie vorhandene SSF-/Waste-Entries, keine neuen verbotenen Import-/Dependencykanten. Das neue Entry wurde gegen den bestehenden Hostloader-/Jobvertrag geprüft: nur SDK und lokale Descriptorimports, redigierte Hostinjektion; kein Hostbypass oder neue Allowlist-Ausnahme.

Begrenzung des Studio-Gates: Der normale App-Unitaufruf wurde bereits in abhängigen Builds unveränderter FAQ-, Cockpit-Cards-, Generic-Items- und Projects-Plugins durch Zod-/Resolver-Typkonflikte gestoppt. Die beiden betroffenen Serverdateien wurden daraufhin im vorhandenen `test:unit:server` mit dokumentiertem `--excludeTaskDependencies` geprüft; die breite App-Buildkette gilt damit nicht als grün. Keine Reparaturen fremder Formulare, kein Vollsuite-/App-E2E-/Live-Provider-/Remote-Lifecycle-Nachweis. Remote-/Appabschnitte bleiben offen und ungeändert außerhalb der Freigabe. Alle Änderungen bleiben uncommittet.

Abschlussprüfung: Der gemeinsame PostgreSQL-Lauf bestand alle 12 Fälle (9 Katalogbasis, 3 Host-Lifecycle). Die drei direkten Package-Typechecks wurden abschließend erneut erfolgreich ausgeführt. OpenSpec-Strictvalidierung, Dokumentationsprüfung, Dateiplatzierung und `git diff --check` sind grün. Der ausschließlich hierfür gestartete Container `sva-catalog-b-test` wurde anschließend gestoppt und automatisch entfernt; bestehende Studio-Datenbanken blieben unverändert. Keine Dateien wurden gestaged oder committet.

### Lokale Nachkorrektur: Katalogrechte und Anzeigename

Auf Benutzerwunsch verwenden Registrierung, Modul-IAM und Sessionprüfung die drei hierarchischen Actions `app-translations.catalog.read`, `app-translations.catalog.write` und `app-translations.catalog.publish`. Keine zusätzliche Berechtigungsschicht oder Legacy-Aliase. Die Auth-Tests prüfen für jede Operation das neue exakte Recht und verweigern die alte CamelCase-Action. Nachweise: 6 Plugin-, 16 Auth- und 19 Studio-Katalog-/Buildinputtests sowie beide Package-Typechecks erfolgreich. ESLint meldet keine Fehler, nur bestehende Non-null-Warnungen in Plugintests. Die 20 Server-Runtimechecks bestanden; ein temporärer Dist-Synchronisationskonflikt mit dem parallel laufenden Typebuild erforderte einen erfolgreichen isolierten Wiederholungslauf für `instance-registry`.

Der Anzeigename „Mehrsprachigkeit“ und die Beschreibung kommen weiterhin aus dem vorhandenen `publiccode.yml`. Der laufende lokale Entwicklungsserver hatte noch den beim Start eingelesenen älteren Metadatenstand ohne dieses Modul ausgeliefert; der Buildinputtest sichert die Modulmetadaten jetzt ausdrücklich ab. Kein eigener UI-Sonderpfad oder neuer Metadatenloader. Der technische Modulschlüssel bleibt `app-translations`.

## Abgrenzung 2C und beauftragter Sicherungscommit — 21. Oktober 2026

Der Benutzer beauftragte die konkrete Planung des lokalen Katalogeditors einschließlich Testkatalog und Nachweisen sowie anschließend einen lokalen Commit des bisherigen Stands. Damit ist die frühere Vorgabe „alles uncommittet“ für diesen Sicherungscommit aufgehoben; kein Push, PR, Deployment oder weiterer Implementierungsauftrag.

Design 8.2, Tasks 2C und die bestehende App-Translations-Delta-Spec beschreiben den vorgezogenen lokalen Editoranteil aus 3.5. Globale Root-Standardpflege und kommunaler Pluginzugriff verwenden dieselbe Basis mit getrennten Guards. Geplant sind JSON-Manifestimport, Übersicht, gespeicherte Entwürfe, sprachbezogene Overrides/Reset, Korrekturbestätigung und vollständige lokale Prüfstände. Eine einzige synthetische Deutsch-/Englisch-Fixtur deckt String, typisierte Platzhalter, Stringliste, erlaubten Leerwert und Unicode ab; kein automatischer Seed realer Mandanten oder zweite App-Quelle. Vorgesehene Nachweise umfassen echte UI-/Session-/PostgreSQL-Persistenz, getrennte Rechte/Scopes, Revisionskonflikte, Korrekturschutz und unveränderliche Prüfstände. DeepL, YAML, automatische Standardübernahme, Remote-/Appintegration bleiben Folgearbeit. 2C ist nicht implementiert und nicht zur Implementierung freigegeben.

Planprüfungen nach der 2C-Abgrenzung: OpenSpec-Strictvalidierung, Dokumentationslinks/-indizes, Dateiplatzierung und Whitespaceprüfung einschließlich neuer Dateien erfolgreich. Keine Codeänderung in dieser Planrunde; die zuletzt dokumentierten A-/B-Codegates wurden nicht ohne neuen Anlass wiederholt. Bekannte fremde App-Build-/Host-Lintblocker bleiben dokumentiert.

## Umsetzung des freigegebenen lokalen Abschnitts 2C — 21. Oktober 2026

Nach Sicherungscommit `8bfd54e5d` gab der Benutzer die Umsetzung des konkret abgegrenzten Abschnitts 2C frei. Die Folgeänderungen bleiben uncommittet. Ein gemeinsamer Editor im bestehenden Plugin bedient die kommunale Route `/plugins/app-translations` und den hostgeführten Root-Pfad `/admin/app-translations`. JSON-Manifestimport, Entwurfsbearbeitung, sprachbezogene Overrides/Reset, Korrekturbestätigung, expliziter Basiswechsel und lokale Prüfstandvorschau verwenden die vorhandenen Operationen. Der technische Modulschlüssel bleibt `app-translations`, die Navigation heißt „Mehrsprachigkeit“. Kein DeepL, YAML, Publisher oder Remote-/Appanschluss.

Die minimale Erweiterung umfasst Metadatenübersichten im zuständigen Repository und einen authentifizierten GET-/POST-Transport über dieselbe Sessionfassade. POST prüft CSRF, vor JSON-Parsing höchstens 1 MiB und die Bindung an den zuvor geladenen Sessionbereich. Ein veränderter Sessionbereich oder eine veraltete Revision führt zu Konflikt, ohne Eingaben zu verlieren. Der zusätzliche SDK-Subpath exportiert bestehende Core-Typen/-Validatoren für diesen konkreten Browserverbraucher; keine direkte Plugin-Core-Kante, neue Tabelle, Runtime, Providerabstraktion oder Boundary-Ausnahme. Der vorhandene i18n-Check wurde um Pluginquelle/-ressourcen ergänzt. Eine einzelne synthetische Sechs-Schlüssel-Fixture dient dem bewussten Import; kein Start-/Migrationsseed.

Durchgeführte Nachweise:

- 12 Plugin-/Editor-Unitfälle erfolgreich: Registrierung/Guards, Übersicht und falscher Scope, Platzhalterprüfung, Erhalt nach fehlgeschlagener Mutation, Read-only, explizit erlaubter Leerwert sowie tatsächliche deutsche Quelle geerbter fremdsprachiger Standards. Die Seiten-Unitfälle isolieren den Transport mit einem Modulmock; sie werden ausdrücklich durch den echten Browser-/HTTP-/DB-Ablauf ergänzt.
- 17 Authfälle erfolgreich: getrennte Actions, Session-/Org-/Root-/Pluginbindung, verweigerte Mutations-GETs, CSRF, unerlaubte Payload-Scopefelder, geänderter Header-/Sessionscope, begrenzter Stream und ungültiges JSON. Auth-/Repositoryports sind in diesen Unitfällen kontrolliert.
- 10 echte PostgreSQL-Fälle unter `iam_app` erfolgreich: scoped Übersichten ohne fremde Drafts/Releases, zwei Organisationen und zweite Instanz, globale unveränderliche Basiswahl, RLS, Importrollback/Idempotenz, konkurrierende Revisionen/Seals, Korrekturschutz und unveränderlicher S1. Reguläre Migrationen 0→106 nur auf dem eigens disponiblen PostgreSQL-16-Container; kein neues Schema in 2C.
- Routing 95, gezielte Studio-Serverfälle 40, Sidebar 46 und Routebindings 31 erfolgreich. Für gezielte App-Tests wurden bekannte fremde Dependency-Buildblocker mit dem vorhandenen `--excludeTaskDependencies` umgangen; keine neue Gateausnahme oder Produktkonfiguration.
- Sechs betroffene Package-Typechecks (`core`, `data-repositories`, `auth-runtime`, `routing`, `plugin-sdk`, `plugin-app-translations`) sowie Skript-Typecheck erfolgreich. Alle 20 Server-Runtimechecks erfolgreich; Type-/Runtimebuilds bewusst nacheinander, um Dist-Synchronisationskonflikte zu vermeiden.
- i18n-Keycheck erfolgreich. Plugin-UI-Boundary ohne Befund. Architekturguard zeigt ausschließlich die bereits bewerteten `server.ts`-Reviewmarker für Mehrsprachigkeit/SSF/Waste, keine verbotene Import-/Dependencykante. Fokussiertes ESLint ohne Fehler; bestehende Non-null-Warnungen im Lifecycle-Test.

Echter Browsernachweis auf einem eigenen Port mit separaten PostgreSQL-/Redis-Testdiensten: synthetische, über den vorhandenen Sessionstore gespeicherte Root-/Tenant-Sitzungen, tatsächliche IAM-Grants, regulärer Modulzugang und tatsächlich abgearbeiteter Graphile-Readinessjob. Kein Mockauth-/Plugin-Guard-Bypass und kein Zugriff auf einen echten IdP oder DeepL. Der fehlende DeepL-Key ergab erwartungsgemäß eingeschränkte lokale Bereitschaft. Die Testinstanz erhielt nur synthetische Registry-/Org-/Accountdaten; vorhandene Studio-Datenbanken und Port 3000 blieben unverändert.

Root importierte die gemeinsame Fixture und versiegelte erst nach vollständiger englischer Redaktion. Die kommunale Ansicht legte ausdrücklich einen Entwurf aus dem globalen S1 an. Speichern/Reload, Deutsch-Override mit weiter geerbtem Englisch, Reset, paralleler Savekonflikt mit erhaltener Eingabe und unverändertem altem Prüfstand wurden real geprüft. Änderung der deutschen Quelle erhielt die manuelle englische Fassung, blockierte die Versiegelung und erlaubte sie erst nach ausdrücklicher Korrekturbestätigung. Ein anschließender Seal-Retry lieferte bytegleich denselben JSON-Prüfstand. Erwartete 400-/409-Testantworten sind keine unbemerkten Browserfehler.

Axe im tatsächlichen Editor-/Prüfstandbereich prüfte WCAG 2 A/AA und 2.1 A/AA. Der zuerst gefundene nicht fokussierbare Scrollbereich wurde mit zugänglichem Namen und `tabIndex=0` korrigiert; frisch geladener Editor danach ohne Befund. Labels, Tab vom Textfeld zum Speichern und der echte Hostsprachwechsel auf Englisch (übersetzte Überschrift/Feldlabels, keine rohen UI-Keys) wurden geprüft; kein Anspruch auf vollständiges manuelles WCAG-Audit. Die Browser-Fixture verwendet den Tenantpfad nach SPA-Navigation von der Startseite; direkter SSR-Aufruf des ausschließlich lokalen Testsubdomains wurde durch dessen Node-DNS-/Sessionauflösung umgeleitet und ist kein nachgewiesener Produktionsfehler. Echte IdP-Anmeldung und produktive Hostauflösung waren nicht Teil dieses isolierten Nachweises.

Bekannte Grenze bleibt die unveränderte volle Studio-Buildkette: FAQ, Cockpit Cards, Generic Items und Projects melden bestehende Zod-/Resolver-Typkonflikte. Statische Lazy-/Routingimporte in `app-route-bindings.core.tsx` erzeugen bestehende Host-Lintfehler. Kein breiter grüner App-Build, kein Produktpilot, kein Remote-Lifecycle-/Main-Server-/Appnachweis. Der gemeinsame Vertragsabgleich bleibt offen. Die zusätzliche Oberfläche entspricht ausschließlich dem gelieferten lokalen Editor; keine vorsorglichen Verwaltungs- oder Kontrollschichten.

Abschluss: OpenSpec-Strictvalidierung, Dokumentations-/Dateiplatzierungsprüfung, generierter Seitenkatalog und `git diff --check` erfolgreich. Der eigene Testserver auf Port 3001, die Browser-Testsession und beide disponiblen PostgreSQL-/Redis-Container wurden beendet; keine Testdienste oder synthetischen Datensätze in bestehenden Umgebungen hinterlassen. Kein Commit, Push oder Deployment der 2C-Änderungen.

### Nachkorrektur 2C: große Textbestände auffindbar machen

Auf den Nutzerhinweis zur ungeeigneten Dropdownauswahl wurde ausschließlich die vorhandene Editoransicht angepasst: Suchfeld, Trefferliste mit Textvorschau und bestehende Studio-Seitennavigation, maximal 25 gerenderte Schlüssel je Seite. Suche umfasst Schlüssel, deutschen Text und wirksamen Text der gewählten Sprache, ohne Beachtung der Groß-/Kleinschreibung. Gewählte Texte bleiben beim Filtern sichtbar; Suche, Seiten- und Schlüsselwechsel sind bei ungespeicherter Eingabe gesperrt. Keine neue API, Bibliothek oder persistente Fixture; Suche im bereits geladenen Katalog.

Nachweis: 14 Plugin-/Editor-Tests grün, darunter ein synthetischer 10.000-Schlüssel-Bestand mit begrenztem DOM, Seitennavigation, Schlüssel-/Quell-/Übersetzungssuche und Leerzustand sowie Schutz ungespeicherter Eingaben. Fokussierter Plugin-Typecheck, ESLint ohne Fehler/Warnungen in den drei betroffenen UI-Dateien, i18n-Keycheck und Plugin-UI-Boundary erfolgreich. Der 10.000-Schlüssel-Fall ist ein Komponententest, kein Browser-Performance- oder Netzlastnachweis mit echten App-Katalogen. Keine erneute DB-/Server-/Remoteprüfung für diese ausschließlich lokale UI-Korrektur. Änderungen bleiben uncommittet.

### Nachkorrektur: Root-Begriffe, explizite Instanzauswahl und lokale Vorschau

Auf ausdrücklichen Nutzerauftrag heißt die globale Root-Ansicht jetzt „Gemeinsame App-Texte“ beziehungsweise „Shared app texts“; kommunaler Pluginname und Aktivierungsregeln bleiben erhalten. Der bestehende automatische Effekt zur Auswahl der ersten Instanz wurde entfernt. Ohne bewusste Auswahl beziehungsweise nach deren Leeren wird kein Modulworkspace und keine Mutation angeboten. Der Instanzselektor besitzt eine zugeordnete Beschriftung. Kein neuer Aktivierungszustand oder API-Pfad.

Regression zuerst reproduziert: Der neue Test scheiterte am bisherigen automatischen `loadInstance('demo')`. Nach der Korrektur bestanden alle 14 gezielten Modulverwaltungsfälle einschließlich Leerwahl, bewusster Auswahl und ausgeblendeten Aktionen trotz altem Detail im Hook. Vorhandene Mutationstests wählen ihren Testmandanten jetzt ausdrücklich. i18n-Gate grün; ESLint ohne Fehler, bestehende Non-null-Warnungen im Test. Keine vollständige App-Buildwiederholung angesichts der dokumentierten fremden Blocker.

Der Benutzer hat außerdem die Vorbereitung seiner bestehenden lokalen Vorschau freigegeben. `pnpm env:migrate:local-keycloak` führte ausschließlich die noch ausstehende Migration `0106_app_translation_catalog_basis.sql` aus, erreichte Version 106 und schloss regulären App-User-Bootstrap sowie Schema-Guard erfolgreich ab. Anschließender echter Repository-Read unter `SET LOCAL ROLE iam_app` lieferte eine leere globale Übersicht ohne Fehler; Prüfttransaktion zurückgerollt. Kein Demoimport, keine Modulzuordnung, kein neuer Tenant und kein Reset vorhandener Daten. Der lokale Katalog ist damit vorbereitet, zunächst leer. Die früheren Aussagen zur unveränderten Bestandsdatenbank beschreiben die vorausgehenden isolierten Tests; diese spätere lokale Migration erfolgte erst auf diesen konkreten Auftrag. Alle Code-/Dokumentationsänderungen bleiben uncommittet.

### Root-Navigationsgruppe Mobile-App

Auf Nutzerauftrag verwendet der bestehende Sidebar-Gruppenpfad jetzt „Mobile-App“ mit dem ersten Unterpunkt „Gemeinsame App-Texte“. Keine neue Gruppenkomponente, Landingpage, Route, Berechtigung oder leere Vorratsmenüs. Die vorhandene Plattformprüfung bleibt erhalten; kommunale Sitzungen erhalten diese zentrale Gruppe nicht. Alle 48 Sidebar-Tests bestanden, einschließlich aktiver Unterroute/automatischer Gruppenöffnung, Ein-/Ausklappen und fehlender Root-Gruppe im Tenantkontext.

Kurzer lesender Blick in `main-server` und `mobile-app`: `src/hooks/versionCheck.ts` verwendet die konfigurierbaren Update-Hinweise samt `enabled`/`isRequired`. `src/SettingsProvider.js` bündelt Navigation, Sections, Widgets und weitere App-Einstellungen; `src/config/appDesignSystem/default.ts` enthält gemeinsame Darstellungsdefaults. `app/graphql/types/query_type.rb#public_json_file` liefert benannte JSON-Konfiguration mit optionaler Version über den bestehenden Static-Content-Pfad. Naheliegende spätere Kandidaten sind zentrale Updatevorgaben mit expliziten Zielapps, Konfigurationsvorlagen und Gestaltungsstandards. Das sind Ideen, keine neuen Produktentscheidungen oder Implementierungsaufträge. Der Name `globalSettings` bezeichnet für sich keine instanzübergreifende Autorität; kommunale Inhalte/Branding bleiben getrennt. Keine fremden Dateien oder laufenden Systeme verändert.

Nachprüfungen: i18n-Keycheck, OpenSpec-Strictvalidierung und `git diff --check` erfolgreich. ESLint meldet im Sidebar-Test den bereits zuvor vorhandenen statischen `plugin-news`-Import gegen dessen Lazy-Markierung sowie bestehende Testwarnungen; der neue Gruppenpfad erzeugt keinen weiteren Fehler. Kein angrenzendes Importrefactoring. Alles bleibt uncommittet.

### Verständliche App-Begriffe und Breadcrumbs

Auf Nutzerhinweis ersetzt die Importansicht das Code-Multiselect durch benannte Sprachcheckboxen mit festem Deutsch und erklärt Herkunft, Inhalt und Wirkung der App-Textdatei. Die Auswahl bestimmt Sprachfassungen des gemeinsamen Bestands, keine kommunale Sprachfreigabe; Übersetzungen werden derzeit manuell ergänzt. Der Import ist weiterhin derselbe validierte JSON-Vertrag, keine App-Anbindung oder automatische Übersetzung. Sichtbare Begriffe heißen App-Textbestände und gesicherte Textstände; letztere sind weiterhin lokale unveränderliche `sealed`-Sätze und keine Veröffentlichung. Die Root-Breadcrumbs folgen Übersicht → Mobile-App → Gemeinsame App-Texte; „Mobile-App“ erhält keine künstliche Route. Auch die kommunale Pluginroute besitzt nun einen passenden Breadcrumb.

15 Plugin-/Editorfälle sowie 18 Breadcrumbfälle erfolgreich; der neue Importtest verwendet echte de-Beschriftungen und prüft die tatsächlich angeforderte Sprachmenge bei bewusster Auswahl (Deutsch fest, Englisch abgewählt, Ukrainisch gewählt). Plugin-Typecheck, i18n-Gate und fokussiertes ESLint erfolgreich. Keine Provider-/Remote-/DB-Vertragsänderung.

Browsernachweis in der vom Nutzer gezeigten Firefox-Sitzung: Der lokale Server war beim Nachladen nicht mehr erreichbar (Port 3000 ohne Listener). Ausschließlich die App wurde über den vorhandenen `startLocalApp` mit `local-keycloak` erneut gestartet, ohne Infrastruktur-/Realm-/Modulmutation. Die bestehende Sitzung lud anschließend die echte lokale Übersicht mit vollständigem Breadcrumb, passendem Browser-Seitentitel, App-bezogener Beschreibung, ausgeschriebenen Sprachcheckboxen und App-Textdatei-Hinweisen. AX-Baum und Screenshot visuell geprüft; kein Dateiimport oder Sprachwechsel in der Nutzersitzung. Der lokale Entwicklungsserver bleibt für die Vorschau gestartet. Ein produktiver Manifestgenerator beziehungsweise automatischer Import aus dem echten App-Code ist weiterhin nicht Bestandteil von 2C.

## Umsetzung 2D am 21. Oktober: deutsche Hostbasis und Sprachen

Auf ausdrücklichen Nutzerauftrag Pläne und Implementierung getrennt: Rootimport nur Deutsch, Hostroute `/app-texts` ohne Modulpflicht mit `app-texts.catalog.read/write/publish`, bestehende Pluginroute ausschließlich für freigegebene Fremdsprachen. Anlage/Basiswechsel liegen im deutschen Hostpfad, damit Pluginrechte auch keine indirekte Änderung der deutschen Basis erlauben. Sourceprojektion filtert fremde Werte und mehrsprachige Prüfstände serverseitig; deutsche Versiegelung bleibt bei unvollständigen Übersetzungen möglich. Der gleiche Draft-/Releasebestand bleibt führend, mit Sprachmenge als zusätzlicher Retryidentität im gemeinsamen Satzrevisionszähler. Gesperrte Werte werden erhalten.

Root verwaltet unter `/admin/languages` die zentrale Verfügbarkeit bisher technisch unterstützter Codes und ausdrücklich gewählte Instanzzuordnungen. Neue Tabellen aus 0107 mit CAS, FK und RLS; Aktivierung sperrt aktuelle Sprache, Instanz, Modul und abgeschlossene Bereitschaft. Bestehender tenantgebundener Lifecycle-RLS wird im Rootvorgang bewusst transaktionslokal verwendet. Keine neue Queue, kein Provideradapter, keine Secretablage, keine Studio-Lokalisierung. Zentral gesperrte Zuordnungen bleiben gespeichert; echte Appdeaktivierung ist Folgeintegration.

Nachweise dieser Umsetzung:

- 27 gezielte Authfälle (Katalog und Sprachen): Root-/Session-/CSRFgrenzen, getrennte Hostrechte, deutsche Versiegelung ohne Modul, Modusspoofing, Basiswechselgrenze, gesperrte Sprachen und Revisionskonflikte.
- 12 echte PostgreSQL-Fälle unter `iam_app`: zusätzlich deutsche/unvollständige und mehrsprachige Retryidentitäten, zentrale Sperren ohne Datenverlust, zwei Instanzen mit RLS, CAS und Modul-/Lifecyclebedingung. Eigener disponibler PostgreSQL-16-Container, reguläre Migrationen bis 107. Rücklauf 107 → 106 → 107 erfolgreich, anschließend bestehende 7 Drafts/9 Releases unverändert vorhanden und 20 Sprachcodes wiederhergestellt. Testcontainer danach entfernt.
- 15 Plugin-/Editor-/Importtests, 3 Sprachverwaltungs-UItests, 14 bestehende Modul-UItests, 49 Sidebartests, 22 Breadcrumb-/Berechtigungsbezeichnungstests, 95 Routingtests und 9 Core-/Seedplanfälle erfolgreich. Rootimport besitzt keine Sprachauswahl; Hostnavigation funktioniert ohne Modul; Instanz wird nie automatisch gewählt.
- Core/Repository/Auth-Typechecks beziehungsweise Builds und Plugin-Typecheck erfolgreich; Server-Runtime-Gate für alle 20 Projekte erfolgreich. Zielgerichtetes ESLint ohne Fehler, vorhandene Repositorywarnungen zu Non-null assertions sowie zwei solche Testwarnungen bleiben. Allgemeiner App-Typecheck weiterhin rot außerhalb der neuen Pfade: zwei übertiefe Typinstanziierungen in der Instanzregistry und zwei bekannte Zod-/Resolverkonflikte in FAQ/Cockpit Cards; keine stillschweigende Gesamtfreigabe.
- Bestehende IAM-OpenAPI um die lokalen Katalog-/Sprachenrouten ergänzt; API-Konsistenzprüfung erfolgreich. Sprachschlüssel-, OpenSpec-Strict-, Dokumentations-/Link-, Seitendokumentationskatalog-, Dateiplatzierungs- und Whitespaceprüfungen berücksichtigt.

Die geprüfte additive Migration 0107 wurde danach über `env:migrate:local-keycloak` auf die ausdrücklich vorbereitete lokale Vorschau angewandt, inklusive regulärem App-User-Bootstrap und Berechtigungscacheinvalidierung. Kein Testkatalog importiert und keine Sprach-/Modulzuordnung verändert. Die bestehende Firefox-Rootsession zeigt „Sprachen“, korrekte Breadcrumbs, 20 zentrale Codes mit gesperrtem Deutsch-Schalter und leere explizite Instanzauswahl ohne Katalogfehler. Weitergehende Browsermutationen wurden nicht ausgeführt.

Eingegangene Main-Server-Entscheidungen ausschließlich in bestehenden Planunterlagen festgehalten: bestätigte reine dynamische Leseanzeige, Vorschlag zu Kompatibilitätsindexversionen/CAS je Zielversion und atomare gemeinsame Abschaltung vorhandener Indexversionen je Kommune/Vertrag. Wirevertrag, Fencing und Serviceanmeldung bleiben offen. Kein DeepL, Remote-/App-E2E oder Vollsuite-Nachweis. Alles bleibt ungestagt und uncommittet.

## Neue Zielrichtung 2E nach Nutzerkorrektur am 21. Oktober

Der Nutzer verwirft den eigenständigen Hauptmenüpunkt „Sprachen“ und bestätigt einen eigenen DeepL-Zugang je Instanz. Die Sidebar wurde unmittelbar angepasst, alle 49 vorhandenen Tests einschließlich aktualisierter Root-Erwartung bestehen. Die deutsche Hostbasis bleibt davon unberührt. Weitere bestehende uncommittete Arbeiten wurden erhalten.

Bestehende Pläne um den konkret zugeschnittenen Abschnitt 2E ergänzt: benutzerkonfigurierte Hostschnittstelle nach Modulaktivierung, vorhandene datensatzgebundene Secretverschlüsselung/Resolver, ausdrücklicher v3-Sprachabruf, technische/Anbieter-Sprachabdeckung, Einrichtungshinweis und serverseitige Fachfreigabe ohne Zirkelschluss. Alte Sprachverwaltung und ihre Daten werden erst im vollständigen Ersatzabschnitt abgelöst; angewandte Migration 0107 wird nicht umgeschrieben. API-/Key-/Readinessimplementierung noch nicht begonnen, keine neuen DeepL-Requests mit Benutzerkey und keine DB-/Secretänderung. Anschließend ausdrücklich bestätigt: auch gemeinsame deutsche Standards werden je Instanz über deren eigenen Key übersetzt; Aufträge und Kosten bleiben instanzgebunden, zusätzlicher zentraler Zugang entfällt. Die Pläne unterscheiden weiterhin instanzgebundene Standardsprachfassung von eigenem Sprach-Override und schützen Korrekturen. Der neue provider- und secretführende Lieferabschnitt benötigt die Planfreigabe nach dem bestehenden OpenSpec-Prozess.

Die offizielle DeepL-Dokumentation bestätigt `GET /v3/languages?resource=translate_text`, getrennte Zielverwendbarkeit/Features und feste offizielle Free-/Pro-Hosts; Standardantworten enthalten stabile Sprachen. Geprüfte Referenz steht direkt im Design. Keine Anbieterbereitschaft durch bloße öffentliche Dokumentationssichtung behauptet.

## Checkpoint-Review vor 2E am 21. Oktober

Auf Nutzerauftrag den gesamten uncommitteten Stand gegen HEAD geprüft. Drei lesende Fachreviews deckten Backend/Berechtigungen/Datenintegrität, UI/Testqualität/i18n und Dokumentations-/Nachweiskonsistenz ab. Zwei konkrete P2-Editorfehler korrigiert: Bei fehlender fremdsprachiger Fassung wird die tatsächliche wirksame deutsche Quelle gezeigt; geerbte vorhandene Fremdsprachen behalten ihre gepinnte Standardquelle. Eine aus dem Sprachsatz entfernte interne Auswahl fällt sofort auf Deutsch zurück. Der bisherige Vererbungstest wurde um einen tatsächlich geerbten englischen Wert ergänzt; beide Fehler besitzen eigene Regressionstests, alle 9 Editorfälle bestehen.

Veraltete Readme-Navigation und operative Planannahmen zu zentralem Key/einmaliger Standardübersetzung bereinigt, bestätigten rein lesenden Formularzugriff verbindlich formuliert und gelieferten Stand 2C/2D sowie Freigabe 2E aktualisiert. E7 bereitet Eigentümerschaft/Zugang vor; tatsächliche Textübersetzungsjobs bleiben Folgeabschnitt. Kein bestätigter Backendblocker; ein zwischenzeitlicher RLS-Verdacht wurde nach Prüfung der Legacy-Migration 0023 zurückgenommen. Neue Katalog-/Sprachtabellen erzwingen RLS gesondert. Die bereits dokumentierten vier allgemeinen App-Typecheckfehler liegen außerhalb der geänderten Editorpfade und werden nicht als grün ausgegeben.

Geprüfter Sicherungsstand umfasst noch keine DeepL-Schnittstellenimplementierung. Vorhandene gezielte Auth-/PostgreSQL-/Routing-/UI-/Runtimebelege bleiben gültig; ergänzt wurden fokussierte Editor-Unit-/Typprüfungen sowie Plan-/Doku-/Dateiplatzierungs-/Whitespacechecks. Keine Wiederholung breiter Suiten ohne neuen Anlass, kein Commit von Testdaten, Keys oder lokalen Artefakten. Erst nach diesem Sicherungscommit beginnt 2E; dessen Änderungen bleiben zunächst uncommittet.


## Abschnitt 2E — instanzgebundene DeepL-Einrichtung, 21. Oktober 2026

Der zuvor geprüfte Stand wurde als `48821df2b` (`feat(app-translations): add catalog editor and German host access`) gesichert. Die nachfolgende 2E-Umsetzung bleibt uncommittet. Der vorhandene Schnittstellentyp-/Formular-/Secretpfad trägt DeepL je Instanz, eigene Credentials, festen Free-/Pro-Host, ausdrückliche v3-Sprachabfrage und Auswahl technisch unterstützter Zielsprachen. Der Einrichtungshinweis bleibt bei fehlender Anbieterbereitschaft erreichbar; neue abhängige Katalogmutationen prüfen aktuelle Bereitschaft und Sprache unter Modul-/Lifecycle-/Schnittstellensperren. Deutschpflege bleibt unabhängig. Vorhandene autorisierte Texte werden bei temporärem Anbieterfehler nicht gelöscht oder gesperrt. Inhaltsübersetzungen, automatische Publikation und Remote-/Appauslieferung sind weiterhin nicht implementiert.

Die alte Root-Sprachroute/-API, ihr Repository und der zentrale DeepL-Secretgetter sind entfernt. Migration 0108 ersetzt die beiden Sprachtabellen aus 0107 durch Konfiguration im bestehenden Interfacebestand. Frühere Zuordnungen/Verfügbarkeit bleiben ausschließlich für Rollback erhalten. Es entstehen keine neue Secretablage, Provider-Registry oder Queue. Ein Unique-Index begrenzt DeepL auf einen Datensatz pro Instanz.

Drei fachliche Read-only-Reviews nach den kanonischen Reviewer-Anleitungen: Backend/Secrets/Interoperabilität, UI/i18n/Journey/Testqualität und Dokumentation. Korrigierte Befunde: Retry wiederholt die tatsächliche Anbieterprüfung; ungespeicherter Anzeigename sperrt die Prüfung; gescheiterter Ergebnisabruf liefert einen sichtbaren Fehler; wiederholtes Upgrade übernimmt zwischenzeitliche107-Sprachänderungen unter Erhalt bestehender Secrets/Tarife. Veraltete Benutzerhilfe, Lifecyclebeschreibung und Rollbacktext sind aktualisiert. Keine weiteren belegten notwendigen Backendbefunde. Reviews ersetzen keine Live-Anbieterabnahme.

### Direkte Nachweise

- `auth-runtime:test:unit`: 36 Fälle in Katalogfassade, DeepL-Providerprüfung und Runtime-Secrets. Rechte/gespeicherter Sessionbereich, CSRF, Providerbereitschaft und weiter erlaubtes Lesen; feste Hosts, Redirectsperre, bounded Parser,401/429/5xx/Netzfehler und Konfigurationskonflikt. Kontrollierte Provider-/DB-Ports, kein Benutzerkey.
- `core:test:unit`: 6 Katalog-/Konfigurationsfälle; unbekannte/duplizierte Sprachwahl und Deutsch als Ziel abweisen.
- App-Schnittstellen: 51 API-,23 Persistenz-,8 Formular- und27 Seitenablauffälle. Modul-/Instanz-/Rechte-/CSRFgrenzen, redigierte Projektion, verschlüsselte Keyerhaltung/Rotation/unlesbarer Key, Reaktivierung, technische Sprachfilter und echter Retry-/Refreshfehlerablauf.
- Plugin: 20 Fälle für Editor, Einrichtungshinweis, separaten Schnittstellenzugriff und lokale Lifecyclegrenzen;26 Routingfälle nach Entfernen der Sprachroute.
- PostgreSQL16, ausschließlich disponibler Container `sva-deepl-e-test`:12 Integrationstests mit `iam_app`, darunter Fremdinstanz-RLS, Unique pro Instanz, zwei konkurrierende Konfigurationsschreiber, veraltete Anbieterantwort und Suspendierung vor Ergebnispersistenz; bestehende Katalog-/Override-/Korrektur-/Atomizitätsfälle bleiben grün. Keine synthetischen Kataloge/Secrets in der Vorschau angelegt.
- Vollständiger Migrationsvalidator0→108→0→108 erfolgreich. Zusätzlich107→108→107→108 mit aktiver/inaktiver Sprachzuordnung, Revisionen, Verfügbarkeitssperre, synthetischem Ciphertext und gezielter Sprachänderung während Rollback geprüft; nach erneutem Upgrade aktuelle Auswahl und Secrets erhalten. Der zusätzliche Validatorcontainer wurde automatisch entfernt.
- Sechs betroffene Paket-Typechecks und20 Server-Runtimechecks erfolgreich. App-Typecheck unverändert vier fremde Fehler: zwei übertiefe IAM-Registry-Typinstanziierungen und zwei bestehende Zod/Resolver-Inkompatibilitäten in FAQ/Cockpit. Keine neue2E-Typdiagnose; keine App-Gesamtfreigabe.
- i18n-Keycheck, gezieltes Auth-/UI-Lint, IAM-API-Konsistenz, Dokumentations-/Linkprüfung, Dateiablage, regenerierter Seitenkatalog und striktes OpenSpec erfolgreich. OpenSpec-Telemetrie war im eingeschränkten Netz nicht erreichbar; lokale Validierung erfolgreich.
- Erst nach isolierter Migrationsprüfung konfigurierte lokale Vorschau `sva_studio_bus_test` von107 auf108 angehoben. Die bestehende deutsche Rootansicht in Firefox wurde danach erfolgreich neu geladen. Kein Instanzwechsel, kein echter DeepL-API-Key und kein externer Anbieteraufruf in dieser Prüfung.

### Neue Übergabe zur dynamischen Speicherzuständigkeit

Während des Abschlusses ging aus dem Main-Server-Chat eine neue Planungsübergabe ein: dynamischer Ressourcenübersetzungsbestand und90-Tage-Pflege künftig im Main-Server/MySQL; Studio verarbeitet DeepL und gibt Ergebnisse zurück. Codeprüfung im aktuellen Studio-Migrations-/Repository-/Auth-/Pluginbestand findet keine implementierten dynamischen Übersetzungstabellen/-jobs/-bereinigungen. Deshalb erfordert diese neue Speicheraufteilung keinen Rückbau der hier gelieferten festen Kataloge oder2E-Einrichtung. Die entsprechenden bisherigen dynamischen Planabschnitte benötigen vor weiterer Umsetzung einen eigenen konsistenten Abgleich. Technischer Worker-/Service-/Statusvertrag bleibt offen; aus der Übergabe wurde keine zusätzliche Implementierung oder Migration abgeleitet.


## Lokaler Lifecycle-Folgefix — 21. Oktober 2026

Belegter Fehler: `de-studio-sandbox` hatte eine aktive Modulzuordnung, aber `access_state=suspended`; abgeschlossener `reconcile` hebt eine Suspendierung absichtlich nicht auf. Der lokale Pluginhandler wies bisher auch `reactivate` als nicht verfügbaren Remotevorgang ab. Er führt nun beide lokalen Übergänge mit echten Schema-/Anbieternachweisen aus. Der bestehende Host öffnet ausschließlich nach erfolgreicher Reaktivierung mit `ready`/`degraded`; fehlender Anbieter degradiert und lässt die Einrichtung zu, fehlendes Schema blockiert. Der Rückgabemarker `localOnly` bleibt erhalten. Remoteabschaltung und Publisher bleiben offen. Kein eigener Zustandsautomat, keine direkte SQL-Freischaltung.

API unterscheidet fehlende Zuordnung (`deepl_requires_multilingual_module`) von gesperrtem Zugang (`deepl_module_unavailable`). Die persistierenden DB-Pfade melden ebenfalls den fehlenden Zugang und behalten ihre Modul-/Lifecycle-Sperren. Deutsche und englische Fehlermeldungen sind ergänzt.

Nachweise: acht Plugin-Lifecyclefälle (vier neue Erwartungen zunächst rot), 51 API-Fälle und 15 PostgreSQL-Integrationsfälle einschließlich beider Schreibpfade bei suspendiertem Zugang sowie Wiederzuordnung. PostgreSQL lief in einer wegwerfbaren lokalen Schema-Kopie ohne Übernahme von Instanz-/Secretbeständen; Testdatenbank danach entfernt. Zwei Paket-Typechecks, 20 Server-Runtimechecks, i18n und Dateiplatzierung erfolgreich. Gezieltes Lint meldet zwei bereits im HEAD vorhandene Architekturverletzungen in `interfaces-api.ts` (statischer Main-Server-Typimport und bestehender Repositoryimport im Mailtestpfad) sowie Warnungen; keine fachfremden Reparaturen. Der erste App-Testaufruf mit Abhängigkeitsbuild wurde durch einen fremden Zod/Resolver-Typfehler in `plugin-generic-items` blockiert; die 51 tatsächlichen API-Tests liefen anschließend isoliert im zuständigen Lib-/Hooks-Target erfolgreich.

Lokaler Lauf: regulärer Orchestrator → Job `9d0efb00-e7a0-4738-8092-d0523269ccde` → registrierter Handler → korrelierter Abschluss; Generation 13 vollständig abgeschlossen, Job `succeeded`, Zugang `active`, Bereitschaft `degraded`, kein Fehler/aktiver Claim. Der Einmalprozess verwendete ausschließlich die lokale Datenbank und sperrte sämtliche HTTP-Aufrufe. Im vorhandenen Chrome-Sandboxkontext ließ sich anschließend die DeepL-Bearbeitung mit Tarif, API-Key-Feld und Sprachabfrage öffnen. Keine Zugangsdaten gespeichert oder verändert, kein DeepL-Aufruf, keine Änderungen an gemeinsamem Keycloak oder Staging. Änderungen bleiben uncommittet.


## Alle DeepL-Zielsprachen, Varianten und Prüf-Aktionszeile — 21. Oktober 2026

Neue ausdrückliche Nutzerentscheidung ersetzt die globale Begrenzung auf 19 Pilotziele: Die Schnittstelle bietet alle stabilen Zielsprachen aus ihrer geprüften gespeicherten DeepL-Antwort an. Die unveränderte Parsergrenze verwirft weiterhin ungültige Antworten und reine Quellsprachen. Gruppierung folgt dem kanonischen BCP-47-Sprachstamm; je Stamm genau ein Ziel. Auswahl ist alphabetisch, Varianten erscheinen erst nach Aktivierung kompakt rechts in derselben Zeile. Wenn Browser-Sprachdaten keinen Namen kennen, wird der von DeepL gelieferte Name verwendet. Keine zweite Freigabeliste und kein zusätzliches Variantenregister.

`AppTranslationLocale` erlaubt nun kanonische Kennungen bis 32 Zeichen, Listen bleiben auf 500 begrenzt. Mehrfachvarianten desselben Stamms und deutsche Zielvarianten werden bei DeepL-Auswahl client-/serverseitig abgewiesen. Geschäftliche Bindung bleibt die aktuell geprüfte gespeicherte Anbieterantwort unter den vorhandenen Sperren. Bestehendes Englischformat `en`/`englishVariant` bleibt kompatibel; weitere Varianten verwenden exakte Kennungen. Katalogeditor und Übersicht stellen zusätzliche Sprachkennungen über Standard-Sprachdaten dar. Zwei bisher nur wegen endlicher Schlüsseltypen typisierte Repositorywerte werden jetzt ausdrücklich vor Verwendung validiert. Keine DDL-/Migrationsänderung, keine Datenmigration, keine Appauslieferung.

Die Prüfung steht neben Speichern/Abbrechen. Erfolgreiche Prüfung zeigt kompakten Status und eine erneute Prüfmöglichkeit. Ungespeicherte Sprachwahl und Anzeigename sperren die Prüfung nicht; Ergebnisaktualisierung erhält den bestehenden Entwurf. Ungespeicherter Key/Tarif/Aktivierungszustand und neue Schnittstelle verlangen weiterhin Speichern. Keine automatische Anbieterabfrage durch Sprachwahl/Speichern.

Nachweise: sechs Corefälle, 35 Formular-/Seitenfälle, 23 Persistenz-/Secretfälle, 32 Anbieter-/Fassadenfälle, 15 Editor-/Übersichtsfälle und 13 echte PostgreSQL-Fälle. Neue Fälle umfassen Arabisch, kanadisches Französisch, portugiesische und chinesische Varianten, abgewiesene Mehrfachvarianten/nicht bestätigte Zielcodes, erhaltene ungespeicherte Formularwerte und einen vollständigen Katalogsatz mit vier zusätzlichen Sprachen bei unverändertem Deutsch. Der zusätzliche PostgreSQL-Fall wurde von der bestehenden RLS-Fixture isoliert; alle 13 Fälle liefen anschließend grün. Wegwerfdatenbank enthielt nur lokale Schemakopie und synthetische Fixtures und wurde danach entfernt.

Fünf Paket-Typechecks und 20 Server-Runtimechecks erfolgreich. App-Typecheck meldet ausschließlich die vier bekannten fremden IAM-/FAQ-/Cockpitfehler. Gezieltes Lint hat keine neuen Befunde; bestehende Lazy-Import-Grenzfehler im bisherigen Interface-Persistenzpfad bleiben dokumentiert. i18n, Dateiablage und striktes OpenSpec erfolgreich; dessen Telemetrie war im eingeschränkten Netz nicht erreichbar. Im separaten lokalen Chrome-Prüftab waren alle Sprachgruppen, die vorhandenen englischen/französischen/portugiesischen Varianten sowie die gemeinsame Aktionszeile mit „Verbindung erneut prüfen“, Prüfstatus, Speichern und Abbrechen sichtbar. Kein Prüf-/Speicherknopf betätigt, kein Live-Anbieteraufruf, keine Keycloak-/Stagingänderung. Die zuvor offene Benutzerbearbeitung wurde nicht neu geladen.


## Zwischenabschluss 2E mit spezialisierten Codereviews — 21. Oktober 2026

Reviewbasis ist der gesamte uncommittete Stand gegenüber `48821df2b`, einschließlich neuer Dateien. Drei getrennte Reviews decken Backend/Secrets/Autorisierung/Testqualität, Frontend/Bedienbarkeit/i18n/Performance und Spec-/Dokumentationsvollständigkeit ab. Dies ist ein lokaler Zwischenabschluss der Katalogbearbeitung und DeepL-Einrichtung, keine Abnahme der automatischen Übersetzung oder Appauslieferung.

Behobene Befunde und erneute Fachprüfung:

- **P1 Rückmigration 0108:** Nach Auswahl zusätzlicher DeepL-Ziele fehlten beim Down die Fremdschlüsselziele in `available_languages`. Der echte PostgreSQL-Regressionstest scheiterte zunächst mit `23503`. Down stellt nun historische sowie aktuell ausgewählte Sprachkennungen vor den Zuordnungen her. Derselbe Test führt Down und Up in einer zurückgerollten Testtransaktion aus und weist `ar`, `fr-CA`, `pt-BR`, `zh-Hant` sowie erhaltene verschlüsselte Schlüssel und Kataloge nach. Keine zusätzliche Tabelle oder Runtime-Sprachliste.
- **P2 Eingabevalidierung:** Zod führte die Array-Prüfung trotz ungültiger Sprachelemente aus; `Intl.Locale` warf einen `RangeError`. Schema und serverseitiger Record-Aufbau prüfen jetzt Gültigkeit vor dem Sprachstammzugriff. Der zunächst rote Persistenztest und die ergänzten echten `safeParse`-Prüfungen weisen für leere/ungültige Kennungen reguläre Ablehnung nach.
- **Doku-Konsistenz:** Modulreaktivierung darf den weiterhin gültigen Prüfnachweis derselben Zugangskonfiguration wiederverwenden. Key-/Tarifwechsel verlangen erneut Prüfung. Design, README und arc42 beschreiben dies übereinstimmend; alte Hinweise auf den Hauptmenüpunkt „Sprachen“, nicht aktivierbare weitere DeepL-Ziele und frühere Buttonnamen sind bereinigt. Keine neue Prüfschicht.

Nachreviews melden für diese Korrekturen keine verbleibenden Blocker. Die bestehenden Schutzgrenzen bleiben erhalten: eigene Instanzcredentials, Modul-/Lifecyclebindung, aktive Organisation, getrennte Host-/Pluginrechte, Konfigurationsrevision und transaktionale Sperren. Neue Konzepte, Packages, Runtimepfade oder Testdateien wurden im Reviewabschluss nicht eingeführt.

Abschlussnachweise im aktuellen Arbeitsstand:

- 238 gezielte Unitfälle grün: Core 6, Anbieter/Fassade 32, Plugin/Editor/Lifecycle 23, Schnittstellenformulare 35, Persistenz/Validierung 23, API/Breadcrumbs 69 und Navigation 50.
- 14 echte PostgreSQL-Fälle grün, einschließlich zusätzlichem Down-/Up-Regressionstest. Isolierte lokale Datenbank `sva_checkpoint_test` enthielt ausschließlich Schemastruktur und synthetische Fixtures, keine kopierten Instanz-/Secretdaten; nach Abschluss entfernt.
- Fünf Paket-Typechecks und das vollständige Server-Runtime-Gate mit 20 Runtimeprüfungen grün.
- i18n, OpenAPI, Dokumentation/Links, Seitenkatalog, Dateiablage, App-/Plugin-UI-Grenzen und strikte OpenSpec-Validierung grün. OpenSpec-Telemetrie konnte den externen Endpunkt nicht erreichen; die eigentliche Validierung ist erfolgreich.
- Vollständiger App-Typecheck bleibt bei denselben vier bekannten Fremdfehlern in IAM-Registry, FAQ und Cockpit rot; kein neuer Typfehler dieses Abschnitts. Lint der 60 geänderten TypeScriptdateien meldet 22 Fehler; ein Vergleich jedes betroffenen Datei-Inhalts aus `HEAD` unter derselben Konfiguration reproduziert sämtliche 22 Fehler bereits dort. Bestehende Lazy-/Tag-Grenzen, acht Escape-Befunde und ein Catch-Cause-Befund werden nicht als behoben behauptet. Der Plugin-Architekturguard läuft warn-only und nennt die bestehenden Serverbeiträge von Mehrsprachigkeit, SSF und Waste Management.

Lokale Browserdiagnose vor dem Zwischenreview: Der laufende Entwicklungsserver hatte alte Berechtigungsdefinitionen geladen. Ein vollständiger lokaler Neustart, nicht bloß Redisbereinigung, stellte „App → App-Texte“ her; Navigation und Seite wurden in Chrome geprüft. Die Nutzerin/der Nutzer hat anschließend gemeinsame Basisübernahme, deutschen Override, gesicherten lokalen Textstand, Übernahme der drei Zielsprachen und manuelle Sprachansicht selbst ausprobiert. Ein unveröffentlichter Root-Draft wird weiterhin nicht automatisch verteilt.

Offen bleiben Maschinenübersetzungsaufträge mit Platzhalterschutz und Korrekturerhalt, Main-Server-Vertragsabgleich/Publisher, Appintegration und dynamische Inhalte. Kleine Bedienungsverbesserungen bleiben Follow-up: instanzbezogene Leermeldung statt Importaufforderung, verständliche Revisionsbezeichnungen statt technischer UUIDs und klarere Führung durch Basis-/Sprachübernahme. Diese erweitern den fachlichen Abschluss nicht. Während der Abschlussprüfungen keine Live-DeepL-Aufrufe, keine Änderungen an Keycloak oder Staging, kein Push oder Deployment. Der Nutzer hat den geprüften Stand anschließend für einen lokalen Zwischencommit freigegeben; ein Push ist nicht beauftragt.
