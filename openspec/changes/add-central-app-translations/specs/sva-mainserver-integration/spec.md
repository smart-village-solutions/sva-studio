## ADDED Requirements

### Requirement: Studio pusht feste App-Kataloge als revisionsfeste Static Contents

Das System MUST bestätigte kommunale Katalogsnapshots über die vorhandene serverseitige Main-Server-Anbindung mit verifiziertem Organisationsprincipal übertragen. App und Build MUST die Auslieferungskopie über `publicJsonFile(name, version)` lesen können. Ein Main-Server-Pull fester Kataloge aus Studio MUST nicht erforderlich sein. Der Katalogpfad MUST normalisierte Namen, explizite Versionen und einen Empfängernachweis für Unveränderlichkeit besitzen; der bestehende generische Upsert allein genügt nicht. Die vorhandene kompatible Versionsauswahl und unversionierte Fallbacks von `publicJsonFile` MUST nicht als exakte Revisionssuche vorausgesetzt werden. Ausgelieferte Identität, erwartete gespeicherte Version, App-Kompatibilität und kanonische Prüfsumme MUST gegen die gepinnte Referenz geprüft werden; ein `not found`-/Leerobjekt oder falscher Fallback MUST nicht als bestätigter Katalog gelten. Bestehende allgemeine Versionsauswahl MUST verhaltensgleich bleiben. Speichergröße und Zeichensatz des Empfängers MUST den realen vollständigen Katalog samt erforderlichen Unicodezeichen ohne Kürzung tragen.

#### Scenario: Wiederholung und abweichender Revisionsinhalt

- **GIVEN** ein Main-Server enthält bereits einen bestätigten Katalog unter normalisiertem Namen und Version
- **WHEN** Studio dieselbe Revision wiederholt überträgt
- **THEN** bestätigt der Empfänger gleichen Inhalt idempotent und weist abweichenden Inhalt als Konflikt zurück
- **AND** kann ein anderer generischer Static-Content-Writer diesen Revisionsschutz nicht umgehen
- **AND** bleiben bestehende andere Static-Content-Verbraucher einschließlich leerer Version verhaltensgleich

#### Scenario: Kompatibler Fallback statt gepinnter Revisionsidentität

- **GIVEN** ein Build beziehungsweise Publikationsjob erwartet eine gepinnte Katalogreferenz mit bekannter gespeicherter Version und Prüfsumme
- **WHEN** der bestehende Leser stattdessen einen älteren/unversionierten Eintrag oder `not found` mit leerem Objekt liefert
- **THEN** wird diese Antwort nicht als der erwartete Katalog akzeptiert oder aktiviert
- **AND** bleibt das Verhalten anderer allgemeiner Static-Content-Verbraucher unverändert

### Requirement: Katalogreferenzen erst nach bestätigtem Transfer umschalten

Das System MUST die aktive Katalogreferenz erst nach geprüftem Transfer-Read-back bedingt aktivieren und die Aktivierung bestätigen. Konkurrierende oder verspätete Jobs MUST keine neuere Referenz oder andere Sprachreferenzen überschreiben. globalSettings MUST nicht ungeschützt vollständig überschrieben oder mit kompletten Katalogen gefüllt werden. Der aktive Index MUST den gemeinsamen Satz aus Deutsch und allen kommunal angebotenen Zielsprachen, gepinnten Sprachsnapshots derselben Satzrevision und der Sprachauswahl bedingt als Ganzes umschalten. Teilsprachen MUST nicht vorab aktiviert werden. Automatische Standardübernahme MUST veröffentlichte kommunale Overrides je Sprache erhalten und unveröffentlichte Entwürfe ausschließen; sie MUST keine zusätzliche kommunale Freigabe benötigen. Nur ausdrücklich bestätigte neue App-Schlüssel dürfen die dokumentierte Deutsch-Ausnahme tragen. Der Vertrag MUST einen kanonischen Scope-/Vertragsnamensraum und einen vollständigen geordneten Satzdeskriptor mit Satzrevision und Prüfsumme verwenden. Die Aktivierung MUST alle Referenzen gemeinsam validieren und atomar umschalten, statt eine Locale zu patchen. Konkrete Operations- und Feldnamen bleiben bis zur technischen Bestätigung Vorschläge in Design 4.1. Gleicher bereits aktiver Satz MUST nach ACK-Verlust idempotent bestätigt werden; anderer Inhalt derselben Satzrevision MUST Konflikt sein. Sonst MUST die erwartete aktive Satzrevision passen und die neue Satzrevision größer sein; bei Erstaktivierung MUST ausdrücklich das Fehlen eines aktiven Satzes erwartet werden. Jede Änderung des aktiven Indexes einschließlich Sprachmenge MUST eine neue Satzrevision verwenden; eine separate Indexgeneration MUST entfallen. Sprachsnapshots MUST durch Scope, Vertrag, Satzrevision und Sprache eindeutig identifiziert werden, ohne eigene Sprachrevisionszähler. Ein überholter Auftrag MUST sich nicht blind auf eine frisch gelesene aktive Satzrevision umbasieren. V1 MUST den Index aus Scope/Vertrag ableiten und ohne globalSettings-Write auskommen.

#### Scenario: Transfer- oder Aktivierungsantwort geht verloren

- **GIVEN** ein vorheriger Katalog ist bestätigt aktiv
- **WHEN** ein neuer Transfer beziehungsweise Referenzwechsel erfolgreich sein könnte, aber dessen Antwort verloren geht
- **THEN** klärt Studio den Zustand anhand von Nutzlast-/Referenz-Read-back, aktiver Satzrevision und Prüfsumme
- **AND** dupliziert oder verändert es nicht dieselbe Revision mit neuen Bytes
- **AND** bleibt die letzte bestätigte Studio-Veröffentlichung gültig, bis die neue Aktivierung bestätigt ist
- **AND** erhält ein Transferfehler die bisherige Remote-Referenz

#### Scenario: Eine Sprache fehlt beim gemeinsamen Satzwechsel

- **GIVEN** Deutsch und alle bis auf eine angebotene Zielsprache wurden erfolgreich übertragen
- **WHEN** die verbleibende Übertragung fehlschlägt
- **THEN** bleibt der bisherige gesamte Satz aktiv und wird keine einzelne neue Sprache vorab aktiviert
- **AND** schaltet ein späterer erfolgreicher gemeinsamer Index-CAS alle Referenzen als Satz um

#### Scenario: Erstaktivierung ohne separaten Generationszähler

- **GIVEN** im gebundenen Scope/Vertrag ist noch kein Katalogsatz aktiv
- **WHEN** ein vollständiger positiver Satz mit ausdrücklich erwartetem leerem Vorgänger aktiviert wird
- **THEN** wird der gesamte Satz atomar aktiv und identifiziert seine Sprachsnapshots über Satzrevision und Sprache
- **AND** wird ein konkurrierender anderer Satz mit weiterhin erwartetem leerem Vorgänger abgewiesen

#### Scenario: Überholter Satz mit frisch gelesener aktiver Satzrevision

- **GIVEN** Satzrevision 12 ist vollständig aktiv, während ein alter Auftrag noch Revision 11 veröffentlichen möchte
- **WHEN** dieser Auftrag die aktive Satzrevision liest und seinen alten Deskriptor damit erneut aktiviert
- **THEN** wird der alte Satz trotz passendem erwarteten Vorgänger abgewiesen
- **AND** bestätigt ein Retry des exakt aktiven Satzes 12 nur den bestehenden Index ohne Indexänderung

### Requirement: Main-Server vermittelt dynamische Texte über neue technische Studio-Schnittstelle

Das System MUST einen ausdrücklich authentifizierten und autorisierten technischen Main-Server→Studio-Übersetzungsvertrag für geprüfte dynamische Vorlagen bereitstellen. Main-Server MUST Kommune, aktuelle Originalherkunft, passende Vorlage, technische Anzeigeprofile, deutsche Ausgangssprache und aktuell angebotene Zielsprache vor der Vermittlung verifizieren. Die kommunale Mehrsprachigkeitsvereinbarung umfasst die Zustimmung für eingebundene Inhalte; ein zusätzlicher technischer Freigabeprozess pro Mandant oder Quelle MUST entfallen. Diese Zustimmung MUST technische Herkunfts-/Feldprüfungen und den Ausschluss privater Nutzerwerte nicht ersetzen. Öffentliche redaktionelle Texte mit enthaltenen Personennamen MUST zulässig sein. Studio MUST die ausdrücklich zugelassene verifizierte technische Serviceidentität unmittelbar mit ihrer festen Kommunen-/Instanz-/Organisationsbindung autorisieren, ohne zusätzliche Übersetzungsrolle. Gültiges Token oder Clientname allein MUST nicht genügen. Geeigneten vorhandenen Dienstausweis wiederverwenden; menschliche Sessions MUST keine technische Befugnis erhalten. Konkrete Identität/Bindung MUST noch lesend geprüft werden, ohne Einrichtung durch diesen Planungsabgleich. Der App-Statusweg MUST die geschützte Main-Server-Abholnummer verwenden; der Originalbezug für die bestätigte Studio-Formularanzeige MUST zusätzlich konkretisiert werden und darf nicht grundsätzlich aus Studio ausgeschlossen werden. Studio MUST geprüfte wertfreie Vorlagen samt Übersetzungsprofil, Format/Kontext, Sprache und verifiziertem Scope verarbeiten; ein dauerhafter Originalreferenzbestand MUST entfallen. Die aktuelle Quellenprüfung MUST im App-Pfad vor jedem Studio-Abruf im autorisierten Gateway erfolgen und darf nicht durch App-Payloads ersetzt werden. Auch fertige Treffer und Statusantworten MUST im Main-Server an eine aktuell für den App-Aufrufer lesbare Quelle mit passender Vorlage gebunden werden. Unsichtbarschaltung oder Zugriffsentzug MUST die Ausgabe über diesen Bezug verhindern; tenantgebundene Entry-IDs allein genügen nicht. Ein anderer aktuell lesbarer Originalbezug desselben Texts MUST weiterhin verwendet werden dürfen; der Cache bleibt erhalten. Ein direkter Main-Server-Datenbankzugriff auf Studio oder ein generischer Browser-Proxy MUST ausgeschlossen sein.

Die bestehende Main-Server-Municipality↔Studio-Mandant-Verbindung MUST die fachliche Zuordnung bestimmen. Zusätzliche Kommunenzuordnung, Seed-Organisationsauswahl oder parallele Bindingregistry allein für Übersetzungen MUST entfallen. Studio MUST verifizierten Issuer, Client und konkretes Service-Subject gegen diese bestehende Verbindung prüfen; Clientname allein MUST bei gemischten Login-/Serviceclients nicht genügen. Geeignete vorhandene Audience-, Modul-, Organisations- und Sprachgrenzen MUST erhalten bleiben. Fehlende technische Identitätsmetadaten MUST am bestehenden Verbindungsnachweis konkretisiert werden, statt eine zweite fachliche Zuordnung einzuführen.

#### Scenario: App-Zugriffsprüfung und Studio-Formularbezug getrennt klären

- **WHEN** Main-Server einen Auftrag aus einem berechtigten fremdsprachigen App-Inhaltsabruf vermittelt
- **THEN** prüft er aktuelle Quelle, passende Vorlage und Lesbarkeit vor dem Studio-Aufruf
- **AND** prüft Studio Servicebindung, Scope, Rechte, Sprache und technische Textregeln selbst; die zusätzlich benötigte Originalzuordnung für Studio-Formulare bleibt im Detail offen
- **AND** führt eine im Gateway nicht mehr zulässige Quelle zu keinem Studio-Abruf und keinem Nutzungs-Touch

#### Scenario: App sendet manipulierte Kommune

- **GIVEN** ein Main-Server besitzt eine technische Studio-Bindung für Kommune A
- **WHEN** eine App Kommune B oder eine fremde Status-ID im Übersetzungsauftrag übermittelt
- **THEN** erzeugt dies keine Studio-Übersetzung oder Statusausgabe für B
- **AND** ersetzt die App-Payload keine technische Clientbindung
- **AND** bleiben vorhandene Inhaltsqueries und Ressourcenantworten unverändert

#### Scenario: Sichtbarkeit vor einem Statuspoll entzogen

- **GIVEN** eine App hat für einen sichtbaren Originalinhalt eine ausstehende Entry-ID erhalten
- **WHEN** der Inhalt vor dem nächsten Poll unsichtbar wird
- **THEN** prüft der Main-Server den aktuellen Originalzugriff erneut und gibt über diesen Bezug keinen übersetzten Text aus
- **AND** löst diese Auslieferungssperre keine Cachelöschung aus

### Requirement: Aktuelle Quellenprüfung ohne dauerhaften Originalabgleich

Main-Server MUST im App-Pfad vor neuen Anfragen, Cachetreffern und Statusabrufen aktuelle Herkunft, passenden Text und Lesbarkeit prüfen. Kurzlebige Locators/Digests oder geschützte Statushandles dürfen dafür verwendet werden; sie MUST keinen dauerhaften Originalverwendungsbestand begründen. App-IDs, Texte, Mandantenwerte und URLs MUST keine Rechte erzeugen. Für externe Inhalte einschließlich Bus MUST ausschließlich fest konfigurierte geprüfte Quellen/Gebiete und zulässige Darstellungsfelder verwendet werden. Für Bus MUST die bestätigte Frischegrenze von höchstens 300 Sekunden seit erfolgreichem Upstream-Abruf/Validierung im vorhandenen Bus-Cache gelten; kürzere Vorgaben, Cacheverbote und erforderliche Validierung MUST erhalten bleiben. HIT MUST die Frist nicht verlängern; STALE oder unbelegbare Frische MUST als Herkunftsnachweis ausscheiden. Die koordinierte Bus-Anpassung und Behandlung alter länger gültiger Einträge MUST vor Nutzung nachgewiesen sein; zusätzlicher Main-Server-Cache oder Altersnachweisdienst MUST entfallen. Frische anderer Quellen und Fallback MUST vor Aktivierung konkretisiert sein. Timeout, Teilantwort, 404 oder veralteter Proxycache MUST keine Cache-Löschsignale sein. Bei fehlendem Herkunftsnachweis MUST die Anfrage sicher scheitern und das vereinbarte App-Rückfallverhalten gelten.

Originalregister, Änderungsjournal, Commitsequenzen, Bestands-Snapshots, Sync-Epochen/Cursor/Replay/Tombstones, Verwendungsprüfungen und Original-Schreib-/Löschhooks für Cachepflege MUST entfallen. Neue Anzeigeanfragen und Originalveröffentlichung MUST auf keinen Bestandsabgleich warten. Main-Server MUST den dynamischen MySQL-Bestand unabhängig davon täglich nach mindestens 90 Tagen ohne autorisierte fertige App-Ausgabe bereinigen. Main-Server MUST nur aktuell berechtigte App-Abrufe fertiger Ergebnisse vermitteln; Wartungs-/Hintergrundprüfungen dürfen keinen Nutzungs-Touch auslösen. Bereinigte Entry-IDs MUST erklärbar behandelt werden; nur ein neuer berechtigter fremdsprachiger App-Inhaltsabruf darf fehlende Übersetzungen erneut anstoßen, Statuslesen MUST keinen Job erzeugen.

#### Scenario: Externe Quelle nicht aktuell belegbar

- **WHEN** die konfigurierte Bus-/Inhaltsquelle Timeout, Teilantwort oder 404 liefert beziehungsweise nur einen unzulässig alten Proxycache bietet
- **THEN** wird für nicht belegbare Inhalte keine Übersetzung ausgegeben oder Nutzungsfrist verlängert
- **AND** erfolgt kein Cache-Löschauftrag und benötigt das System keinen vollständigen externen Bestand oder Löschbeleg

#### Scenario: Geänderte Vorlage und bereinigter Treffer

- **WHEN** sich der aktuelle Originaltext ändert oder der bisherige Cacheeintrag regulär bereinigt wurde
- **THEN** prüft der Main-Server bei erneutem berechtigtem App-Inhaltsabruf die aktuelle Vorlage und Lesbarkeit ohne Bestandsabgleich
- **AND** erzeugt geänderter Text eine andere Identität, ohne den geteilten alten Treffer zu überschreiben
- **AND** darf eine unveränderte aktuell berechtigte Vorlage erneut übersetzt werden

### Requirement: Pluginabschaltung über denselben bestätigten Katalogvertrag

Das System MUST die fachliche Abschaltung der Mehrsprachigkeit je gebundener Organisation für sämtliche weiterhin ausgelieferten aktiven App-Vertragsindizes ausliefern: pro Vertrag ein kompatibler vollständiger Deutsch-only-Satz mit neuer Satzrevision, vorhandenem gemeinsamen CAS und Read-back. Sämtliche betroffenen Indizes MUST vor vollständiger Abschaltbestätigung erfolgreich geprüft sein. Die Vertragsmenge MUST aus dem bestehenden Release-/Indexbestand ermittelt werden; ein zusätzliches Vertragsregister MUST entfallen. Wiederaktivierung MUST pro weiterhin unterstütztem Vertrag kompatible neue vollständige Sätze bestätigen. Direkte Indexlöschung, einzelne Locale-Patches oder ungeschützte globalSettings-Writes MUST entfallen. Der Kontrollauftrag MUST ohne DeepL auskommen und die gültige deutsche Basis erhalten. Ein alter Publikationsauftrag oder eine verspätete Reaktivierungsantwort MUST eine jüngere Suspendierung nicht wieder auf Fremdsprachen erweitern. Studio und Main-Server MUST die Ordnung/Fencing mit vorhandener Lifecyclegeneration und Satzrevision technisch abstimmen und unter Konkurrenz/ACK-Verlust nachweisen; konkrete Empfängerformen bleiben offen und MUST vor Lieferung bestätigt sein. Ein Modulstatus im Browser allein MUST keine Remoteabschaltung beweisen.

#### Scenario: Alter Fremdsprachenauftrag trifft auf Suspendierung

- **GIVEN** ein Fremdsprachenauftrag läuft bereits und eine neuere Suspendierung verlangt Deutsch-only
- **WHEN** Übertragungen oder Aktivierungsantworten in vertauschter Reihenfolge eintreffen
- **THEN** kann der alte Auftrag den bestätigten Abschaltstand nicht zurücknehmen und sich nicht auf einen frisch gelesenen Vorgänger umbasieren
- **AND** meldet Studio vollständige Abschaltung erst nach Empfängernachweis aller betroffenen aktiven Vertragsindizes
- **AND** benötigt spätere berechtigte Reaktivierung einen neuen vollständigen Satz statt Rückwärtsaktivierung

### Requirement: Dynamischer App-Inhaltsabruf mit Sprachheader und geschützter Statuskorrelation

Das System MUST die gewählte Sprache zentral per HTTP-Header `Accept-Language` im bestehenden GraphQL-Inhaltsabruf verwenden, ohne Query-Sprachargumente oder neue Pflicht-Ressourcenfelder. Vorhandene Stringfelder/Ressourcenstruktur MUST erhalten bleiben; passende vollständige Übersetzung je Inhalt oder vollständiger deutscher Rückfall, keine Sprachmaps oder `*I18n`-Felder. Berechtigter fremdsprachiger App-Miss MUST automatisch einen deduplizierten lokalen Hintergrundauftrag auslösen; ein separater Pflicht-REST-Submit MUST entfallen. Treffer MUST ohne Studio/DeepL geliefert werden. Studio-Formularlesen auch mit englischem Header, Deutschabrufe, fehlende Rechte, deaktivierte Sprache, Originalschreibwege und feste veröffentlichte Katalogartefakte MUST keine dynamischen Jobs auslösen. Die App-/Redaktionsunterscheidung MUST serverseitig verifiziert sein und darf nicht auf einem frei wählbaren Header beruhen; die konkrete Bindung bleibt vor Umsetzung abzustimmen.

App-HTTP MUST nicht auf DeepL warten. Ohne vollständigen Treffer MUST dieselbe Struktur zunächst Deutsch bleiben; die App darf innerhalb höchstens fünf Sekunden erneut lesen und MUST bei Fehler/Fristablauf für diese Ansicht Deutsch ohne späten Austausch behalten. Sprache sowie aktueller Quellen-/Übersetzungsstand MUST in Antwort- und Appcache berücksichtigt werden. Main-Server→Studio MUST ein getrennter authentifizierter Übersetzungsvertrag bleiben. Worker-/Antwort-/Retryform und Rückfall-/Status-/Abholnummerkorrelation ohne Pflicht-Inhaltsfelder MUST vor Umsetzung gemeinsam festgelegt werden. REST-Status bleibt Vorschlag. Die bestätigte geschützte Abholnummer MUST nicht still entfallen: authentifiziert verschlüsselt mit Entry-ID, Kommune/Bindung, Quelle/Profil, Textdigest und zehn Minuten Ablauf ab Ausstellung ohne Pollverlängerung; Einbindung, Kryptografie und Rotation bleiben offen. Vor jedem Studio-Aufruf, jeder Ergebnisübernahme und Ausgabe MUST aktuelle Quelle, passende Vorlage, Lesbarkeit und Sprachfreigabe geprüft werden. Kein dauerhafter zweiter dynamischer Inhaltsbestand in Studio oder zusätzliches Quellenregister.

#### Scenario: Aliase und parallele Wiederabrufe

- **WHEN** ein berechtigter App-Abruf denselben Inhalt über GraphQL-Aliase, Fragmente, Listen oder parallele Wiederabrufe lädt
- **THEN** entsteht für denselben fehlenden Text im gleichen Kommune-/Kontext-/Zielbereich nur ein wirksamer Hintergrundauftrag
- **AND** erfolgt keine Jobanlage je Feldresolver oder Neuanlage fehlgeschlagener Arbeit je Poll

#### Scenario: Studio-Formularabruf bleibt lesend

- **WHEN** ein redaktioneller Studio-Formularabruf `Accept-Language: en` oder einen frei gesetzten App-Kontextheader sendet
- **THEN** entstehen weder Übersetzungsjobs noch ein `last_used_at`-Touch
- **AND** wird die Kontextberechtigung ausschließlich serverseitig verifiziert

#### Scenario: Abholnummer abgelaufen oder manipuliert

- **WHEN** ein Statusrequest eine abgelaufene oder manipulierte Abholnummer verwendet
- **THEN** wird kein Ergebnis ausgegeben und verlängert Polling keine Frist
- **AND** löscht der Ablauf keine Übersetzung und startet selbst keinen Job
- **AND** kann ein neuer berechtigter und aktuell geprüfter App-Inhaltsabruf dieselbe fertige Übersetzung aus der Main-Server-Tabelle erhalten

#### Scenario: Quelle oder Sprachfreigabe trotz gültiger Abholnummer entzogen

- **GIVEN** eine Abholnummer ist noch innerhalb ihrer zehnminütigen Frist gültig
- **WHEN** Quelle, passende Vorlage, Lesbarkeit oder Sprachfreigabe nicht mehr bestätigt werden können
- **THEN** erfolgen über diesen Bezug weder Studio-Abruf noch Übersetzungsausgabe
- **AND** begründet der gültige Handle allein keinen Zugang und keine Fristverlängerung des Übersetzungscaches
