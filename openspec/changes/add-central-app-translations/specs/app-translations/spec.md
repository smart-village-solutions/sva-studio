## ADDED Requirements

### Requirement: Zentrale Studio-Quelle für feste und dynamische App-Übersetzungen

Das System MUST feste App-Kataloge einschließlich Deutsch, gemeinsame Standards, kommunale Overrides und dynamische Übersetzungsergebnisse zentral im Studio-Backend/PostgreSQL führen. Der Main-Server MUST für feste Kataloge ausschließlich Auslieferungsreplik sein. Host-i18n und SSF-Konfigurationssprachen MUST getrennte Verantwortlichkeiten behalten. Die erste Produktauslieferung MUST feste und dynamische Strecken gemeinsam und sämtliche zulässigen Anzeigetexte unabhängig vom Inhaltstyp abdecken. Magdeburg MUST als erste Pilotkommune alle 19 benannten Zielsprachen erhalten; andere Kommunen MUST ihre Auswahl aus der zentral freigegebenen Sprachliste selbst bestimmen können.

#### Scenario: Kommunales Deutsch ohne doppelte manuelle Quelle

- **GIVEN** ein Standardtext besitzt einen kommunalen deutschen Override
- **WHEN** ein vollständiger Katalog für diese Kommune veröffentlicht wird
- **THEN** enthält er den Override aus Studio und keinen separat manuell gepflegten App-Default
- **AND** stellt das Rücksetzen des Overrides den aktuellen Standard im Entwurf wieder her, ohne alte Snapshots zu ändern

### Requirement: Kontrollierter versionierter App-Schlüsselvertrag

Das System MUST App-Schlüssel, erlaubte Werttypen, Platzhalter und Kompatibilität über ein versioniertes Manifest registrieren. Identische Importe MUST idempotent sein; abweichende Inhalte derselben Version MUST abgewiesen werden. Importe MUST redaktionelle Werte und kommunale Overrides erhalten. Neue Schlüssel oder geänderte Platzhalterverträge MUST als neuer kompatibler Vertrag geführt werden.

#### Scenario: Wiederholter Import überschreibt keine Redaktion

- **GIVEN** Studio enthält redaktionell bearbeitete deutsche Texte und kommunale Overrides
- **WHEN** ein berechtigter Manifestclient denselben technischen Vertrag erneut importiert
- **THEN** entstehen weder Duplikate noch eine Überschreibung dieser Werte
- **AND** verhindert ein späterer Release-Build keine fehlenden Schlüssel durch unkontrolliertes Nachpflegen in Studio

### Requirement: Lokale Katalogvorbereitung von externer Veröffentlichung trennen

Das System MUST vollständige globale und kommunale Katalogsätze intern prüfen und unveränderlich versiegeln können, ohne dafür Main-Server oder Anbieter aufzurufen. Eine lokale Versiegelung MUST Scope-/Action-, Manifest-, Vollständigkeits-, Platzhalter- und Korrekturschutzprüfungen erfüllen und den gesamten Satz atomar unter einer Satzrevision speichern. Identische Wiederholung derselben gepinnten Basis MUST denselben Satz liefern. Sie MUST weder eine externe Veröffentlichung beziehungsweise Aktivierung noch einen freigegebenen App-Buildexport behaupten. Der erste interne Abschnitt MUST keine maschinelle Übersetzung durch Fake-Ergebnisse oder eine zweite manuelle Produktstrecke ersetzen; unvollständige Werte MUST die Versiegelung verhindern. Die spätere erste Produktauslieferung MUST feste und dynamische Strecke weiterhin gemeinsam umfassen.

#### Scenario: Interner vollständiger Satz ohne externen Empfänger

- **GIVEN** ein berechtigter interner Aufruf besitzt vollständige gültige Sprachwerte und eine gepinnte globale Basis
- **WHEN** der Satz lokal versiegelt und derselbe Vorgang wiederholt wird
- **THEN** entsteht genau ein unveränderlicher vollständiger Satz ohne Anbieter-/Main-Server-Aufruf
- **AND** bleibt er lokal `sealed` und erzeugt weder aktive App-Referenz noch veröffentlichten Zustand

#### Scenario: Unvollständige lokale Vorbereitung

- **WHEN** eine benötigte Sprachfassung fehlt, eine manuelle Korrektur ungeklärt ist oder eine veraltete Draftrevision verwendet wird
- **THEN** entsteht kein Teilsatz und wird kein bestehender Satz verändert
- **AND** löst der interne Abschnitt weder einen Fake-Anbieteraufruf noch eine automatische Deutsch-Ausnahme aus

### Requirement: Lokaler Katalogeditor ohne externe Veröffentlichung

Das System MUST globale Standardpflege im bestehenden Root-/Plattformpfad und kommunale Katalogpflege im optionalen Modul „Mehrsprachigkeit“ über dieselbe lokale Katalogbasis ermöglichen. Kommunale Reads, Änderungen und lokale Versiegelung MUST die getrennten Rechte `app-translations.catalog.read`, `app-translations.catalog.write` und `app-translations.catalog.publish` sowie den bestehenden Modul-/Organisationsscope prüfen. Globale Entwürfe und technischer JSON-Manifestimport MUST dem verifizierten Root-Kontext vorbehalten bleiben. Der Editor MUST Entwurf, sprachbezogene Vererbung/Overrides, Platzhalter, Korrekturstatus und Revisionskonflikte verständlich darstellen. „Prüfstand erstellen“ MUST ausschließlich einen vollständigen unveränderlichen lokalen Satz erzeugen; die Vorschau MUST ihn von einer App-Veröffentlichung unterscheiden. Ein synthetischer Deutsch-/Englisch-Testkatalog MUST ausschließlich kontrollierter lokaler Erprobung dienen, ohne automatische Seeds realer Mandanten, Fake-Übersetzungen oder zweite produktive App-Textquelle.

#### Scenario: Kommunalen Entwurf speichern und gezielt zurücksetzen

- **GIVEN** ein berechtigter kommunaler Editor besitzt eine ausdrücklich gepinnte vollständige globale Basis
- **WHEN** er einen deutschen Override speichert, die Seite neu lädt und den Override anschließend zurücksetzt
- **THEN** bleibt der gespeicherte Wert bis zum Reset erhalten und folgt danach wieder der gepinnten Basis
- **AND** bleibt die englische Vererbung unverändert, ohne Zugriff auf einen globalen Entwurf

#### Scenario: Konflikt und unvollständiger lokaler Prüfstand

- **WHEN** ein Editor mit veralteter Draftrevision speichert oder ohne vollständige gültige Sprachwerte einen Prüfstand erstellen möchte
- **THEN** wird die Operation mit erklärbarem Konflikt beziehungsweise Validierungsfehler verweigert und bleiben ungespeicherte Eingaben im Editor erhalten
- **AND** entsteht weder ein Teilsatz noch eine externe Veröffentlichung

### Requirement: Geprüfte Entwürfe und unveränderliche Katalogrevisionen

Das System MUST globale und kommunale Entwürfe von unveränderlichen veröffentlichten Revisionen im bestehenden Releasebestand trennen. Globale Standardrevisionen MUST dauerhaft anhand ihrer versiegelten Werte pinnbar bleiben; kommunale Aufträge MUST auch nach Verzögerung oder Wiederanlauf diese veröffentlichte Revision statt aktueller globaler Draftwerte verwenden. Das System MUST Entwürfe von veröffentlichten kommunalen Katalogen trennen und Veröffentlichung an Manifest-, Standard- und Draftrevision binden. Vollständigkeit, Locale, Werttypen und Platzhalter MUST vor Versiegelung geprüft werden. Dieselbe Revisionsidentität MUST unveränderliche Nutzlast und Prüfsumme besitzen. Ein vollständiger Katalogsatz MUST eine gemeinsame Satzrevision je Scope/Vertrag besitzen; seine Sprachsnapshots MUST über dieselbe Satzrevision und die Sprache identifiziert werden, ohne separate Sprachrevisionszähler. Änderungen der tatsächlichen deutschen Übersetzungsquelle MUST davon abhängige manuelle Korrekturen prüfbedürftig machen; diese MUST vor Veröffentlichung bestätigt oder ausdrücklich neu übersetzt werden. Maschinenjobs MUST manuelle Korrekturen erhalten. Speichern MUST Entwurf bleiben; ausdrückliches Veröffentlichen MUST Maschinenübersetzung und technische Prüfung starten, ohne obligatorische sprachliche Einzelabnahme. Die gemeinsame Aktivierung MUST Deutsch und alle kommunal angebotenen Zielsprachen umfassen; bei Teilfehler MUST der bisherige Satz aktiv bleiben, vorbehaltlich der expliziten Neuschlüssel-Ausnahme.

#### Scenario: Gleichzeitige Änderung oder unpassender Platzhalter

- **GIVEN** eine Redaktion veröffentlicht einen gesehenen Entwurf
- **WHEN** sich dessen Basis zwischenzeitlich geändert hat oder ein Pflichtplatzhalter fehlt
- **THEN** verweigert Studio die Veröffentlichung mit einem erklärbaren Konflikt beziehungsweise Validierungsfehler
- **AND** bleiben letzte bestätigte Veröffentlichung und bestehende App-Verträge erhalten

#### Scenario: Verzögerter Standardjob nach neuer globaler Bearbeitung

- **GIVEN** Standard S1 ist versiegelt veröffentlicht und ein kommunaler Auftrag auf S1 wartet
- **WHEN** die Redaktion S2 als unveröffentlichten globalen Entwurf speichert und der Auftrag nach Prozessabbruch wiederanläuft
- **THEN** verwendet er ausschließlich die unveränderlichen Standardwerte von S1 und die gepinnten veröffentlichten kommunalen Overrides
- **AND** bleibt S2 unveröffentlicht, ohne die gepinnte Standardbasis von S1 zu verändern

### Requirement: Reproduzierbarer lesender Buildexport

Das System MUST für App-Builds einen erfolgreich übertragenen und bestätigt aktivierten kommunalen Katalogsatz mit Deutsch und **allen kommunal angebotenen Zielsprachen** bereitstellen. Kommune, Satzrevision, enthaltene Sprachsnapshots, Vertrag, Kompatibilität und Prüfsummen MUST gepinnt sein. Buildexporte MUST ausschließlich lesend und frei von technischen Secrets sein. Bootstraptexte für Sprachwechsel, Fehler und Sprachsperren MUST aus derselben Quelle Bestandteil der vollständigen Kataloge sein; ein kleiner Bootstrap-Auszug allein MUST deren Bündelung nicht ersetzen. App-Buildskripte gehören nicht zu diesem Studio-Planungsauftrag.

#### Scenario: Zwei Builds verwenden denselben kommunalen Satz

- **GIVEN** derselbe App-Vertrag und bestätigte kommunale Katalogsatz sind gepinnt
- **WHEN** zwei berechtigte Exporte über die Main-Server-Auslieferung erfolgen
- **THEN** liefern sie bytegleiche Kataloge mit Deutsch und sämtlichen angebotenen kommunalen Sprachen
- **AND** werden falsche Kommune, inkompatibler Vertrag, fehlende Werte oder manipulierte Prüfsummen abgewiesen
- **AND** schreibt kein Export nach Studio

#### Scenario: Neue Schlüssel bei ausdrücklich bestätigtem App-Release

- **GIVEN** ein App-Release benötigt neue Schlüssel, deren deutsche Werte veröffentlicht sind, aber einzelne Übersetzungen fehlen
- **WHEN** die begrenzte Ausnahme ausdrücklich für diese Schlüssel und Zielsprachen bestätigt wird
- **THEN** darf ein neuer gepinnter Satz diese Werte vorübergehend gekennzeichnet auf Deutsch enthalten
- **AND** gilt dies weder für geänderte bestehende Schlüssel noch für Entwürfe oder Integritäts-/Platzhalterfehler
- **AND** erzeugt die spätere Übersetzung einen neuen Satz statt alte Artefakte umzuschreiben

### Requirement: Kontrollierter YAML-Katalogaustausch

Das System MUST YAML als berechtigtes Austauschformat derselben Studio-Katalogverwaltung unterstützen. Identische Schlüssel-, Typ-, Scope-, Revisions- und Platzhaltervalidierung MUST gelten; Import MUST einen überprüfbaren Entwurf erzeugen und darf keine Veröffentlichung oder redaktionelle Übersteuerung still überschreiben. Geräte und Builds MUST weiterhin JSON erhalten; PostgreSQL bleibt führend.

#### Scenario: YAML-Roundtrip und ungültiger Import

- **GIVEN** ein berechtigter Benutzer exportiert einen kommunalen Katalogentwurf als YAML
- **WHEN** derselbe Inhalt kontrolliert wieder importiert wird
- **THEN** bleiben Textwerte und Platzhalter semantisch erhalten
- **AND** werden unbekannte Schlüssel, unerlaubte Tags und überschrittene Parsergrenzen vor einer Änderung abgewiesen

### Requirement: Mandantengebundener dynamischer Batch- und Statusvertrag

Das System MUST freigegebene Textbatches ausschließlich nach Service- oder Sessionautorisierung im kanonischen Studio-Instanz-/Organisationsbereich verarbeiten. Pro Eintrag MUST `ready`, `pending`, `processing` oder `failed` zurückgegeben werden; nur `ready` darf Ergebnistext enthalten. Statusabfragen MUST dieselbe Autorisierung anwenden und dürfen keine fremden Einträge offenlegen. Der Request MUST nicht synchron auf den Anbieter warten. Profil-ID und Profilversion MUST serverseitig freigegeben sein und vor Speicherung/Jobanlage gegen die Bindung geprüft werden; ein bloßer Darstellungskontext ersetzt keine Profilprüfung. Deutsch MUST die einzige betrachtete Ausgangssprache sein; eine andere Quelle MUST vor Speicherung/Jobanlage abgewiesen werden. Die Zielsprache MUST aktuell kommunal angeboten sein. Profile MUST technische Auswahl-/Schutzregeln darstellen und dürfen keinen zusätzlichen Quellenfreigabeprozess pro Mandant oder Quelle einführen. Für App-Aufrufe MUST Main-Server aktuelle Originalherkunft, passende wertfreie Vorlage und Lesbarkeit vor jedem Studio-Abruf verifizieren. Die App-seitige Statuskorrelation MUST die geschützte Main-Server-Abholnummer verwenden. Der für die Studio-Formularanzeige benötigte Originalbezug MUST vor Umsetzung konkretisiert werden; Quellenangaben dürfen nicht pauschal aus Studio ausgeschlossen werden. Sie MUST weder in den Cache-Key eingehen noch einen dauerhaften Originalreferenz-/Verwendungsbestand begründen. Jede App-seitige Treffer-/Statusausgabe MUST zusätzlich die aktuelle Leseberechtigung für den zugeordneten Originalbezug prüfen. Eine bekannte Entry-ID oder gültige Kommune MUST diese Prüfung nicht ersetzen; nach Unsichtbarschaltung oder Zugriffsentzug MUST die Ausgabe über diesen Bezug unterbleiben, ohne den gespeicherten Treffer zu löschen.

#### Scenario: Unabhängige Einzelzustände und fremde Status-ID

- **GIVEN** ein Batch enthält einen vorhandenen Treffer und einen fehlenden erlaubten Text
- **WHEN** Studio ihn verarbeitet
- **THEN** erhält der erste Eintrag `ready` ohne Anbieteraufruf und der zweite einen persistenten ausstehenden Status
- **AND** liefert ein späterer Statusabruf aus einer anderen Organisation keine Texte oder Existenzbestätigung dieses Eintrags

#### Scenario: Unbekanntes oder nicht erlaubtes Anzeigeprofil

- **GIVEN** ein sonst gültiger Client sendet ein unbekanntes oder für ihn nicht freigegebenes Profil
- **WHEN** der Batch geprüft wird
- **THEN** entsteht weder ein gespeicherter Übersetzungseintrag noch ein Anbieterjob

#### Scenario: Originalzugriff zwischen Erstbatch und Statusabruf entzogen

- **GIVEN** ein sichtbarer Artikel erzeugt einen zulässigen Übersetzungsauftrag mit Entry-ID
- **WHEN** er vor einem späteren Treffer-/Statusabruf unsichtbar wird oder der App-Aufrufer seine Leseberechtigung verliert
- **THEN** liefert der Main-Server über diesen Originalbezug keinen Übersetzungstext aus
- **AND** bleibt der Cache erhalten und ein Zugriff über einen anderen aktuell lesbaren Originalbezug desselben Texts weiterhin möglich

### Requirement: Exakte generische Deduplizierung je verifiziertem Bereich

Das System MUST den Cache-Key selbst aus der versionierten eindeutig serialisierten Folge von Quellsprache, Zielsprache, stabilem Kontext, Format und exaktem Ausgangstext berechnen. Der persistente Unique-Key MUST Instanz und Organisation zusätzlich abgrenzen. Geräte-, Seiten-, Batch-, Ressourcen-, App-Versions- und Anbieteridentität MUST nicht den fachlich gleichen Text vervielfachen. Textbytes MUST vor Hashbildung nicht beliebig normalisiert werden.

#### Scenario: Konkurrenz, Textänderung und Anbieterwechsel

- **GIVEN** zwei Geräte fordern gleichzeitig denselben Text im selben Bereich an
- **WHEN** Studio die Anfragen persistiert
- **THEN** entsteht genau ein fachlicher Cacheeintrag und ein wirksamer Verarbeitungsauftrag
- **AND** erzeugt geänderter Text einen anderen Eintrag, ohne den alten geteilten Treffer zu überschreiben
- **AND** bleibt ein fertiges Ergebnis nach Anbieterwechsel wiederverwendbar
- **AND** verwendet eine andere Kommune keinen Eintrag aus dem ersten Bereich

### Requirement: Wiederanlauf mit bestehender Studio-Jobinfrastruktur

Das System MUST die vorhandene zentrale PostgreSQL-/Graphile-Jobinfrastruktur verwenden und Miss-Anlage, Jobübergabe und Recovery gegen verlorene Aufträge absichern. Verarbeitung MUST atomar mit begrenzter Lease übernommen werden; ausschließlich deren aktuelle Generation darf Ergebnisse oder Fehler speichern. Anbieteraufrufe MUST außerhalb offener DB-Transaktionen stattfinden. Retry-, Zeit-, Zeichen-, Auftrags-, Rate- und Parallelitätslimits MUST vor Aktivierung technisch begrenzt sein. V1 MUST keine kommunale monetäre Budgetsperre oder zusätzliche Budgetfreigabeoberfläche einführen; ausreichendes Budget ist eine Produktannahme. Kostenbeobachtung und technische Anbieterfehlerbehandlung MUST bestehen bleiben.

#### Scenario: Abbruch vor Enqueue und verspäteter Worker

- **GIVEN** ein Pending-Eintrag wurde angelegt und die Jobübergabe schlägt fehl oder ein Worker fällt aus
- **WHEN** die Recovery fällige Einträge beziehungsweise abgelaufene Leases prüft
- **THEN** wird derselbe Eintrag kontrolliert erneut beauftragt beziehungsweise übernommen
- **AND** kann ein verspäteter alter Worker das neuere Ergebnis nicht überschreiben
- **AND** führt ein ausgeschöpftes Retrybudget zu einem erklärbaren Fehler statt zu unendlichen Jobs

### Requirement: Geschützte Textformate und beschränkte Originale

Das System MUST alle zulässigen App-Anzeigetexte/-vorlagen über explizite technische Profile abdecken, einschließlich eingebundener Quellen und öffentlicher redaktioneller Texte mit enthaltenen Personennamen. Die kommunale Mehrsprachigkeitsvereinbarung MUST als Zustimmung für eingebundene Inhalte zugrunde gelegt werden; ein zusätzlicher technischer Freigabeprozess pro Mandant oder Quelle MUST entfallen. Private Nutzerdaten, aufgelöste persönliche Anreden, direkte Freitexteingaben, externe Webseiten hinter Links und technische Werte MUST ausgeschlossen bleiben. HTML MUST strukturerhaltend über freigegebene Textknoten/Attribute verarbeitet werden; Platzhalter, Links und technische Attribute MUST geschützt und Ergebnisstruktur geprüft werden. Ein Anbieter-HTML-Flag allein MUST nicht als Nachweis gelten. Beliebige JSON-Blätter MUST nicht pauschal übersetzt werden. Persönliche Platzhalterwerte MUST bereits vor Studio-Request, Hashbildung und Persistenz ausgeschlossen bleiben; Studio verarbeitet nur freigegebene Vorlagen mit stabilen Tokens, die lokal aufgelöst werden.

#### Scenario: Anbieter verändert Link oder Platzhalter

- **GIVEN** ein freigegebenes HTML-Segment enthält einen Link und geschützte Tokens
- **WHEN** der Anbieter Linkziel, Struktur oder Tokenzuordnung unzulässig verändert
- **THEN** verwirft Studio das Ergebnis und markiert keinen auslieferbaren `ready`-Treffer
- **AND** gelangen weder persönliche Tokenwerte noch Original-/Ergebnistexte in allgemeine Jobpayloads oder Logs

#### Scenario: Persönliche Werte bleiben vor der Speicherung lokal

- **GIVEN** zwei Geräte verwenden dieselbe erlaubte Vorlage `Hallo {{name}}` mit unterschiedlichen persönlichen Werten
- **WHEN** sie über den Main-Server Übersetzung anfordern
- **THEN** empfängt und speichert Studio ausschließlich dieselbe wertfreie Vorlage
- **AND** erzeugen die unterschiedlichen persönlichen Werte keinen anderen Cache-Key und verlassen das Gerät nicht
- **AND** findet eine spätere lokale Auflösung erst nach geprüfter Übersetzung statt

### Requirement: Bestehende App-Ressourcenverträge und Originalveröffentlichung erhalten

Das System MUST dynamische Textbatches bedienen, ohne sämtliche Ressourcen-GraphQL-Abfragen, Original-Caches oder Pagination neu zu gestalten. Originale MUST ohne fertige Übersetzung speicher-, importier- und veröffentlichbar bleiben. Eine spätere redaktionelle Sprachfassung MUST an die Originalversion und eine explizite Freigabe gebunden sein und darf nicht von Maschinenjobs überschrieben werden.

#### Scenario: Übersetzung ist ausstehend und Original wird geändert

- **GIVEN** eine News wird ohne fertige Übersetzung veröffentlicht und später geändert
- **WHEN** eine frühere Maschinenantwort oder redaktionelle Sprachfassung noch vorhanden ist
- **THEN** blockiert dies die Originalveröffentlichung nicht
- **AND** wird die alte Sprachfassung nicht als Ergebnis für den geänderten Text ausgegeben
- **AND** bleiben Original-IDs, Datenpagination, URLs und technische Aktionen unverändert

### Requirement: Zugängliche Katalogpflege und kontrollierte LTR-Aktivierung

Das System MUST bei Katalogpflege Standard/Override je Sprache, tatsächliche Übersetzungsquelle, Entwurf/Veröffentlichung, manuelle Korrektur/Prüffälligkeit, Platzhalter und Übertragungsfehler verständlich unterscheiden und vorhandenes Design-System, Tastatur/Fokus und de/en-Host-i18n verwenden. Die zentrale LTR-Liste MUST Deutsch sowie Englisch, Ukrainisch, Spanisch, Italienisch, Portugiesisch aus Portugal, Griechisch, Koreanisch, Indonesisch, vereinfachtes Chinesisch, Japanisch, Thailändisch, Türkisch, Polnisch, Dänisch, Schwedisch, Finnisch, Russisch, Lettisch und Rumänisch umfassen. Jede Kommune MUST daraus selbst auswählen können; Magdeburg MUST alle 19 Zielsprachen im ersten Pilot erhalten. Erweiterungen MUST zentral geprüft werden. Aktivierung MUST nachgewiesene DeepL-Abdeckung, technische Darstellung und Datenschutz-/Haftungshinweise berücksichtigen, ohne eine beschlossene Pilotzielsprache still zu entfernen.

#### Scenario: Kommunale Auswahl und noch nicht nachgewiesene Anbieterabdeckung

- **GIVEN** Magdeburg bietet alle 19 Zielsprachen an, eine andere Kommune nur Englisch
- **WHEN** ein kommunaler Katalogsatz vorbereitet wird
- **THEN** umfasst er genau die angebotenen Sprachen dieser Kommune samt Deutsch
- **AND** bleibt eine nicht nachgewiesene Pilotsprachenabdeckung eine offene Lieferabhängigkeit statt einer stillen Reduktion
- **AND** gehören RTL und ein Original-anzeigen-Button je Element nicht zu V1

### Requirement: Ein zentraler DeepL-Anbieter für beide Textstrecken

Das System MUST zunächst einen zentral betriebenen DeepL-Zugang für feste Kataloge und dynamische Inhalte verwenden. Gemeinsame feste Standards MUST einmal zentral übersetzt werden; kommunale Overrides MUST eigene Übersetzungen erhalten können. Dynamische Treffer MUST kommunal getrennt bleiben. Die öffentlich dokumentierte Sprachliste MUST von tatsächlicher Konto-/Featureabdeckung unterschieden werden. Vor Aktivierung MUST die aktuelle Sprach-/Featureabfrage für Textübersetzung geprüft und `en` bewusst einer Anbieterzielvariante zugeordnet werden; eine SDK-Konstante allein genügt nicht als Kontonachweis. Optionale Tag-/Glossar-/Formalitätsfähigkeiten MUST nicht aus bloßer Sprachverfügbarkeit abgeleitet werden. Anbieter-Secrets MUST serverseitig bleiben; kommunale Anbieterwahl, SSF-Adapter und Provider-Registry MUST nicht vorsorglich eingeführt werden. Manuelle Korrekturen MUST in der ersten Auslieferung auf feste Kataloge beschränkt bleiben; dynamische Korrekturworkflows MUST später separat geliefert werden.

#### Scenario: Derselbe Standard und derselbe dynamische Text in zwei Kommunen

- **GIVEN** zwei Kommunen verwenden denselben festen Standard und identische dynamische Texte
- **WHEN** Übersetzungen benötigt werden
- **THEN** übernehmen beide den einmal übersetzten festen Standard
- **AND** teilen ihre dynamischen Texte keinen kommunalen Cacheeintrag
- **AND** bleibt eine manuelle feste Korrektur vor Maschinenjobs geschützt

### Requirement: Sprachbezogene Overrides und automatische Standardübernahme

Overrides MUST je Kommune, Schlüssel und Sprache gelten. Ohne eigenen Override MUST die Sprachfassung dem gemeinsamen Standard folgen, auch bei abweichendem kommunalen Deutsch. Weitere kommunale Sprach-Overrides MUST ausschließlich durch gezielte Bearbeitung beziehungsweise ausdrückliche Übernahmeaktion entstehen. Veröffentlichte Standardänderungen MUST automatisch neue kommunale Sätze aus zuletzt veröffentlichten Overrides erzeugen, ohne zusätzliche kommunale Freigabe. Unveröffentlichte kommunale Entwürfe und manuelle Korrekturen MUST erhalten bleiben und dürfen nicht still veröffentlicht oder ersetzt werden. Snapshot- und Konfliktregeln MUST auch für automatische Aufträge gelten.

#### Scenario: Deutscher Override und fremdsprachiger Standard

- **GIVEN** nur Deutsch besitzt einen kommunalen Override für einen Schlüssel
- **WHEN** ein neuer Standardstand übernommen wird
- **THEN** bleibt der deutsche Override erhalten und folgen die anderen Sprachen ihren jeweiligen Standards
- **AND** erzeugt erst die ausdrückliche Übernahmeaktion weitere Sprach-Overrides ohne ungefragtes Ersetzen manueller Korrekturen

#### Scenario: Automatischer Standardjob bei offenem Kommunalentwurf

- **GIVEN** die Kommune hat veröffentlichte Overrides und einen unveröffentlichten Entwurf
- **WHEN** ein neuer Standard veröffentlicht wird
- **THEN** entsteht automatisch ein neuer vollständiger Satz mit den veröffentlichten Overrides
- **AND** bleibt der Entwurf unveröffentlicht erhalten und wird vor seiner späteren Veröffentlichung auf Konflikte geprüft

### Requirement: Dynamische Anzeige je Inhaltseintrag mit begrenztem Warten

Die App MUST dynamische Übersetzungen beim Anzeigen anfordern und Treffer wiederverwenden. Alle sichtbaren Textfelder eines Inhaltseintrags MUST gemeinsam in der Zielsprache oder gemeinsam deutsch erscheinen; andere Einträge dürfen unabhängig fertig werden. Bei Miss MUST die Wartezeit je Eintrag auf fünf Sekunden ab Anzeige/Anforderung begrenzt sein. Fehler MUST sofort, Timeout spätestens nach fünf Sekunden zum deutschen Original führen, das für diese geöffnete Ansicht bestehen bleibt. Verspätete Ergebnisse MUST keinen bereits deutsch angezeigten Inhalt austauschen. Offline MUST sofort vollständige lokale Übersetzung oder Deutsch erscheinen. Ein dezenter zugänglicher Hinweis MUST je Ansicht in der gewählten Sprache deutsche Rückfälle erklären; Dialoge/Marker je Inhalt MUST entfallen. Sprachkennzeichnung und Screenreader-/Vorlesesprache MUST der tatsächlichen Textsprache folgen: deutsche Rückfallinhalte und erlaubte deutsche Ersatzwerte neuer fester Schlüssel als `de`, übrige Oberfläche und Hinweis in der gewählten Sprache. Vorhandene Ausgabe-/Accessibility-Mittel MUST genügen; eine neue Metadateninfrastruktur ist dafür nicht erforderlich.

#### Scenario: Teilantwort und spätes Ergebnis

- **GIVEN** ein Eintrag benötigt Titel und Beschreibung, aber nur der Titel ist übersetzt
- **WHEN** nach fünf Sekunden die Beschreibung noch fehlt
- **THEN** erscheint der ganze Eintrag deutsch mit einem dezenten Hinweis für die Ansicht
- **AND** ersetzt eine verspätete vollständige Übersetzung ihn erst bei einem späteren Aufruf

#### Scenario: Offline und unterschiedliche Einträge

- **GIVEN** das Gerät ist offline und besitzt nur für einen von zwei sichtbaren Einträgen eine vollständige passende Übersetzung
- **WHEN** die Ansicht geöffnet wird
- **THEN** erscheint dieser Eintrag sofort übersetzt und der andere sofort deutsch ohne Ladefrist
- **AND** ist der Rückfallhinweis nur einmal pro Ansicht nötig

#### Scenario: Deutsche Textteile in ukrainischer Ansicht vorlesen

- **GIVEN** Ukrainisch ist gewählt und ein dynamischer Eintrag fällt auf Deutsch zurück oder ein neuer fester Schlüssel enthält einen bestätigten deutschen Ersatzwert
- **WHEN** Screenreader oder Vorlesefunktion diese Textteile ausgeben
- **THEN** sind sie als Deutsch gekennzeichnet und werden mit deutscher Sprache ausgegeben
- **AND** behalten ukrainische Oberfläche und Rückfallhinweis ihre ukrainische Sprachkennzeichnung

### Requirement: Lokale Sprachwahl und vollständige Katalogdownloads

Die Sprachwahl MUST lokal auf dem Gerät ohne Anmeldung oder Kontosynchronisierung gespeichert werden. Beim Erststart MUST eine kommunal angebotene gebündelte Gerätesprache verwendet werden, andernfalls Deutsch. Zusätzliche Sprachen MUST auch in installierten Apps erst nach vollständigem kompatiblem und geprüftem Katalogdownload nutzbar werden. Während des Downloads MUST die bisherige Sprache aktiv bleiben; bei Fehler MUST sie mit Fehlermeldung erhalten bleiben. Gebündelte oder gültig lokal gespeicherte Sprachen MUST bei ausdrücklicher Auswahl sofort wirken. Automatische Katalogupdates MUST erst beim nächsten Öffnen einer Ansicht angewandt werden; bewusster Sprachwechsel MUST nach Verfügbarkeit sofort wirken.

#### Scenario: Downloadfehler und späterer Katalogupdate

- **GIVEN** die bisherige Sprache ist weiter angeboten, eine neu gewählte Sprache aber noch nicht vollständig lokal vorhanden
- **WHEN** ihr Download fehlschlägt
- **THEN** bleiben bisherige Sprache und Auswahl erhalten und erscheint eine Fehlermeldung
- **AND** verändert ein später geladenes automatisches Katalogupdate keine bereits geöffnete Ansicht

### Requirement: Deaktivierte kommunale Sprache vollständig sperren

Nach erkanntem Konfigurationsabgleich MUST eine deaktivierte Sprache aus neuer Auswahl und regulärer Nutzung gesperrt werden, auch für bisherige Nutzer. Betroffene Nutzer MUST einen verständlichen zugänglichen Dialog noch in der bisherigen Sprache erhalten und eine angebotene Sprache verpflichtend bestätigen; Deutsch MUST vorausgewählt und gebündelt verfügbar sein. Bei Downloadfehler MUST die Auswahl geöffnet bleiben und Deutsch sofort anbieten. Die gesperrte Sprache MUST nicht als regulärer Rückfall weiterverwendet oder durch neue dynamische Requests versorgt werden. Eine offline noch unbekannte Sperre kann erst beim nächsten erfolgreichen Abgleich wirksam werden.

#### Scenario: Gesperrte aktuelle Sprache und fehlgeschlagener Wechsel

- **GIVEN** die App erfährt, dass ihre aktuelle Sprache deaktiviert ist
- **WHEN** der Download einer neu gewählten angebotenen Sprache scheitert
- **THEN** bleibt die verpflichtende Sprachwahl offen und kann Deutsch ohne Download bestätigt werden
- **AND** führt kein Abbrechen zum regulären Inhalt in der gesperrten Sprache zurück

### Requirement: Dynamischer Cache nach 90 Tagen ohne serverseitige Nutzung bereinigen

Studio MUST pro fertiger dynamischer Übersetzung `last_used_at` bei erfolgreicher Fertigstellung nach eigener Serveruhr initialisieren und bei autorisierten App-Anfragen mit zurückgeliefertem Ready-Ergebnis aktualisieren. Das MUST Batch-Treffer und fertige Statusantworten umfassen, ausschließlich für die ausgegebene Sprachfassung. Abruf MUST als Nutzung gelten, ohne Lesen oder Empfang zu behaupten. Abgewiesene Anfragen, reine Pending-/Processing-Polls, Worker-, Formular-/Vorschau-/Wartungs-/Hintergrundzugriffe und lokale/Offline-App-Nutzung MUST die Frist nicht verlängern. Geräte-/Benutzerhistorie, Empfangsbestätigung und Nutzungs-Heartbeats MUST entfallen.

Ein täglicher zentraler Studio-Job MUST fertige Einträge nach mindestens 90 Tagen seit `last_used_at` bereinigen. Frist und Zustand MUST unmittelbar bei Löschung atomar erneut geprüft werden, sodass ein inzwischen autorisierter Abruf schützt. Aktive Jobs/Leases MUST ausgenommen bleiben. Verspätete Worker MUST ausschließlich bestehende Entry-ID mit gültiger Lease aktualisieren und dürfen gelöschte Ergebnisse nicht per Upsert wiederherstellen. Laufende/fehlgeschlagene Jobs MUST getrennte begrenzte Retry-/Recoveryregeln behalten. Jobausfall darf längere Ablage verursachen; eine sekundengenaue Löschzusage MUST entfallen.

Diese Regel MUST für alle dynamischen Inhalte einschließlich Bus gelten. Änderung, Unsichtbarschaltung und Löschung von Originalen dürfen alte Treffer bis zur normalen Bereinigung erhalten; Verwendungsprüfung/-zählung, Originalregister, zusätzlicher Textgruppenindex, Bestands-/Änderungsprotokoll und Sync-Gates MUST entfallen. Spätere aktuell berechtigte Anfragen MUST bereinigte Texte neu übersetzen dürfen; lokale gültige Übersetzungen dürfen ohne zusätzliche Gerätelöschung bleiben. Seltene Abrufe können erneut Anbieteraufwand verursachen. Feste Katalogrevisionen, Standards/Overrides, Backups und Logs MUST von dieser allgemeinen Frist ausgenommen bleiben; besondere Aufbewahrungs-/Löschpflichten MUST getrennt behandelt werden.

#### Scenario: Fertigstellung und autorisierte fertige Antworten

- **WHEN** eine Übersetzung erfolgreich fertiggestellt und später per autorisierter App-Batch- oder Statusantwort abgerufen wird
- **THEN** initialisiert beziehungsweise aktualisiert Studio `last_used_at` nach eigener Serveruhr
- **AND** verlängert nur die zurückgelieferte Sprachfassung ihre Frist, unabhängig vom tatsächlichen Lesen in der App

#### Scenario: Kein Nutzungs-Touch ohne fertige App-Ausgabe

- **WHEN** ein Zugriff abgewiesen wird, nur pending/processing zurückliefert oder als Worker-/Wartungs-/Hintergrundprüfung erfolgt
- **THEN** verlängert er die Frist nicht
- **AND** verlängert auch rein lokale/Offline-Nutzung sie nicht und entsteht kein Nutzungs-Heartbeat

#### Scenario: Täglicher Lauf und 90-Tage-Grenze

- **GIVEN** fertige Einträge liegen vor, genau auf und nach der 90-Tage-Grenze ohne aktive Jobs/Leases
- **WHEN** der tägliche Bereinigungsjob läuft, ausfällt und später wiederholt wird
- **THEN** entfernt er nur mindestens 90 Tage ungenutzte Einträge und holt nach Ausfall fällige Bereinigung nach
- **AND** löst Änderung, Unsichtbarschaltung oder Löschung eines Originals keine gesonderte Cachelöschung aus
- **AND** bleiben feste Kataloge, Standards/Overrides und die getrennten Backup-/Logregeln unberührt

#### Scenario: Abruf gegen Bereinigung und verspäteter Worker

- **WHEN** ein Ready-Abruf den Nutzungszeitpunkt vor der atomaren Löschprüfung erneuert oder eine aktive Lease besteht
- **THEN** entfernt die Bereinigung den Eintrag nicht
- **AND** kann ein verspäteter Worker einen tatsächlich bereits gelöschten Eintrag weder wiederherstellen noch eine neu angelegte Entry-ID überschreiben

#### Scenario: Erneute Anzeige nach Bereinigung

- **GIVEN** ein dynamischer Treffer wurde nach 90 Tagen ohne Serverabruf bereinigt
- **WHEN** ein aktuell berechtigter Submit dieselbe Vorlage anfordert
- **THEN** darf Studio einen neuen Eintrag und deduplizierten Auftrag anlegen
- **AND** erzeugt ein bloßer Statusabruf keinen Auftrag
- **AND** bleiben lokale gültige Ergebnisse ohne zusätzliche Gerätelöschfunktion nutzbar

### Requirement: Mehrsprachigkeit als optionales Tenant-Plugin

Das System MUST Mehrsprachigkeit unter Plugin-ID `app-translations` über die vorhandene Plugininstallation, optionale instanzweite Modulaktivierung, Modul-IAM und Tenant-Lifecycle bereitstellen. Installation oder ein IAM-Grant allein MUST keinen Fachzugriff erlauben. Kataloge und kommunale Sprachwahl MUST zusätzlich organisationsgebunden bleiben; ein zweites Aktivierungsregister je Organisation MUST entfallen. Die interne Katalogbasis A MUST vor nutzbarer Fachfreigabe um die vorhandenen hostseitigen Pluginzugangsprüfungen ergänzt werden. Globale Standards/Manifestpflege und eng begrenzte Deutsch-/Cachewartung MUST mit eigenem berechtigtem Hostkontext möglich bleiben, ohne damit kommunale Übersetzungen freizuschalten.

#### Scenario: Gleiche Instanz mit mehreren Organisationen

- **GIVEN** das Modul ist für eine Instanz aktiviert und zwei Organisationen haben unterschiedliche Sprachwünsche
- **WHEN** ein Benutzer den Katalogeditor öffnet oder der Service eine Übersetzung anfordert
- **THEN** gelten gemeinsamer instanzweiter Pluginzugang und zusätzliche Rechte/Sprachauswahl der jeweils verifizierten Organisation
- **AND** erlaubt ein fremder Organisationskontext keinen Zugriff auf deren Daten

### Requirement: Modulabschaltung erhält Daten und beendet Fremdsprachennutzung

Das System MUST reguläre Deaktivierung über den bestehenden `suspend`-Lifecycle vor vollständiger Modulabwahl durchführen. Beginnende Suspendierung MUST normale kommunale Schreib-, Batch-/Statuszugriffe einschließlich fertiger Treffer, neue Anbieteraufträge und Standardübernahme sperren. Der begrenzte Lifecycle-Kontrollauftrag MUST ohne DeepL für jede gebundene Organisation sämtliche weiterhin ausgelieferten aktiven App-Vertragsindizes berücksichtigen und pro Vertrag einen vollständigen Deutsch-only-Satz aus gültiger kompatibler deutscher Basis übertragen und bestätigen. Die Vertragsmenge MUST aus dem bestehenden Release-/Indexbestand kommen, ohne zusätzliches Vertragsregister. Ohne aktiven Satz für einen Vertrag MUST dessen App bei gebündeltem Deutsch bleiben. Vollständige Remoteabschaltung MUST erst nach Read-back aller betroffenen Vertragsindizes gemeldet werden. Teilfehler MUST sichtbar wiederholbar bleiben; direkte administrative Modulabwahl MUST lokal sicher sperren und ausstehende Remoteangleichung als Recoverybedarf ausweisen, ohne allgemeinen Worker-Bypass.

Entwürfe, Overrides und unveränderliche Kataloge MUST erhalten bleiben; dynamische Treffer MUST weiter ihrer bestehenden 90-Tage-Bereinigung unterliegen. Verweigerte Zugriffe MUST keinen Nutzungszeitpunkt verlängern. Bereits gestartete Anbieteraufrufe können nicht rückwirkend verhindert werden, aber verspätete Ergebnisse oder Publikationsjobs MUST die Sperre nicht aufheben. Reaktivierung MUST aktuelle Bereitschaft prüfen, konfigurierte Sprachwünsche/Daten erhalten und nötigenfalls je weiterhin unterstütztem App-Vertrag einen neuen vollständigen kompatiblen bestätigten Satz verwenden; sie MUST keine Entwürfe automatisch veröffentlichen. Ein vorübergehender Anbieterausfall MUST bestehende gültige Kataloge nicht als fachlich deaktiviert behandeln.

Die vorhandenen Hostübergänge MUST im lokalen Pluginanschluss gezielt angepasst werden: Modulabwahl nach bestätigter Suspendierung MUST keinen neuen Pending-Suspendauftrag erzeugen; Wiederzuordnung MUST den Zustand bis zur bestätigten Reaktivierung suspendiert halten und dadurch die bestehende Orchestrator-Vorbedingung erfüllen. Eine zweite Zustandsmaschine oder ein allgemeiner Worker-Bypass MUST entfallen. Der lokale Pluginabschnitt MUST ohne fertigen Publisher nachweisbar bleiben; Remote-Lifecycle und Appwirkung MUST erst mit Publikations-/Appabschnitt integriert abgenommen werden. Vor vollständiger integrierter Abnahme MUST die Produktfreigabe ausbleiben.

#### Scenario: Abwahl nach abgeschlossener Suspendierung

- **GIVEN** Suspendierung und im integrierten Produkt alle Remote-Read-backs sind bestätigt abgeschlossen
- **WHEN** die optionale Modulzuordnung anschließend entfernt wird
- **THEN** bleibt die abgeschlossene Suspendierung erhalten, ohne neuen Pendingauftrag oder zusätzliche Suspendgeneration
- **AND** benötigt der deaktivierte Worker keinen Ausführungsbypass

#### Scenario: Wiederzuordnung eines suspendierten Moduls

- **GIVEN** ein Modul wurde suspendiert und danach abgewählt
- **WHEN** es berechtigt erneut zugeordnet wird
- **THEN** bleibt sein Lifecyclezustand bis zur bestätigten Reaktivierung suspendiert und der bestehende Orchestrator kann `reactivate` ausführen
- **AND** werden normale Fachzugriffe nicht vor bestätigtem Abschluss freigegeben

#### Scenario: Abschaltung mit zwei weiterhin ausgelieferten App-Verträgen

- **GIVEN** zwei App-Verträge derselben Organisation besitzen aktive Fremdsprachenkataloge
- **WHEN** Mehrsprachigkeit deaktiviert wird und nur ein Vertragsindex erfolgreich auf Deutsch-only wechselt
- **THEN** bleibt der Gesamtabschluss ausstehend, bis beide Vertragsindizes bestätigt Deutsch-only sind
- **AND** gilt nach Reaktivierung für jeden weiterhin unterstützten Vertrag ein neuer kompatibler vollständiger Satz statt Rückwärtsaktivierung

#### Scenario: Abschaltung und unerreichbarer Main-Server

- **WHEN** die Suspendierung lokal begonnen hat und der Deutsch-only-Transfer fehlschlägt
- **THEN** verweigert Studio normale kommunale Übersetzungszugriffe und meldet Remoteabschaltung als ausstehend
- **AND** bleibt der bestehende Lifecycleauftrag sicher wiederholbar, ohne Fremdsprachen neu zu übersetzen oder vorhandene Daten zu löschen
- **AND** wird keine sofortige Abschaltung auf offline oder noch nicht abgeglichenen Geräten behauptet

#### Scenario: App erkennt Modulabschaltung und spätere Reaktivierung

- **WHEN** die App den bestätigten Deutsch-only-Satz erkennt
- **THEN** verwendet sie bei bisheriger Fremdsprache den bestehenden verpflichtenden Sprachsperrdialog in der bisherigen Sprache mit Deutsch als einziger vorausgewählter Option
- **AND** nutzt sie danach keine gespeicherte Fremdsprache regulär weiter
- **AND** werden nach Reaktivierung Fremdsprachen erst durch einen neuen bestätigten vollständigen Satz wieder angeboten

### Requirement: Anbieterzugänge verwenden vorhandene Host-Secretpfade

Das System MUST zum Start denselben zentralen DeepL-Zugang je Environment für feste und dynamische Texte aus dem vorhandenen serverseitigen Runtime-Secretpfad beziehen. Pluginoberflächen MUST lediglich redigierten Konfigurations-/Prüfstatus erhalten; Keys/Ciphertexts MUST nicht in Browserantworten, App-Builds, Jobpayloads oder Logs erscheinen. Fehlende/unlesbare Secrets MUST neue Anbieteraufrufe sicher verhindern. Rotation MUST vorhandene gültige Übersetzungen/Kataloge erhalten und MUST keine Anbieteridentität im dynamischen Cache-Key erfordern.

Spätere eigene Mandantenschlüssel oder zusätzliche Anbieter MUST bei gesonderter Beauftragung den bestehenden hostseitigen Schnittstellenkatalog, instanzgebundene Resolver und datensatzgebundene Secretverschlüsselung erweitern. Diese Verträge MUST nicht als bereits vorhandene globale Plattform-Keyverwaltung oder organisationsweise Zugangsauswahl ausgegeben werden. V1 MUST ohne kommunale Providerwahl, zweite Secretablage oder vorsorgliche Provider-Registry auskommen.

#### Scenario: Key fehlt oder wird rotiert

- **WHEN** der zentrale Zugang fehlt, unlesbar ist oder berechtigt rotiert wird
- **THEN** gibt die Oberfläche ausschließlich sicheren Status aus und verwendet keinen fremden Mandantenzugang als Fallback
- **AND** bleiben vorhandene gültige Kataloge und autorisiert nutzbare fertige Übersetzungen erhalten
- **AND** lösen fehlende Secrets keine Datenlöschung oder automatische Sprachabschaltung aus

### Requirement: Dynamischen Übersetzungsstatus und Sprachfassungen im Inhaltsformular anzeigen

Studio MUST als Hauptakteur der Übersetzungsverwaltung im jeweiligen Inhaltsformular den Status und fertige Sprachfassungen dynamischer Inhalte anzeigen. Diese Leseanzeige MUST von späterer manueller dynamischer Korrektur getrennt bleiben. Die konkrete Übermittlung und mögliche Speicherung des benötigten Originalbezugs MUST vor Implementierung abgestimmt werden; ein pauschaler Ausschluss von Originalbezug aus Studio MUST entfallen. Die Anzeige MUST aktuellen Organisations-/Pluginzugang und redaktionellen Inhaltszugriff serverseitig prüfen und darf alte Texte nicht als passende aktuelle Übersetzung ausgeben. Sie MUST keinen dauerhaften Originalreferenzbestand, Änderungs-/Verwendungsabgleich oder Übersetzungskopien in Originaldatensätzen einführen. Formular-/Vorschauabrufe MUST die 90-Tage-Frist nicht verlängern.

Ein gemeinsamer Reiter „Übersetzungen“, konkrete Statusbeschriftungen, Laden erst beim tatsächlichen Öffnen, Hinweis bei ungespeicherten Textänderungen und ein reiner Cache-Leseweg ohne Jobanlage sind Empfehlungen aus Design 6.1, noch keine bestätigten UI-/API-Details. Ein Knopf zum Anfordern fehlender Übersetzungen ist nicht entschieden; diese Leseanforderung MUST weder eine solche Aktion noch automatische Übersetzung beim Speichern oder dynamische Korrekturrechte voraussetzen.

#### Scenario: Formular zeigt passende vorhandene Sprachfassungen

- **GIVEN** ein berechtigter Redakteur öffnet einen gespeicherten Inhalt bei aktivem Mehrsprachigkeitsmodul
- **WHEN** die geplante Formularanzeige Übersetzungsstatus und fertige Sprachfassungen liest
- **THEN** beziehen sich ausgegebene Fassungen auf die aktuell geprüfte Vorlage, dieselben Übersetzungsprofile/Kontexte und die richtige Organisation
- **AND** verlängert dieser Formularabruf `last_used_at` nicht und eröffnet keine manuelle dynamische Korrektur

#### Scenario: Originalstand oder Inhaltszugriff geändert

- **WHEN** die gespeicherte übersetzbare Vorlage oder der redaktionelle Inhaltszugriff wechselt
- **THEN** gibt die Formularanzeige keine nicht mehr passende oder nicht mehr berechtigte Sprachfassung als aktuell aus
- **AND** wird die konkrete sichere Neuabfrage/-zuordnung vor Implementierung festgelegt, ohne neue Quellreferenztabelle
