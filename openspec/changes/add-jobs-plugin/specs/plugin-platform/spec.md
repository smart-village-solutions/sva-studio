## ADDED Requirements

### Requirement: Stellenanzeigen besitzen einen optionalen eigenständigen Plugin-Vertrag

Das System MUST `@sva/plugin-jobs` mit Plugin-/Modul-ID `jobs`, Content-Type `jobs.job` und den Fachrechten `jobs.read`, `jobs.create`, `jobs.update` und `jobs.delete` unterstützen. Das Plugin MUST vorhandene öffentliche SDK-/UI-Verträge verwenden und ohne Aktivierungs- oder Runtime-Abhängigkeit auf andere Fachplugins bestehen. Registrierung MUST keine automatische Aktivierung für bestehende Instanzen bewirken.

#### Scenario: Job-Zugriff benötigt aktiviertes Modul und Fachrecht

- **WHEN** eine fachliche Job-Route oder Mutation aufgerufen wird
- **THEN** prüft der Host Modulaktivierung, passendes Job-Recht, Instanz, Organisation, Principal sowie Provider-/Objektzugriff
- **AND** ersetzen Rechte anderer Fachplugins das Job-Recht nicht
- **AND** gelten bei Sichtbarkeitsübergängen zusätzlich die bestehenden Host-Lifecycle-Rechte

#### Scenario: Job-Modul benötigt keine Ortsaktivierung

- **GIVEN** das Job-Modul ist aktiviert und das Ortsmodul ist deaktiviert
- **WHEN** eine Person mit gültigen Job-Rechten die Stellenredaktion verwendet
- **THEN** benötigt sie weder POI-Aktivierung noch POI-Schreibrechte

### Requirement: Job-Lookups folgen der gewählten Identität

Das System MUST den Anstellungsarten-Lookup für berechtigte Job-Leser oder Job-Ersteller im aktivierten Modul bereitstellen, ohne Kategorienverwaltungsrechte vorauszusetzen. Lookup, Detail-Read, Mutation und Wiederaufnahme MUST denselben ausgewählten persönlichen oder organisatorischen Identitätskontext verwenden.

#### Scenario: Ersteller kann Anstellungsarten ohne Kategorienverwaltung laden

- **GIVEN** eine Person besitzt `jobs.create`, aber keine Kategorienverwaltungsrechte
- **WHEN** sie eine Anzeige unter ihrer berechtigten Identität anlegt
- **THEN** kann sie die zulässigen Anstellungsarten lesen
- **AND** erhält sie dadurch keine Kategorienmutationsrechte

#### Scenario: Kontextwechsel bestätigt keinen fremden Vorgang

- **GIVEN** ein Speichervorgang wurde unter einer bestimmten Organisation und Credential-Bindung begonnen
- **WHEN** er in einem anderen Kontext wiederaufgenommen wird
- **THEN** verweigert der Host die Wiederaufnahme ohne Provider-Mutation

### Requirement: Job-Zuständigkeit ist eindeutig und schützt Schreibwege

Das System MUST exakt `Job` über die bestehende Build-time-Registry dem Inhaltstyp `jobs.job` zuordnen. Die gemeinsame Inhaltsübersicht MUST den Datensatz nur einmal darstellen und bei fehlenden Fachrechten keinen generischen Ersatz erzeugen. Technische GenericItem-/Core-Rechte MUST keinen generischen Anlage-, Schreib-, Sichtbarkeits-, Lösch- oder Ownership-Umgehungspfad für Job-Datensätze eröffnen. Updates MUST bestehenden und angefragten Typ prüfen, damit beide Umtypisierungsrichtungen erfasst sind.

#### Scenario: Ein Job erscheint einmal als Fachinhalt

- **WHEN** die gemeinsame Inhaltsübersicht einen registrierten GenericItem-Datensatz mit Typ `Job` klassifiziert
- **THEN** verwendet sie ausschließlich `jobs.job`
- **AND** bleibt ein anderer GenericItem-Typ bei seiner bisherigen Zuständigkeit

#### Scenario: Deaktivierung eröffnet keine technische Schreibumgehung

- **GIVEN** das Job-Modul ist deaktiviert und die Job-Zuständigkeit bleibt registriert
- **WHEN** eine Person über allgemeine GenericItem- oder Core-Endpunkte einen Job ändern, veröffentlichen, löschen oder übertragen will
- **THEN** wird die fachliche Schreibschutzgrenze nicht umgangen
- **AND** ersetzt ein technisches GenericItem-Recht weder Modulaktivierung noch erforderliche Job-Rechte

#### Scenario: Generische Anlage und Umtypisierung umgehen keinen Fachschutz

- **GIVEN** eine Person besitzt technische GenericItem-Rechte, aber keine erforderlichen Job-Rechte oder keine Job-Modulaktivierung
- **WHEN** sie generisch einen Job anlegt, einen Nicht-Job zu Job umtypisiert oder einen Job zu einem anderen Typ umtypisiert
- **THEN** wird jeder dieser Wege vor einer Provider-Mutation abgewiesen
- **AND** weisen Negativtests den Schutz bei aktiviertem und deaktiviertem Modul mit Provider-Write-Aufrufzahl null nach
