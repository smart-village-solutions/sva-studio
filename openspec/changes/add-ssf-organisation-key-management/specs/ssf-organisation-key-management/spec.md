## ADDED Requirements

### Requirement: Mandantengebundene Organisationsschlüsselverwaltung

Studio SHALL im vorhandenen SSF-Plugin eine mandantengebundene Seite für
Organisationsschlüssel anbieten und öffentliche Schlüsselversionen ausschließlich
aus dem SSF-Gateway beziehen. Das Gateway MUST die verbindliche aktive Version
besitzen; Studio MUST NOT eine konkurrierende Schlüsselversion in Content-
Konfiguration speichern.

#### Scenario: Berechtigte Verwaltung liest öffentliche Versionen

- **WHEN** eine Person mit `ssf.configuration.tenant.manage` die Seite öffnet
- **THEN** zeigt Studio aktive und historische öffentliche Versionen des gebundenen Mandanten aus dem Gateway
- **AND** weder private Schlüssel noch Gesprächsinhalte werden geladen.

#### Scenario: Reine Konfiguration gewährt keinen Aufzeichnungsinhalt

- **WHEN** eine Person nur SSF-Konfiguration verwalten darf
- **THEN** erhält sie dadurch weder Transferberechtigung noch entschlüsselten Aufzeichnungszugriff.

### Requirement: Lokale Erzeugung und bestätigte Sicherung

Studio SHALL Organisationsschlüssel lokal erzeugen und als versionierte
`ssf-organisation-key`-Datei gemäß Gateway-Vertrag zum Download und zur
Druckansicht anbieten. Eine Version MUST erst nach expliziter Sicherungs-
bestätigung und erfolgreichem kryptografischem Besitznachweis aktiviert werden.
Private Schlüssel MUST NOT an Studio- oder SSF-Server übertragen werden.

#### Scenario: Erfolgreiche Ersteinrichtung

- **WHEN** die berechtigte Person einen Schlüssel erzeugt, sichert, die Sicherung bestätigt und die Gateway-Challenge korrekt beantwortet
- **THEN** wird genau die vorbereitete öffentliche Version mit frischer MFA aktiviert
- **AND** die private Datei bleibt unter Verwahrung der Organisation.

#### Scenario: Abbruch vor Aktivierung

- **WHEN** eine Vorbereitung abgebrochen wird oder abläuft
- **THEN** bleibt die bisherige aktive Version unverändert
- **AND** temporäres privates Material wird nicht in Browserpersistenz oder SSR gespeichert.

### Requirement: Organisationsschlüsselersatz erhält historische Bezüge

Studio SHALL vor Ersatz erklären, dass nur neue Aufzeichnungen die neue aktive
Version verwenden. Historische Schlüsselbezüge MUST erhalten bleiben und alte
Organisationsschlüssel MUST weiterhin gezielt für die zugehörigen
Aufzeichnungen verwendet werden können. Ein Ersatz MUST NOT als Heilung eines
verlorenen oder kompromittierten alten Schlüssels dargestellt werden.

#### Scenario: Ersatz bei vorhandenen Aufzeichnungen

- **WHEN** eine neue Version nach Sicherungsbestätigung aktiviert wird
- **THEN** bleiben historische Aufzeichnungsbezüge auf ihre bisherigen Versionen erhalten
- **AND** die Seite weist darauf hin, dass die bisherigen privaten Organisationsschlüssel dafür weiter benötigt werden.

#### Scenario: Paralleler Ersatz

- **WHEN** die aktive Version seit Beginn einer Vorbereitung geändert wurde
- **THEN** schlägt die veraltete Aktivierung ohne weitere Mutation fehl
- **AND** Studio liest den aktuellen Zustand und verlangt eine neue ausdrückliche Vorbereitung.

### Requirement: Explizite Transferberechtigung und echte Benutzeridentität

Studio SHALL `ssf.recording.access.transfer` als explizite mandantengebundene
Berechtigung für die Zugangsübertragung verwenden. Sie MUST von automatischen
Administrationsvollrechten ausgeschlossen werden. Gateway-Aufrufe MUST mit
einem validierbaren Benutzer-Token erfolgen, das serverseitig über konfigurierten
RFC-8693-Token-Exchange gewonnen wird; ursprüngliches Subjekt, Tenant und
MFA-Zeit MUST erhalten bleiben.

Studio-Benutzersitzung, vertraulicher Exchange-Client und Gateway-Zielclient
MUST im selben SSF-Mandanten-Realm liegen. Die notwendige tenantlokale
Client-/Login-Provisionierung und Standard-Exchange-Freigabe SHALL vor
Aktivierung ausgeliefert werden; Exchange MUST NOT als Realm-Brücke oder als
Mittel zum Hinzufügen zuvor fehlender Client-Scopes verwendet werden.

#### Scenario: Ausgetauschtes Benutzer-Token

- **WHEN** eine transferberechtigte Person einen Gateway-Vorgang startet
- **THEN** verwendet der Studio-Host das serverseitige Session-Token für den ausdrücklich konfigurierten Exchange zur Gateway-Audience
- **AND** das Gateway prüft echte Benutzeridentität, Tenant, aktuelle Berechtigung und notwendige frische MFA selbst.

#### Scenario: Service-Token oder fehlende Exchange-Policy

- **WHEN** nur ein technisches Client-Credentials-Token verfügbar ist oder die Exchange-Policy fehlt
- **THEN** verweigert Studio den Vorgang mit erklärbarem Verfügbarkeitsfehler
- **AND** es gibt keinen Ausweichpfad über behauptete Actor-/Permission-Header.

#### Scenario: Studio-Sitzung aus einem anderen Realm

- **WHEN** eine Studio-Sitzung nicht aus dem Realm des SSF-Mandanten stammt
- **THEN** verlangt Studio die bereitgestellte mandantenlokale Anmeldung vor dem Vorgang
- **AND** weder Cross-Realm-Exchange noch eine implizite Zuordnung gleichnamiger Nutzer wird versucht.

#### Scenario: Administrator ohne explizite Transfervergabe

- **WHEN** eine Person allein durch die Rolle `system_admin` oder Konfigurationsverwaltung berechtigt ist
- **THEN** kann sie keine Transferkandidaten, Vorbereitungen oder Commits abrufen.

### Requirement: Exakte lokale Zugangsübertragung

Studio SHALL eine Auswahl von Aufzeichnungen, eine Zielperson, deren aktuelle
Schlüsselversion und eine Begründung bestätigen lassen und nur die dafür
vorbereiteten Inhaltsschlüssel lokal umschlüsseln. Jede Vorbereitung MUST genau
eine Organisationsschlüsselversion umfassen und MUST beim Commit den
bestätigten Umfang und die exakte Zielversion kryptografisch binden.
Gesprächsinhalte MUST dafür weder geladen noch angezeigt werden.

#### Scenario: Zugang für ausgewählte Aufzeichnungen übertragen

- **WHEN** die berechtigte Person zur passenden Organisationsversion eine Datei lokal lädt und Quelle, Umfang, Zielversion und Begründung bestätigt
- **THEN** sendet Studio nur neue verschlüsselte Envelopes mit dem gebundenen Besitznachweis
- **AND** das Gateway gewährt atomar genau die vorbereiteten Zugänge und liefert einen Beleg.

#### Scenario: Mehrere historische Organisationsversionen

- **WHEN** eine Auswahl Aufzeichnungen mehrerer Organisationsschlüsselversionen enthält
- **THEN** zeigt Studio getrennte Versionsgruppen mit jeweils passender Datei und eigener Bestätigung
- **AND** es behauptet keinen atomaren Gesamtabschluss über die Gruppen.

#### Scenario: Zielschlüssel oder Umfang hat sich geändert

- **WHEN** die Zielversion rotiert, eine Aufzeichnung gelöscht wird oder ein Commit zusätzliche beziehungsweise fehlende Schlüssel enthält
- **THEN** verwirft das Gateway den betroffenen Commit ohne Teilfreigabe
- **AND** Studio verlangt eine erneute Vorbereitung und Umfangsbestätigung.

#### Scenario: Metadaten ohne Entschlüsselung

- **WHEN** Studio Transferkandidaten anzeigt
- **THEN** verwendet es ausschließlich autorisierte Metadaten und Verzeichnisidentitäten
- **AND** verschlüsselte Gesprächssprachen oder Inhalte werden nicht zur Listenanreicherung entschlüsselt.

### Requirement: Geheimnislebensdauer und bestehende Passphrase-Richtlinie

Studio MUST private Organisationsschlüssel, lokale rohe Inhaltsschlüssel und
die entschlüsselte Browserkopie der Challenge auf den flüchtigen Browserkontext
begrenzen und MUST sie aus URLs, Logs, Telemetrie, SSR und Browserpersistenz
ausschließen. Dies schließt den notwendigen, vom Gateway erzeugten und dort
für die Vorbereitungslaufzeit verschlüsselt gespeicherten Challenge-Verifier
nicht aus. Studio MUST die entschlüsselte Challenge niemals zurücksenden. Die
persönliche Passphrase sowie die bestehende optionale
`recording.passphraseFileEnabled`-Richtlinie MUST unverändert bleiben.

#### Scenario: Kontext verlassen

- **WHEN** eine Person abbricht, den Mandanten wechselt, sich abmeldet oder die Seite neu lädt
- **THEN** werden temporäre Referenzen und Druckansichten verworfen
- **AND** ein späterer Transfer benötigt erneut die private Organisationsschlüsseldatei.

#### Scenario: Bestehende persönliche Passphrase-Dateirichtlinie

- **WHEN** Aufzeichnungseinstellungen im Rahmen der neuen Seiten gelesen oder gespeichert werden
- **THEN** bleiben persönliche Passphrase-Dateifreigaben und unbekannte unterstützte Content-Felder erhalten
- **AND** Studio führt keinen persönlichen Private-Key-Import als Ersatz ein.
