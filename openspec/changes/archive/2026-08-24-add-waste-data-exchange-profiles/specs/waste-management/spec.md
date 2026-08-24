## ADDED Requirements

### Requirement: Waste-Management bietet symmetrische Datenaustauschprofile

Das System SHALL transferrelevante Waste-Fachdaten über kanonische, versionierte Datenprofile importieren und exportieren.

#### Scenario: Import und Export verwenden denselben Profilvertrag

- **WHEN** das System ein Waste-Datenprofil importiert oder exportiert
- **THEN** stammen Feldmenge, Typen, Referenzen, Pflichtsemantik, Defaults und Formatversion aus demselben kanonischen Profilvertrag
- **AND** getrennte Import- und Exportdefinitionen dürfen nicht unbemerkt auseinanderlaufen

#### Scenario: Bestehender Spezialimport bleibt getrennt

- **WHEN** ein Benutzer den adress- und fraktionsorientierten Spezialimport für Tourzuordnungen verwendet
- **THEN** darf dieser fehlende Entitäten weiterhin mit dokumentierten Defaults erzeugen
- **AND** er gilt nicht als verlustfreies Export- oder Roundtrip-Profil

### Requirement: Jedes Waste-Transferfeld besitzt eine eindeutige Semantik

Das System SHALL jedes transferrelevante Modellfeld als Pflichtwert, optionalen Wert oder defaultfähigen Wert klassifizieren und seine Transferentscheidung dokumentieren.

#### Scenario: Pflichtwert fehlt

- **WHEN** ein importierter Datensatz einen als `required` klassifizierten Wert nicht enthält
- **THEN** weist der Preflight den Datensatz mit Profil- und Feldbezug zurück

#### Scenario: Optionaler Wert wird explizit geleert

- **WHEN** ein nullable Feld als `optional` klassifiziert ist und der Import explizit `null` enthält
- **THEN** leert der Import den fachlichen Zielwert

#### Scenario: Defaultfähiger Wert fehlt bei Neuanlage

- **WHEN** ein `defaultable` Feld beim Erstellen eines neuen Datensatzes fehlt
- **THEN** verwendet der Import den für die Profilversion dokumentierten Default
- **AND** weist der Preflight die Defaultanwendung aus

#### Scenario: Defaultfähiger Wert fehlt bei Aktualisierung

- **WHEN** ein `defaultable` Feld beim Aktualisieren eines bestehenden Datensatzes fehlt
- **THEN** bleibt der vorhandene Zielwert unverändert

#### Scenario: Systemexport materialisiert das vollständige Profil

- **WHEN** das System ein Profil exportiert
- **THEN** enthält der Export alle eingeschlossenen Felder einschließlich optionaler `null`-Werte und tatsächlich wirksamer Defaults

### Requirement: JSON ist ein eigenständiges Format jedes Waste-Datenprofils

Das System SHALL jedes kanonische Waste-Datenprofil einzeln als versioniertes JSON importieren und exportieren können.

#### Scenario: Benutzer exportiert ein einzelnes JSON-Profil

- **WHEN** ein berechtigter Benutzer ein einzelnes Waste-Profil im Format JSON exportiert
- **THEN** enthält die Datei mindestens Formatversion, Plugin-ID, Profil-ID, Exportzeitpunkt und Datensätze
- **AND** die Datei kann ohne ein umgebendes ZIP-Paket wieder als dasselbe Profil importiert werden

#### Scenario: Unbekannte JSON-Version wird importiert

- **WHEN** die Profil- oder Formatversion einer JSON-Datei nicht unterstützt wird
- **THEN** stoppt der Preflight vor jedem Schreibzugriff mit einem verständlichen Versionsfehler

### Requirement: Tabellarische Waste-Formate bleiben verlustfrei

Das System SHALL CSV oder XLSX für ein Datenprofil nur anbieten, wenn sämtliche eingeschlossenen Profilfelder verlustfrei abgebildet werden.

#### Scenario: Komplexes Feld besitzt keine kanonische Tabellenabbildung

- **WHEN** ein Profil verschachtelte Werte enthält, die ein tabellarischer Adapter nicht verlustfrei serialisieren und parsen kann
- **THEN** bietet das System dieses Format für das Profil nicht an
- **AND** JSON bleibt für das einzelne Profil verfügbar

#### Scenario: Tabellarischer Export wird wieder importiert

- **WHEN** das System einen CSV- oder XLSX-Export für ein Profil anbietet
- **THEN** stellt ein erneuter Import denselben normalisierten Fachdatenbestand wie der Export her

### Requirement: Waste-Management bündelt unabhängige Profile in Testdatenpaketen

Das System SHALL mehrere ausgewählte Waste-Profile als manifestbasiertes ZIP-Paket exportieren und importieren können.

#### Scenario: Benutzer exportiert mehrere Profile

- **WHEN** ein berechtigter Benutzer mehrere Waste-Profile auswählt
- **THEN** enthält das ZIP-Paket eigenständige JSON-Profildateien sowie ein Manifest mit Versionen, Abhängigkeiten, Datensatzanzahlen und Prüfsummen
- **AND** das Manifest führt keine zweite fachliche Datenrepräsentation ein

#### Scenario: Paketabhängigkeit fehlt

- **WHEN** eine Referenz weder durch ein früheres Profil im Paket noch durch den Zielbestand aufgelöst werden kann
- **THEN** stoppt der Preflight das gesamte Paket vor jedem Schreibzugriff

### Requirement: Die erste Waste-Profilmenge deckt alle portablen Fachdaten ab

Das System SHALL alle portablen Waste-Fachdaten vollständig über die kanonische Profilmenge übertragen.

#### Scenario: Vollständige Profilmenge wird exportiert

- **WHEN** ein berechtigter Benutzer alle Waste-Fachprofile auswählt
- **THEN** umfasst der Export Fraktionen, Geografie und Abholorte, Abstandspresets, Touren, Abholort–Tour-Zuordnungen, Tour-Einsätze, globale und tourbezogene Ausweichtermine, Feiertagsregeln sowie portable Ausgabe- und Facheinstellungen
- **AND** stabile IDs und profilübergreifende Referenzen bleiben erhalten

#### Scenario: Fraktionsprofil wird übertragen

- **WHEN** das System Fraktionen exportiert und importiert
- **THEN** umfasst das Profil mindestens PDF-Kürzel, Übersetzungen, Behältergröße, Farbe, Beschreibung, Aktivstatus und fachliche Reminder-Konfiguration

#### Scenario: Legacy-Einzeltermine sind bereits fachlich migriert

- **WHEN** das System Tour-Einsätze exportiert
- **THEN** exportiert es das kanonische Einsatzmodell einschließlich mehrerer Abholorte
- **AND** es überträgt `waste_location_tour_pickup_dates` nicht als konkurrierende zweite Source of Truth

### Requirement: Waste-Datenaustausch schließt personenbezogene und betriebliche Daten aus

Das System SHALL den operativen E-Mail-Abodienst und umgebungsspezifische Betriebsdaten vollständig aus Waste-Importen und -Exporten ausschließen.

#### Scenario: Waste-Fachdaten werden exportiert

- **WHEN** ein Benutzer ein einzelnes Profil oder ein Mehrprofilpaket exportiert
- **THEN** enthält das Artefakt keine E-Mail-Abonnements, personenbezogenen Adressauswahlen, Consent-Daten, Subscription-Items, DOI-/Abmeldetoken oder Token-Hashes und keine Outbox-Daten
- **AND** es enthält keine Credentials, Datenbankverbindungen, Instanzidentitäten, IAM-, Audit-, Job- oder Monitoringdaten

#### Scenario: Vollständigkeitsgate bewertet Ausschlüsse

- **WHEN** das automatische Coverage-Gate alle Waste-Modellfelder prüft
- **THEN** gelten ausgeschlossene Felder nur mit einer expliziten stabilen Begründung als vollständig klassifiziert
- **AND** ein Ausschluss darf nicht durch einen generischen Fallback oder eine stille Serialisierung umgangen werden

### Requirement: Waste-Importe sind vorab prüfbar und atomar

Das System SHALL Einzelprofile und Mehrprofilpakete vor dem Commit vollständig prüfen und ohne Teilerfolge schreiben.

#### Scenario: Benutzer prüft einen Import vorab

- **WHEN** ein Benutzer einen Waste-Import als Preflight startet
- **THEN** zeigt das System neue, geänderte, unveränderte, fehlerhafte und defaultierte Datensätze
- **AND** es weist Versions-, Typ-, Pflichtfeld-, Referenz- und portable Referenzprobleme verständlich aus

#### Scenario: Einzelprofil schlägt beim Commit fehl

- **WHEN** ein Schreibzugriff innerhalb eines Einzelprofilimports fehlschlägt
- **THEN** rollt das System alle Schreibzugriffe dieses Profils zurück

#### Scenario: Mehrprofilpaket schlägt beim Commit fehl

- **WHEN** ein Schreibzugriff innerhalb eines Pakets fehlschlägt
- **THEN** rollt das System alle Schreibzugriffe des Pakets zurück
- **AND** persistiert keinen fachlichen Teilerfolg

### Requirement: Waste-Importe löschen keine fremden Zielwerte implizit

Das System SHALL kanonische Datenprofile standardmäßig als Upsert ohne implizite Löschungen importieren.

#### Scenario: Ziel enthält zusätzliche Datensätze

- **WHEN** ein importiertes Profil einen bereits im Ziel vorhandenen Datensatz nicht enthält
- **THEN** bleibt dieser Datensatz unverändert bestehen
- **AND** der Import wird nicht als Tenant-Klon oder Replace-Operation interpretiert

### Requirement: Waste-Exporte sind getrennt autorisiert und geschützt

Das System SHALL Waste-Exporte ausschließlich als hostgeführte, instanzbezogene und autorisierte Operation bereitstellen.

#### Scenario: Berechtigter Benutzer startet einen Export

- **WHEN** ein Benutzer mit `waste-management.export.execute` einen Export für die aktive Instanz startet
- **THEN** führt der Host den Export als generischen Studio-Job aus
- **AND** löst die Waste-Fachdatenbank serverseitig aus dem autorisierten Instanzkontext auf

#### Scenario: Benutzer lädt ein Exportartefakt herunter

- **WHEN** ein Exportjob erfolgreich abgeschlossen ist
- **THEN** erhält der Benutzer das Artefakt nur über eine erneut autorisierte, zeitlich begrenzte Downloadreferenz
- **AND** das System publiziert keinen öffentlichen Waste-Export-Feed

#### Scenario: Benutzer besitzt nur Importrecht

- **WHEN** ein Benutzer `waste-management.import.execute`, aber nicht `waste-management.export.execute` besitzt
- **THEN** kann er keinen Export starten oder dessen Artefakt herunterladen

### Requirement: Waste-Datenaustausch besitzt verpflichtende Roundtrip- und Coverage-Gates

Das System SHALL die Vollständigkeit und Symmetrie jedes Waste-Datenprofils automatisch prüfen.

#### Scenario: Profil besteht den Roundtrip

- **WHEN** Testdaten über ein angebotenes Profilformat exportiert und wieder importiert werden
- **THEN** entspricht der resultierende normalisierte Fachdatenbestand dem exportierten normalisierten Bestand

#### Scenario: Neues Waste-Modellfeld ist unklassifiziert

- **WHEN** ein neues Waste-Modellfeld weder eingeschlossen noch begründet ausgeschlossen wurde
- **THEN** schlägt das Coverage-Gate fehl
- **AND** Import und Export dürfen für das betroffene Profil nicht als vollständig gelten
