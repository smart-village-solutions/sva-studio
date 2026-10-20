## ADDED Requirements

### Requirement: Organisationscredentials werden nur als bekannte verifizierte Version still zurückgesichert

Das System SHALL eine lokale Lücke organisatorischer Mainserver-Credentials ausschließlich aus dem bestehenden eindeutig zugeordneten technischen Keycloak-Account zurücksichern dürfen. Die Datenbank SHALL die maßgebliche Laufzeitquelle bleiben. Zulässig SHALL nur eine vorhandene aktive Organisation mit vorhandener Credential-Zeile im Zustand `ready`, bisherigem `last_verified_at` und tatsächlich fehlender Application-ID oder fehlendem Secret sein. Andere Zustände, fehlende Zeilen, vollständige abweichende Credentials, Entschlüsselungsfehler und unklare Abhängigkeiten SHALL ohne Write in den Supportpfad führen.

Die bestehende instanzgebundene Accountreferenz SHALL eindeutig sein und zu einem aktiven, nicht gesperrten oder gelöschten Account führen. Keycloak SHALL dessen vorhandenen Subject und exakt passende Instanz-, Organisations- und Zweckattribute bestätigen. Das Klassifikationsflag allein SHALL nicht genügen. Das System SHALL keine Accounts über E-Mail oder Anzeigenamen suchen, neu anlegen oder neu zuordnen.

Der Kandidat SHALL ein vollständiges kanonisches Paar sein, jedem noch vorhandenen Datenbankbestandteil entsprechen und mit `source=organization` und der Organisations-ID genau einer aktuellen verifizierten DataProvider-Bindung entsprechen. Konkurrierende aktuelle Versionen oder Providerkonflikte SHALL die Rücksicherung verhindern. Historische, widerrufene, ausstehende oder konfliktbehaftete Bindings SHALL keine Freigabe begründen. Die Rücksicherung SHALL keine Bindung erzeugen, historisieren, umhängen oder neu verifizieren.

#### Scenario: Lokaler Verlust derselben bekannten Version

- **GIVEN** eine zuvor verifizierte Organisation ist weiterhin `ready`, aber ein Credential-Bestandteil fehlt lokal
- **AND** Accountzuordnung und Keycloak-Marker sind eindeutig und das kanonische Paar passt zur einzigen aktuellen verifizierten Organisationsbindung und zu vorhandenen Bestandteilen
- **WHEN** der autorisierte stille Refresh die Rücksicherung prüft
- **THEN** darf Studio exakt dieses Paar lokal zurücksichern
- **AND** bleibt der DataProvider unverändert

#### Scenario: Keycloak enthält eine alte Version

- **GIVEN** der Keycloak-Kandidat entspricht nur einer historischen oder widerrufenen Bindung
- **WHEN** Studio die Rücksicherung prüft
- **THEN** bleibt die Datenbank unverändert
- **AND** erhält der Benutzer den Supporthinweis mit sicherem Grundcode

#### Scenario: Manuelle Änderung oder vollständige Abweichung

- **GIVEN** die Organisation ist `verification_required` oder besitzt vollständige vom Kandidaten abweichende Datenbankcredentials
- **WHEN** ein Credential-Fehler auftritt
- **THEN** überschreibt Studio weder Credential-Bestand noch Status
- **AND** interpretiert es die Keycloak-Kopie nicht als neuere oder führende Version

#### Scenario: Zuordnung oder Nachweis fehlt

- **GIVEN** Credential-Zeile, früherer Verifikationszeitpunkt oder technischer Account fehlt oder Accountmarker beziehungsweise aktuelle Bindung sind mehrdeutig
- **WHEN** die Wiederherstellung geprüft wird
- **THEN** erfolgen weder Rücksicherung noch Suche, Accountanlage oder automatische Wiederzuordnung
- **AND** meldet Studio die nicht mögliche Wiederherstellung präzise

#### Scenario: Schlüsselproblem ist kein Credential-Verlust

- **GIVEN** ein gespeicherter Ciphertext kann wegen eines Schlüssel- oder Entschlüsselungsfehlers nicht gelesen werden
- **WHEN** Credential-Readiness scheitert
- **THEN** überschreibt Studio den Ciphertext nicht mit der Keycloak-Kopie
- **AND** unterscheidet der sichere Fehlergrund diesen Zustand von fehlenden Daten

### Requirement: Lokale Credential-Rücksicherung bleibt atomar und autorisierungsneutral

Das System SHALL die lokale Rücksicherung als eng begrenzte interne Reparatur derselben bekannten Version im bestehenden autorisierten POST-Refresh ausführen. Sie SHALL keine allgemeine Credential-Verwaltungsberechtigung verleihen; zulässige Inhaltsnutzer dürfen keine neuen Werte oder fremden Targets setzen. Vor jedem Write SHALL Studio unter vorhandenen Organisations-/Binding-Sperren und geeigneter vorhandener Lease Zustand, Accountzuordnung, gespeicherten Bestand und Binding erneut prüfen. Eine aktive konkurrierende Provisionierung SHALL den Write verhindern.

Die lokale Transaktion SHALL nur das geprüfte Paar mit bestehender organisationsgebundener Verschlüsselung zurückschreiben, den bisherigen Verifikationszeitpunkt und die Bindung erhalten und einen sicheren Auditnachweis hinterlegen. Sie SHALL ohne neuen externen Verifikationsnachweis keinen aktuellen `last_verified_at` erzeugen. Veraltete Kandidaten oder verlorene Leases SHALL keine Writes erlauben; konkurrierende Reparaturen und manuelle Änderungen SHALL keine Teilstände oder Überschreibungen erzeugen. Ein erfolgreicher Write SHALL anschließend kanonisch zurückgelesen werden.

#### Scenario: Zwei Prozesse reparieren denselben Verlust

- **GIVEN** zwei autorisierte Refreshes lesen denselben Keycloak-Kandidaten
- **WHEN** der erste Lauf die Version atomar zurückgesichert hat
- **THEN** erkennt der zweite Lauf unter der Sperre den vollständigen Zustand und überschreibt ihn nicht
- **AND** bleiben Binding und bisheriger Verifikationszeitpunkt unverändert

#### Scenario: Manueller Write oder Provisionierung gewinnt das Rennen

- **GIVEN** nach Lesen des Kandidaten wurde der Credential-Bestand geändert oder eine andere Provisioning-Lease aktiv
- **WHEN** die Rücksicherung vor ihrem Write erneut prüft
- **THEN** schreibt sie den veralteten Kandidaten nicht
- **AND** meldet sie einen sicheren Konkurrenzgrund statt Erfolg

#### Scenario: Prozessabbruch vor und nach Commit

- **WHEN** ein Reparaturlauf vor dem lokalen Commit abbricht
- **THEN** entsteht kein teilweise restauriertes Credential-Paar
- **AND** ist bei einem Abbruch nach Commit ausschließlich dieselbe bekannte Version gespeichert und ein späterer regulärer Read weiterhin möglich
