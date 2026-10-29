## ADDED Requirements

### Requirement: Zentrale Studio-Quelle für feste und dynamische App-Übersetzungen

Das System MUST feste App-Kataloge einschließlich Deutsch, gemeinsame Standards und kommunale Overrides zentral im Studio-Backend/PostgreSQL führen. Dynamische Ergebnisse MUST ausschließlich im Main-Server in MySQL liegen; Studio MUST den authentifizierten Übersetzungsdienst liefern und darf keinen dauerhaften zweiten dynamischen Inhaltsbestand führen. Der Main-Server MUST für feste Kataloge ausschließlich Auslieferungsreplik sein. Host-i18n und SSF-Konfigurationssprachen MUST getrennte Verantwortlichkeiten behalten. Die erste Produktauslieferung MUST feste und dynamische Strecken gemeinsam und sämtliche zulässigen Anzeigetexte unabhängig vom Inhaltstyp abdecken. Magdeburg MUST als erste Pilotkommune alle 19 benannten Zielsprachen erhalten; andere Kommunen MUST ihre Auswahl aus den stabilen Zielsprachen ihrer geprüften instanzgebundenen DeepL-Schnittstelle selbst bestimmen können. Das System MUST alle solchen Zielsprachen anbieten, ohne Begrenzung auf den Pilotumfang. Je Sprachstamm MUST genau eine Variante auswählbar sein; zusätzliche Varianten MUST nach Auswahl der Sprache in derselben Zeile angeboten und mit ihrer exakten Kennung gespeichert werden. Bestehendes englisches Katalogformat MUST kompatibel bleiben.

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

Das System MUST globale Standardpflege im bestehenden Root-/Plattformpfad und deutsche kommunale Hostpflege ohne Modul sowie fremdsprachige Katalogpflege im optionalen Modul „Mehrsprachigkeit“ über dieselbe lokale Katalogbasis ermöglichen. Kommunale Fremdsprachenzugriffe, Änderungen und lokale Versiegelung MUST die getrennten Rechte `app-translations.catalog.read`, `app-translations.catalog.write` und `app-translations.catalog.publish` sowie den bestehenden Modul-/Organisationsscope prüfen. Globale Entwürfe und technischer JSON-Manifestimport MUST dem verifizierten Root-Kontext vorbehalten bleiben. Der Editor MUST Entwurf, sprachbezogene Vererbung/Overrides, Platzhalter, Korrekturstatus und Revisionskonflikte verständlich darstellen. „Textstand sichern“ MUST ausschließlich einen vollständigen unveränderlichen lokalen Satz erzeugen; die Vorschau MUST ihn von einer App-Veröffentlichung unterscheiden. Ein synthetischer Deutsch-/Englisch-Testkatalog MUST ausschließlich kontrollierter lokaler Erprobung dienen, ohne automatische Seeds realer Mandanten, Fake-Übersetzungen oder zweite produktive App-Textquelle.

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

### Requirement: Manueller mehrsprachiger texts.js-Download aus lokalen Textständen

Das System MUST einen explizit gewählten gesicherten kommunalen Textstand als eine gemeinsame `texts.js` mit Deutsch und allen in diesem Stand gespeicherten Sprachfassungen herunterladen lassen. Das Modul MUST einen benannten Export `textsByLocale` mit vollständiger bisheriger Schlüsselstruktur je Sprachcode und einen aktiven benannten Export `texts` sowie eine zentrale Operation `setTextsLocale(locale)` bereitstellen. Deutsch MUST Start-/Fallbacksprache sein; nach Auswahl MUST jeder erneut ausgewertete bestehende `texts.…`-Zugriff die aktive vollständige Sprachfassung liefern. Bisherige direkte und über den Config-Re-Export vermittelte Imports MUST erhalten bleiben, ohne Sprachparameter oder Umstellung auf Locale-Zweige an jeder Textstelle. Separate Sprachdateien oder wechselnde Importpfade MUST dafür nicht erforderlich sein. Beide Katalogseiten MUST Download, enthaltene Sprachen und Bearbeitungsstand am gesicherten Stand zugänglich machen; App-Texte MUST weiterhin ausschließlich deutsche Werte bearbeiten lassen.

Das System MUST Funktionen, Aufrufparameter, Fallbackausdrücke, sprachinterne Textverweise und dynamische App-Namen erhalten; übersetzte Funktionsanteile MUST die gewählte Sprache verwenden. Eine geprüfte versionierte Exportdefinition MUST an das Manifest und die technische App-Vorlage gebunden sein. Unbekannte oder inkompatible Definitionen MUST vor Ausgabe abgewiesen werden. Übersetzungstexte MUST ausschließlich als sicher escapte Daten ausgegeben werden; beliebiger importierter JavaScript-Code MUST nicht ausgeführt werden.

Der Download MUST ausschließlich lesend mit den Scope- und Leserechten der kommunalen Textstandvorschau erfolgen und Release-ID, Manifest, Sprachmenge und Prüfsummen prüfen. Fehler in einer Sprachfassung MUST den gesamten Export blockieren; stille Ersatzwerte oder Teildateien sind nicht zulässig. Derselbe Textstand und dieselbe Exportformatversion MUST bytegleiche Dateien ergeben. Der Download MUST unabhängig von späteren Entwurfs-/Sprachauswahländerungen sein und MUST keine DeepL-Anfragen, Jobs, Speicherung oder Appaktivierung auslösen. Der lokale Export MUST vom späteren bestätigt aktivierten Main-Server-Buildexport getrennt bleiben. Die App-Anbindung der Sprachwahl MUST gesondert abgestimmt und ihre tatsächliche Import-/Build-Kompatibilität nachgewiesen werden; der Dateidownload allein MUST nicht als funktionierender Runtime-Sprachwechsel gelten.

#### Scenario: Eine Datei enthält den vollständigen gesicherten Sprachsatz

- **GIVEN** ein gesicherter kommunaler Stand enthält Deutsch, Englisch, Französisch und Portugiesisch (Portugal)
- **WHEN** ein berechtigter Nutzer ihn auf einer der beiden Katalogseiten herunterlädt
- **THEN** enthält eine `texts.js` alle vier vollständigen Sprachobjekte unter ihren gespeicherten Sprachcodes
- **AND** bleiben bestehende `texts`-Imports kompatibel und die Bearbeitung unter App-Texte deutsch
- **AND** sind Sprachen und Bearbeitungsstand vor dem Download sichtbar

#### Scenario: Textfunktionen und App-Namen bleiben funktionsfähig

- **GIVEN** die kompatible App-Vorlage enthält 22 Textfunktionen und zwei dynamische App-Namen
- **WHEN** die exportierten Sprachobjekte mit repräsentativen Argumenten und unterschiedlichen App-Namen geprüft werden
- **THEN** bleiben Signaturen, Platzhalter und die Fallbacklogik `maxPerPerson || 1` erhalten
- **AND** verwenden Funktionsausgaben und interne Textverweise die jeweilige Sprachfassung
- **AND** lesen beide dynamischen Titel weiterhin den App-Namen zur Laufzeit
- **AND** werden bisheriger und neuer Export über den tatsächlichen App-Importpfad geprüft und der vereinbarte Compile-/Bundle-Nachweis erbracht

#### Scenario: Zentrale Locale steuert bestehende Textzugriffe

- **GIVEN** bestehende App-Verbraucher importieren `texts` direkt oder über den Config-Re-Export
- **WHEN** der zentrale App-Anschluss eine enthaltene Locale vor der sichtbaren Navigation oder bei bewusstem Sprachwechsel setzt
- **THEN** liefern unveränderte `texts.…`-Ausdrücke einschließlich Funktionsaufrufen die passende Sprachfassung
- **AND** sehen bereits importierte Verbraucher denselben Wechsel unter dem tatsächlichen Expo-/Metro-Transform
- **AND** bleiben wirksame Locale und React-Zustand konsistent; nicht enthaltene Locales führen zum vollständigen deutschen Fallback

#### Scenario: Vorab berechnete Beschriftungen werden aktualisiert

- **GIVEN** Tabs, Navigationstitel, Formularoptionen oder Textaliase wurden vor dem Sprachwechsel erzeugt
- **WHEN** die App die zentrale Locale wechselt
- **THEN** erzeugt beziehungsweise aktualisiert der App-Anschluss diese sprachabhängigen Werte und invalidiert betroffene Memos/State
- **AND** ist ein Setter oder Render allein kein ausreichender Nachweis für unveränderte Modulkonstanten
- **AND** bleiben bestehende Textzugriffssyntax, ungespeicherte Formularwerte, redaktionelle Titel und Navigationszustand erhalten
- **AND** wird diese App-Kompatibilität erst nach gezielten Verbraucher- und Buildtests als abgenommen markiert

#### Scenario: Historischer Download bleibt reproduzierbar und rein lesend

- **GIVEN** ein berechtigter Nutzer hat einen gesicherten Stand heruntergeladen
- **WHEN** später Entwurf, Sprachauswahl oder DeepL-Bereitschaft geändert werden und derselbe Stand erneut heruntergeladen wird
- **THEN** entstehen bei gleicher Exportformatversion bytegleiche Dateien mit der ursprünglichen Sprachmenge
- **AND** erfolgen keine Schreibzugriffe, Übersetzungsjobs oder Veröffentlichungen

#### Scenario: Unberechtigter oder unvollständiger Export wird abgewiesen

- **GIVEN** Leserechte fehlen, der Stand gehört zu einer fremden Organisation oder eine Sprache verletzt Integrität, Platzhalter oder Vorlagenkompatibilität
- **WHEN** ein Download angefordert wird
- **THEN** wird keine Datei und kein fremder Text ausgegeben
- **AND** entsteht kein teilweise exportierter oder still mit deutschen Ersatzwerten vervollständigter Sprachsatz

### Requirement: Reproduzierbarer lesender Buildexport

Dieser spätere Main-Server-Vertrag MUST unabhängig vom lokalen manuellen Download aus Abschnitt 2G erfüllt werden; dieser ersetzt die bestätigte Main-Server-Aktivierung nicht.

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

### Requirement: Mandantengebundener dynamischer Lese- und Servicevertrag

Das System MUST berechtigte fremdsprachige App-Inhaltsabrufe mit aktueller Kommune, Originalherkunft/Lesbarkeit, erlaubten Profilen und aktiver Sprache prüfen. Main-Server MUST lokale passende MySQL-Treffer ohne Studio/DeepL ausgeben und bei Miss automatisch einen deduplizierten lokalen Hintergrundauftrag zum authentifizierten Studio-Dienst anstoßen. Ein separater REST-Batchsubmit durch die App MUST entfallen. Studio MUST Scope, Servicebindung, Sprache, freigegebene Profil-ID/-Version, Format und wertfreie deutsche Vorlage prüfen; Main-Server MUST Ergebnisse vor Übernahme und jeder Ausgabe aktuell prüfen. App-HTTP MUST nicht auf DeepL warten. Worker-/Antwort-/Retrydetails und Statuskorrelation MUST vor Umsetzung abgestimmt sein; temporäre Studio-Jobs MUST nicht als bereits beschlossener Vertrag vorausgesetzt werden.

Die bestehende Main-Server-Municipality↔Studio-Mandant-Verbindung MUST die fachliche Zuordnung bestimmen. Zusätzliche Kommunenzuordnung, Seed-Organisationsauswahl oder parallele Bindingregistry allein für Übersetzungen MUST entfallen. Studio MUST verifizierten Issuer, Client und konkretes Service-Subject gegen diese bestehende Verbindung prüfen; Clientname allein MUST bei gemischten Login-/Serviceclients nicht genügen. Geeignete vorhandene Audience-, Modul-, Organisations- und Sprachgrenzen MUST erhalten bleiben. Fehlende technische Identitätsmetadaten MUST am bestehenden Verbindungsnachweis konkretisiert werden, statt eine zweite fachliche Zuordnung einzuführen.

#### Scenario: Berechtigter Treffer und fehlender Inhalt

- **GIVEN** ein fremdsprachiger App-Abruf enthält einen passenden Treffer und einen fehlenden erlaubten Inhalt
- **WHEN** Main-Server aktuelle Rechte, Quelle, Profile und Sprache prüft
- **THEN** liefert er den Treffer ohne Studio-/DeepL-Aufruf und stößt nur für den Miss deduplizierte Hintergrundarbeit an
- **AND** bleibt der fehlende Inhalt zunächst vollständig Deutsch in unveränderter Ressourcenstruktur

#### Scenario: Zugriff oder Sprachfreigabe entzogen

- **GIVEN** ein vormals berechtigter App-Abruf hat einen Auftrag erzeugt
- **WHEN** Quelle, passende Vorlage, Lesbarkeit oder aktive Sprache vor Aufruf, Ergebnisübernahme oder Ausgabe nicht mehr gültig ist
- **THEN** entsteht keine unberechtigte Anbieterarbeit oder Textausgabe über diesen Bezug
- **AND** berechtigen bekannte Entry-IDs, Sprache oder Kommune allein nicht zum Zugriff

### Requirement: Exakte generische Deduplizierung je verifiziertem Bereich

Main-Server MUST Vorlagen nach verifizierter Kommune, exaktem Quelltext, Quell-/Zielsprache, stabilem Kontext und Format deduplizieren. Geräte-, Ressourcen-, Seiten-, App-Versions- und Anbieteridentität MUST fachlich gleiche Vorlagen nicht vervielfachen. Geänderte Texte MUST neue Schlüssel erhalten. Aliase/Fragmente, Listen und parallele Wiederabrufe MUST keine doppelten Aufträge erzeugen; Jobanlage je Feldresolver MUST entfallen. Laufende oder fehlgeschlagene Arbeit MUST begrenzte Recovery statt Neuanlage je Poll verwenden.

#### Scenario: Konkurrenz und geänderter Text

- **WHEN** zwei Geräte dieselbe Vorlage über Listen, Aliase oder Fragmente parallel abrufen
- **THEN** entsteht je Kommune/Kontext/Ziel nur ein wirksamer Auftrag
- **AND** erzeugt geänderter Text einen neuen Schlüssel, ohne den alten geteilten Treffer zu überschreiben
- **AND** teilt eine andere Kommune keinen Ergebnisbestand

### Requirement: Begrenzter dynamischer Wiederanlauf ohne zweiten Studio-Inhaltsbestand

Dynamische Ergebnisse und lokale Hintergrundaufträge MUST beim Main-Server liegen. Die konkrete vorhandene Workeranbindung, Ergebnisantwort, Claim-/Generationsprüfung und begrenzten Retry-/Recoveryregeln MUST vor Umsetzung gemeinsam festgelegt werden. Studio MUST keinen dauerhaften zweiten dynamischen Inhaltsbestand führen. Provideraufrufe MUST außerhalb DB-Transaktionen erfolgen. Verlorene Anbieterantwort MUST als mögliches erneutes Kostenrisiko behandelt werden, nicht als Exactly-once. Die bestehende Studio-Graphile-Strecke fester Kataloge MUST davon unverändert bleiben.

#### Scenario: Verlorene Antwort und verspäteter Abschluss

- **WHEN** eine Antwort verloren geht oder ein Worker nach Übernahme durch eine neuere Generation verspätet abschließt
- **THEN** verhindern aktuelle Quellen-/Scope-/Sprach- und Generationsprüfungen eine unzulässige Ergebnisübernahme
- **AND** endet Recovery nach begrenzten Wiederholungen, ohne neuen Auftrag je App-Poll

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

Das System MUST dynamische Inhalte über die bestehenden Ressourcenqueries mit zentralem HTTP-Header `Accept-Language` liefern. Query-Sprachargumente, Sprachmaps, `*I18n`-Felder und neue Pflicht-Ressourcenfelder MUST entfallen. Vorhandene Stringfelder, IDs, technische Werte und Pagination MUST erhalten bleiben. Antwort- und Appcaches MUST Sprache und aktuellen Quellen-/Übersetzungsstand berücksichtigen; ein Header allein trennt keinen normalisierenden Cache. Originale MUST ohne fertige Übersetzung speicher-, importier- und veröffentlichbar bleiben. Eine spätere redaktionelle Sprachfassung MUST an die Originalversion und eine explizite Freigabe gebunden sein und darf nicht von Maschinenjobs überschrieben werden.

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

### Requirement: DeepL-Zugang je Instanz für beide Textstrecken

Das System MUST zunächst DeepL als gemeinsamen Anbietertyp für feste und dynamische Texte verwenden, aber Zugangsdaten je Instanz in der vorhandenen Schnittstellenverwaltung führen. Ein fremder Instanz-Key oder Environment-Key MUST nicht als impliziter Fallback dienen. Dynamische Treffer MUST kommunal getrennt bleiben. Gemeinsame deutsche Standards MUST zentral bleiben; ihre Übersetzungen, Aufträge und Kosten MUST je Instanz über deren eigenen Key geführt werden. Ein zusätzlicher zentraler Anbieterzugang und eine globale kostenpflichtige Fremdsprachenquelle MUST entfallen. Öffentliche Dokumentation MUST von tatsächlicher geprüfter Konto-/Featureabdeckung unterschieden werden. Zielvarianten und optionale HTML-/Glossar-/Formalitätsfähigkeiten MUST explizit validiert werden. Anbieter-Secrets MUST serverseitig bleiben; keine vorsorgliche Provider-Registry oder SSF-Adapter. Manuelle Korrekturen MUST zunächst auf feste Kataloge beschränkt bleiben.

#### Scenario: Derselbe Standard und derselbe dynamische Text in zwei Kommunen

- **GIVEN** zwei Kommunen verwenden denselben festen Standard und identische dynamische Texte
- **WHEN** Übersetzungen benötigt werden
- **THEN** pinnen beide dieselbe deutsche Standardrevision, erzeugen ihre Standardübersetzungen aber instanzgebunden mit ihrem eigenen Key
- **AND** teilen ihre dynamischen Texte keinen kommunalen Cacheeintrag
- **AND** bleibt eine manuelle feste Korrektur vor Maschinenjobs geschützt

### Requirement: Sprachbezogene Overrides und automatische Standardübernahme

Overrides MUST je Kommune, Schlüssel und Sprache gelten. Ohne eigenen Override MUST die Sprachfassung der instanzgebundenen Übersetzung des gepinnten gemeinsamen deutschen Standards folgen, auch bei abweichendem kommunalen Deutsch. Weitere kommunale Sprach-Overrides MUST ausschließlich durch gezielte Bearbeitung beziehungsweise ausdrückliche Übernahmeaktion entstehen. Veröffentlichte Standardänderungen MUST automatisch neue kommunale Sätze aus zuletzt veröffentlichten Overrides erzeugen, ohne zusätzliche kommunale Freigabe. Unveröffentlichte kommunale Entwürfe und manuelle Korrekturen MUST erhalten bleiben und dürfen nicht still veröffentlicht oder ersetzt werden. Snapshot- und Konfliktregeln MUST auch für automatische Aufträge gelten.

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

Die App MUST Inhalte über bestehende Ressourcenqueries mit zentralem `Accept-Language` lesen und passende Treffer wiederverwenden; Main-Server stößt berechtigte fremdsprachige Misses automatisch im Hintergrund an, kein separater Pflicht-REST-Submit. Alle sichtbaren Textfelder eines Inhaltseintrags MUST gemeinsam in der Zielsprache oder gemeinsam deutsch erscheinen; andere Einträge dürfen unabhängig fertig werden. Bei Miss MUST App-HTTP dieselbe Inhaltsstruktur zunächst Deutsch liefern, ohne auf DeepL zu warten. Innerhalb höchstens fünf Sekunden ab Anzeige/Anforderung darf die App erneut lesen. Bei Fehler/Fristablauf MUST Deutsch für diese geöffnete Ansicht bestehen bleiben. Konkrete Lade-/Rückfall-/Statuskorrelation ohne neue Pflicht-Inhaltsfelder MUST vor Umsetzung abgestimmt werden. Verspätete Ergebnisse MUST keinen bereits deutsch angezeigten Inhalt austauschen. Offline MUST sofort vollständige lokale Übersetzung oder Deutsch erscheinen. Ein dezenter zugänglicher Hinweis MUST je Ansicht in der gewählten Sprache deutsche Rückfälle erklären; Dialoge/Marker je Inhalt MUST entfallen. Sprachkennzeichnung und Screenreader-/Vorlesesprache MUST der tatsächlichen Textsprache folgen: deutsche Rückfallinhalte und erlaubte deutsche Ersatzwerte neuer fester Schlüssel als `de`, übrige Oberfläche und Hinweis in der gewählten Sprache. Vorhandene Ausgabe-/Accessibility-Mittel MUST genügen; eine neue Metadateninfrastruktur ist dafür nicht erforderlich.

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

Main-Server MUST pro fertiger dynamischer Übersetzung `last_used_at` bei erfolgreicher Fertigstellung nach eigener Serveruhr initialisieren und bei autorisierten App-Anfragen mit zurückgeliefertem Ready-Ergebnis aktualisieren. Das MUST fertige Ressourcenabrufe und gegebenenfalls fertige Statusantworten umfassen, ausschließlich für die ausgegebene Sprachfassung. Abruf MUST als Nutzung gelten, ohne Lesen oder Empfang zu behaupten. Abgewiesene Anfragen, reine Pending-/Processing-Polls, Worker-, Formular-/Vorschau-/Wartungs-/Hintergrundzugriffe und lokale/Offline-App-Nutzung MUST die Frist nicht verlängern. Geräte-/Benutzerhistorie, Empfangsbestätigung und Nutzungs-Heartbeats MUST entfallen.

Eine tägliche Main-Server-Bereinigung MUST fertige Einträge nach mindestens 90 Tagen seit `last_used_at` bereinigen. Frist und Zustand MUST unmittelbar bei Löschung atomar erneut geprüft werden, sodass ein inzwischen autorisierter Abruf schützt. Aktive Jobs/Leases MUST ausgenommen bleiben. Verspätete Worker MUST ausschließlich bestehende Entry-ID mit gültiger Lease aktualisieren und dürfen gelöschte Ergebnisse nicht per Upsert wiederherstellen. Laufende/fehlgeschlagene Jobs MUST getrennte begrenzte Retry-/Recoveryregeln behalten. Jobausfall darf längere Ablage verursachen; eine sekundengenaue Löschzusage MUST entfallen.

Diese Regel MUST für alle dynamischen Inhalte einschließlich Bus gelten. Änderung, Unsichtbarschaltung und Löschung von Originalen dürfen alte Treffer bis zur normalen Bereinigung erhalten; Verwendungsprüfung/-zählung, Originalregister, zusätzlicher Textgruppenindex, Bestands-/Änderungsprotokoll und Sync-Gates MUST entfallen. Spätere aktuell berechtigte Anfragen MUST bereinigte Texte neu übersetzen dürfen; lokale gültige Übersetzungen dürfen ohne zusätzliche Gerätelöschung bleiben. Seltene Abrufe können erneut Anbieteraufwand verursachen. Feste Katalogrevisionen, Standards/Overrides, Backups und Logs MUST von dieser allgemeinen Frist ausgenommen bleiben; besondere Aufbewahrungs-/Löschpflichten MUST getrennt behandelt werden.

#### Scenario: Fertigstellung und autorisierte fertige Antworten

- **WHEN** eine Übersetzung erfolgreich fertiggestellt und später per autorisiertem App-Ressourcenabruf oder fertiger Statusantwort abgerufen wird
- **THEN** initialisiert beziehungsweise aktualisiert Main-Server `last_used_at` nach eigener Serveruhr
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
- **WHEN** ein aktuell berechtigter fremdsprachiger App-Inhaltsabruf dieselbe Vorlage benötigt
- **THEN** darf Main-Server einen neuen Eintrag und deduplizierten Hintergrundauftrag anlegen
- **AND** erzeugt ein bloßer Statusabruf keinen Auftrag
- **AND** bleiben lokale gültige Ergebnisse ohne zusätzliche Gerätelöschfunktion nutzbar

### Requirement: Mehrsprachigkeit als optionales Tenant-Plugin

Das System MUST Mehrsprachigkeit unter Plugin-ID `app-translations` über die vorhandene Plugininstallation, optionale instanzweite Modulaktivierung, Modul-IAM und Tenant-Lifecycle bereitstellen. Installation oder ein IAM-Grant allein MUST keinen Fachzugriff erlauben. Katalogwerte MUST zusätzlich organisationsgebunden bleiben; die konfigurierten Zielsprachen MUST aus der instanzweiten Auswahl stammen; ein zweites Aktivierungsregister je Organisation MUST entfallen. Die interne Katalogbasis A MUST vor nutzbarer Fachfreigabe um die vorhandenen hostseitigen Pluginzugangsprüfungen ergänzt werden. Globale Standards/Manifestpflege und eng begrenzte Deutsch-/Cachewartung MUST mit eigenem berechtigtem Hostkontext möglich bleiben, ohne damit kommunale Übersetzungen freizuschalten.

#### Scenario: Gleiche Instanz mit mehreren Organisationen

- **GIVEN** das Modul ist für eine Instanz aktiviert und zwei Organisationen besitzen getrennte Katalogwerte
- **WHEN** ein Benutzer den Katalogeditor öffnet oder der Service eine Übersetzung anfordert
- **THEN** gelten gemeinsamer instanzweiter Pluginzugang und zusätzliche Rechte der jeweils verifizierten Organisation und die instanzweite Sprachauswahl
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

Das System MUST DeepL als benutzerkonfigurierte instanzgebundene Schnittstelle über vorhandene Typregistrierung, Hostresolver und datensatzgebundene Secretverschlüsselung verwalten. Browserantworten MUST ausschließlich redigierten Konfigurations-/Prüfstatus erhalten; Keys/Ciphertexts MUST nicht in Browserantworten, App-Builds, Jobpayloads oder Logs erscheinen. Fehlende/unlesbare Secrets MUST neue Anbieteraufrufe verhindern. Key-/Zugangskonfigurationswechsel MUST bisherigen positiven Prüfnachweis ungültig machen; verspätete Prüfantworten MUST eine geänderte Konfiguration nicht freischalten. Rotation MUST vorhandene gültige Übersetzungen erhalten und benötigt keine Anbieteridentität im dynamischen Cache-Key. Weitere Anbieter MUST erst mit konkretem Verbraucher ergänzt werden.

#### Scenario: Key fehlt oder wird rotiert

- **WHEN** der Instanzzugang fehlt, unlesbar ist oder berechtigt rotiert wird
- **THEN** gibt die Oberfläche ausschließlich sicheren Status aus und verwendet keinen fremden oder gemeinsamen Fallbackkey
- **AND** bleiben vorhandene gültige Kataloge und autorisiert nutzbare fertige Übersetzungen erhalten
- **AND** erfordern neue abhängige Operationen einen gültigen Nachweis für die aktuelle Zugangskonfiguration

### Requirement: Dynamischen Übersetzungsstatus und Sprachfassungen im Inhaltsformular anzeigen

Studio MUST als Hauptakteur der Übersetzungsverwaltung im jeweiligen Inhaltsformular den Status und fertige Sprachfassungen dynamischer Inhalte anzeigen. Diese Leseanzeige MUST von späterer manueller dynamischer Korrektur getrennt bleiben. Die konkrete Übermittlung und mögliche Speicherung des benötigten Originalbezugs MUST vor Implementierung abgestimmt werden; ein pauschaler Ausschluss von Originalbezug aus Studio MUST entfallen. Die Anzeige MUST aktuellen Organisations-/Pluginzugang und redaktionellen Inhaltszugriff serverseitig prüfen und darf alte Texte nicht als passende aktuelle Übersetzung ausgeben. Sie MUST keinen dauerhaften Originalreferenzbestand, Änderungs-/Verwendungsabgleich oder Übersetzungskopien in Originaldatensätzen einführen. Formular-/Vorschauabrufe MUST die 90-Tage-Frist nicht verlängern.

Die Formularanzeige MUST auch mit fremdsprachigem `Accept-Language` rein lesend sein und darf keine fehlenden Übersetzungen anfordern, Jobs anlegen oder `last_used_at` verlängern. Ein gemeinsamer Reiter, konkrete Statusbeschriftungen, Laden erst beim tatsächlichen Öffnen und Hinweis bei ungespeicherten Textänderungen bleiben UI-Empfehlungen aus Design 6.1. App- und redaktioneller Aufruf MUST anhand verifizierter Berechtigung und serverseitigem Kontext unterschieden werden, niemals durch einen frei wählbaren Header; die konkrete Bindung MUST vor Umsetzung festgelegt sein. Ein Knopf zum Anfordern fehlender Übersetzungen ist nicht entschieden; diese Leseanforderung MUST weder eine solche Aktion noch automatische Übersetzung beim Speichern oder dynamische Korrekturrechte voraussetzen.

#### Scenario: Formular zeigt passende vorhandene Sprachfassungen

- **GIVEN** ein berechtigter Redakteur öffnet einen gespeicherten Inhalt bei aktivem Mehrsprachigkeitsmodul
- **WHEN** die geplante Formularanzeige Übersetzungsstatus und fertige Sprachfassungen liest
- **THEN** beziehen sich ausgegebene Fassungen auf die aktuell geprüfte Vorlage, dieselben Übersetzungsprofile/Kontexte und die richtige Organisation
- **AND** verlängert dieser Formularabruf `last_used_at` nicht und eröffnet keine manuelle dynamische Korrektur

#### Scenario: Originalstand oder Inhaltszugriff geändert

- **WHEN** die gespeicherte übersetzbare Vorlage oder der redaktionelle Inhaltszugriff wechselt
- **THEN** gibt die Formularanzeige keine nicht mehr passende oder nicht mehr berechtigte Sprachfassung als aktuell aus
- **AND** wird die konkrete sichere Neuabfrage/-zuordnung vor Implementierung festgelegt, ohne neue Quellreferenztabelle

### Requirement: Deutsche Host-Texte ohne Mehrsprachigkeitsmodul

Das System MUST gemeinsame und kommunale deutsche App-Texte unabhängig vom optionalen Mehrsprachigkeitsmodul bereitstellen. Rootimport MUST ausschließlich deutsche Ausgangstexte aus dem bestehenden JSON-Manifest übernehmen. Kommunale deutsche Pflege MUST eigene Hostrechte `app-texts.catalog.read`, `.write`, `.publish` und den aktiven Organisationsscope prüfen. Die deutsche Bearbeitungsprojektion MUST Fremdsprachenwerte ausblenden und Fremdsprachenmutationen verweigern. Übersicht und unveränderliche Vorschau gesicherter Textstände MUST in beiden Ansichten alle enthaltenen Sprachen und den gesicherten Bearbeitungsstand desselben autorisierten Scopes anzeigen, auch bei inzwischen deaktivierten Sprachen; dadurch MUST NOT ein fremdsprachiges Schreibrecht entstehen. Deutsche Versiegelung MUST unabhängig von unvollständigen Übersetzungen möglich sein. Der Pluginmodus MUST deutsche Mutationen verweigern. Beide Ansichten MUST denselben Datenbestand verwenden und erhaltene Sprachwerte nicht löschen.

#### Scenario: Deutsch bei deaktiviertem Modul

- **GIVEN** eine aktive Kommune besitzt Hostrechte für deutsche Texte und kein aktives Mehrsprachigkeitsmodul
- **WHEN** ihr Redakteur deutsche Texte liest, bearbeitet und einen vollständigen deutschen Prüfstand sichert
- **THEN** sind die Operationen ohne Pluginzugang möglich und enthalten nur Deutsch
- **AND** können weder gesetzte Modusheader noch Pluginrechte den Zugriff auf andere Sprachfassungen freischalten

### Requirement: Sprachwahl in der instanzgebundenen DeepL-Konfiguration

Das System MUST den Schnittstellentyp DeepL erst nach Mehrsprachigkeits-Modulaktivierung für die Instanz anbieten. Fehlender Anbieterzugang MUST Einrichtung/Diagnose erreichbar lassen; der Modulbereich MUST zunächst auf die nötige Einrichtung hinweisen. API-Key und instanzgebundene Zielsprachauswahl MUST innerhalb dieser Schnittstellenkonfiguration gepflegt werden. Einen separaten Hauptmenüpunkt „Sprachen“ MUST es nicht geben. Die ausdrückliche serverseitige Anbieterabfrage MUST unterstützte Textübersetzungsziele und Fähigkeiten laden, validieren und an die aktuelle Zugangskonfiguration binden. Deutsch MUST immer als Ausgangssprache verfügbar bleiben. Anbieterunterstützung MUST von technischer Studio-/Appfreigabe unterschieden werden. Abhängige Funktionen MUST serverseitig aktuelle Modul-/Zugangsbereitschaft und ausgewählte Sprache prüfen. Vorbereitete andere Plugins MUST denselben Instanzzugang verwenden und erhalten keinen Key. Setupstatus allein MUST keine noch nicht implementierte Übersetzungsfunktion behaupten.

#### Scenario: Modul aktiv, DeepL noch nicht eingerichtet

- **WHEN** eine Instanz das Modul aktiviert und noch keinen geprüften DeepL-Zugang besitzt
- **THEN** kann ein entsprechend berechtigter Benutzer DeepL in der Schnittstellenverwaltung einrichten
- **AND** erklärt der Modulbereich den fehlenden Schritt, ohne bereits Übersetzungsoperationen freizuschalten
- **AND** bleiben deutsche Hosttexte nutzbar

#### Scenario: Anbieterprüfung und Sprachauswahl

- **WHEN** der berechtigte Benutzer mit dem gespeicherten Instanz-Key die Sprachen ausdrücklich abfragt
- **THEN** werden ausschließlich gültige Zielsprachen und deren technische Nutzbarkeit dargestellt
- **AND** können erlaubte Sprachen für diese Instanz gewählt werden, ohne ein fremdes Secret oder einen zweiten Sprachbestand zu verwenden

#### Scenario: Verspätete Prüfung nach Keywechsel

- **WHEN** während einer Anbieterprüfung der gespeicherte Zugang geändert wird
- **THEN** darf die alte Antwort weder den neuen Zugang als geprüft markieren noch abhängige Funktionen freischalten

#### Scenario: Anbieterfehler oder Abschaltung

- **WHEN** der Zugang abgewiesen oder die Schnittstelle deaktiviert wird
- **THEN** werden neue abhängige Anbieteroperationen gesperrt und bleibt die Einrichtung erreichbar
- **AND** werden vorhandene Texte/Sprachfassungen nicht gelöscht und wird ein bloßer Anbieterausfall nicht als App-Sprachdeaktivierung behandelt

### Requirement: Instanzgebundene Maschinenübersetzung fester App-Texte lokal vorbereiten

Das System MUST im vorhandenen kommunalen Mehrsprachigkeitseditor fehlende oder veraltete feste Sprachwerte ausdrücklich über den geprüften eigenen DeepL-Zugang erzeugen können. Start MUST aktuelle Session-/Organisationsbindung, `app-translations.catalog.write`, CSRF, Modulzugang, gültige Zugangsevidenz und übernommene erlaubte Zielsprachen prüfen. Deutschpflege MUST unabhängig bleiben. Reines Lesen, Speichern oder Auswählen einer Sprache MUST keinen Anbieterjob auslösen. Die Vorbereitung MUST weder veröffentlichen noch eine Appaktivierung oder einen abgeschlossenen dynamischen Übersetzungsdienst behaupten. Sie MUST denselben fachlichen Übersetzungspfad für die spätere Veröffentlichung vorbereiten.

Maschinelle Standardwerte MUST im bestehenden Draft von eigenen Sprachkorrekturen getrennt bleiben. Standardquelle MUST die gepinnte unveränderliche deutsche globale Basis sein; ein deutscher kommunaler Override MUST andere Sprachstandards nicht automatisch verändern. Eine ausdrückliche gezielte Übernahme MUST eigene Sprachfassungen aus gespeichertem kommunalem Deutsch erzeugen können. Manuelle Korrekturen MUST vorrangig bleiben und von Bulk-/Retryjobs unangetastet bleiben. Eine gezielte Neuübersetzung eines manuellen Werts MUST eine ausdrückliche, an Sprache/Schlüssel, Quelle, aktuellen Override und Revision gebundene Ersetzungsbestätigung verlangen. Änderung der tatsächlichen Quelle beziehungsweise Zielvariante MUST Korrekturentscheidungen erneut erfordern, ohne Werte zu löschen. Reset MUST nur den eigenen Wert entfernen und die passende aktuelle maschinelle Standardfassung beziehungsweise einen erklärbaren Fehlzustand zeigen; kein impliziter Anbieteraufruf. Bestehende Manuellwerte und versiegelte Kataloge MUST erhalten bleiben.

Die Ausführung MUST bestehende Studio-Pluginjobs und Graphile nutzen. Start/Enqueue und Batchübernahme/Draftrevision/Checkpoint MUST jeweils atomar sein. Jobpayloads MUST weder Textkopien noch Secrets oder Sessiontokens enthalten; Texte MUST aus den gepinnten beziehungsweise unverändert validierten Katalogquellen kommen. Ein Claimverlust, redaktioneller Konkurrenzschreibzugriff, geänderter Zugang/Zielcode, Sprach-/Modulsperre oder überholte Lifecyclegeneration MUST die spätere Übernahme verhindern. Provideraufrufe MUST außerhalb DB-Transaktionen liegen. Bereits bestätigte Batches MUST bei Wiederaufnahme erhalten und übersprungen werden; unbekannter Providerabschluss vor Commit MUST nicht als kostensicheres Exactly-once behauptet werden. Fortschritt, Konflikt und Fehler MUST verständlich sichtbar sein; reine Statusabrufe MUST autorisiert und nebenwirkungsfrei bleiben.

Strings/Stringarrays MUST in unveränderter Zuordnung und mit exakt validierten Platzhaltern übernommen werden. Ungültige, unvollständige, zu große oder veraltete Antworten MUST ohne Überschreiben bestehender Texte abgewiesen werden. Providerhost, Request-/Antwortgrößen, Parallelität, Timeout und Retries MUST nach Design 8.5 begrenzt sein. Technisch gültige Maschinenwerte MUST ohne obligatorische sprachliche Einzelabnahme lokal sicherbar sein; unvollständige oder ungeklärte Korrekturen MUST die vollständige Fremdsprachenversiegelung verhindern. Main-Server-/Appauslieferung MUST ein eigener späterer Schritt bleiben.

#### Scenario: Fehlende Übersetzungen über eigenen Instanzzugang

- **GIVEN** eine Organisation besitzt eine deutsche gepinnte Basis und drei übernommene erlaubte Zielsprachen
- **WHEN** eine berechtigte Redaktion ausdrücklich fehlende Übersetzungen erstellen lässt
- **THEN** verarbeitet ein Katalogjob die gültigen deutschen Standardtexte in begrenzten DeepL-Batches mit dem eigenen Instanz-Key
- **AND** werden geprüfte Ergebnisse im bestehenden Entwurf sichtbar, ohne die App oder historische Snapshots zu ändern
- **AND** verursacht ein erneuter Start ohne fehlende oder veraltete Werte keinen Anbieteraufruf

#### Scenario: Kommunales Deutsch und Sprachkorrektur bleiben getrennt

- **GIVEN** der gepinnte Standard lautet „Meldung senden“ und der kommunale deutsche Override „Schaden melden“
- **WHEN** eine fehlende englische Standardfassung erzeugt wird
- **THEN** ist deren Quelle ausschließlich „Meldung senden“
- **AND** entsteht eine Übersetzung von „Schaden melden“ erst durch die gezielte Aktion für diesen gespeicherten kommunalen Text
- **AND** bleiben vorhandene manuelle englische Korrekturen ohne ausdrückliche einzelne Ersetzungsbestätigung erhalten

#### Scenario: Manuelle Korrektur während laufender Anbieteranfrage

- **GIVEN** ein Job besitzt einen gepinnten Quell-/Override-/Draftstand
- **WHEN** eine Redaktion während der Anbieteranfrage einen Wert korrigiert oder zurücksetzt
- **THEN** wird die verspätete Batchantwort als Konflikt verworfen und bleibt die redaktionelle Änderung erhalten
- **AND** kann ein neuer ausdrücklicher Lauf aktuelle bereits gespeicherte Maschinenwerte überspringen, ohne einen alten Auftrag auf die neue Revision umzubasieren

#### Scenario: Quelle oder Zielvariante einer Korrektur ändert sich

- **WHEN** die tatsächliche deutsche Quelle oder der konkrete Zielcode einer manuellen Korrektur geändert wird
- **THEN** bleibt der Korrekturinhalt bestehen und benötigt vor neuer Fremdsprachenversiegelung eine Bestätigung oder gezielte Neuübersetzung
- **AND** invalidiert ein davon unabhängiger deutscher Override keinen geerbten Sprachstandard
- **AND** wird ein Legacy-Manuellwert nicht automatisch als Maschinenwert interpretiert

#### Scenario: Wiederaufnahme nach gespeichertem Batch

- **GIVEN** Batchwerte, neue Draftrevision und Jobcheckpoint sind gemeinsam committed
- **WHEN** der Worker vor der Abschlussmeldung abbricht und ein neuer Claim übernimmt
- **THEN** setzt der Job hinter dem bestätigten Batch fort, ohne ihn erneut beim Anbieter anzufordern
- **AND** kann eine Antwort des alten Claims keine Werte oder Fortschrittsstände mehr ändern

#### Scenario: Keywechsel oder Suspendierung während einer Anfrage

- **WHEN** während eines laufenden Batches der Zugang rotiert, eine Sprache deaktiviert oder das Modul suspendiert und reaktiviert wird
- **THEN** wird die Antwort unter der alten Bindung nicht übernommen
- **AND** bleiben vorhandene Texte erhalten, ohne dass der alte Auftrag die neue Konfiguration oder Modulfreigabe verändert

#### Scenario: Ungültige Platzhalter oder unvollständiges Array

- **WHEN** DeepL Platzhalter verändert, Ergebnisse in falscher Anzahl liefert oder ein Arrayelement fehlt
- **THEN** bleibt der gesamte betroffene Batch beziehungsweise Arraywert unverändert und wird ein sicherer Fehler angezeigt
- **AND** wird kein fehlerhafter Teilsatz versiegelt oder auf Deutsch ersatzbefüllt
