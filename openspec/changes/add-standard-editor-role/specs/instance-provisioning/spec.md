## ADDED Requirements

### Requirement: Automatische löschbare Standardrolle für neue Mandanten

Das System MUST bei der Erstellung eines neuen Mandanten die Rolle `standard_editor` mit dem vereinbarten Redaktionsprofil einmalig im bestehenden Anlagepfad erzeugen. Es MUST keine Benutzer automatisch zuweisen. Die Rolle MUST über die normale autorisierte Rollenverwaltung löschbar sein und MUST nach bewusster Löschung bei Neustart, erneutem Rollout oder Modulabgleich gelöscht bleiben.

#### Scenario: Mandantenanlage wird wiederholt

- **WHEN** ein neuer Mandant angelegt und derselbe Anlagevorgang nach einem technischen Fehler wiederholt wird
- **THEN** existiert höchstens eine Standardrolle mit vollständigem Profil
- **AND** sind keine Benutzer automatisch zugewiesen

#### Scenario: Bewusste Löschung bleibt bestehen

- **WHEN** eine autorisierte Person die angelegte Standardrolle löscht und später Neustart, Rollout oder Modulabgleich stattfinden
- **THEN** wird die Rolle nicht automatisch erneut angelegt

### Requirement: Einmalige Bestandsmigration ergänzt fehlende Standardrollen

Das System MUST bei der Einführung per einmaliger Datenmigration im regulären Rollout alle bestehenden Mandanten berücksichtigen. Es MUST Rolle und Grants je Mandant transaktional anlegen, bestehende Rollen und Mitgliedschaften erhalten, Kollisionen sichtbar machen und erfolgreiche Ergebnisse unabhängig zurücklesen. Ein abgeschlossenes Backfill MUST nicht als laufender Reconcile erneut ausgeführt werden.

#### Scenario: Mehrere bestehende Mandanten

- **WHEN** die Migration für mindestens zwei bestehende Mandanten mit fehlender Standardrolle ausgeführt wird
- **THEN** erhält jeder Mandant sein eigenes Rechteprofil entsprechend seinen verfügbaren Inhaltsmodulen
- **AND** bestätigt unabhängiger Readback Rolle, Actions, Scopes, Löschbarkeit und fehlende automatische Mitgliedschaften je Mandant

#### Scenario: Bestehende Rolle oder Namenskollision

- **WHEN** der technische Schlüssel bereits existiert oder eine andere Rolle denselben Anzeigenamen trägt
- **THEN** bleiben Rolle, Rechte und Mitglieder unverändert
- **AND** meldet das System Profilabweichungen und Namenskollisionen zur ausdrücklichen Klärung, statt eine zweite gleichnamige Rolle anzulegen oder Rechte auszuweiten

#### Scenario: Fehler und Wiederholung

- **WHEN** die Anlage zwischen Rolle und Grants fehlschlägt
- **THEN** bleibt kein als erfolgreich ausgewiesenes Teilprofil zurück
- **AND** kann der bestehende Migrationstracker den nicht abgeschlossenen Schritt ohne Duplikate wiederholen
- **AND** wird ohne passenden unabhängigen Readback kein vollständiger Erfolg behauptet

### Requirement: Modulabgleich ergänzt ausschließlich vorhandene Standardrollen

Das System MUST für eine vorhandene Standardrolle die redaktionellen Rechte später verfügbarer Inhaltsmodule ergänzen. Nicht verfügbare Module MUST unwirksam bleiben. Der Abgleich MUST fehlende Standardrollen nicht anlegen und MUST bestehende individuelle fachfremde Grants erhalten.

#### Scenario: Inhaltsmodul kommt hinzu

- **WHEN** ein weiteres Inhaltsmodul für den Mandanten verfügbar wird und die Standardrolle existiert
- **THEN** erhält sie dessen unterstützte redaktionelle Rechte einschließlich derselben Ownership-Grenzen
- **AND** erhält sie dadurch keine Moduladministration

#### Scenario: Modul wird entzogen oder Rolle fehlt

- **WHEN** ein Modul deaktiviert oder entzogen wird oder die Standardrolle zuvor gelöscht wurde
- **THEN** gewähren gespeicherte Modulgrants keinen Zugriff auf das nicht verfügbare Modul
- **AND** erzeugt der Abgleich keine fehlende Standardrolle
