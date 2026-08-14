## MODIFIED Requirements

### Requirement: Automatisierter Organisations- und Membership-Abnahmenachweis

Das System MUST für die Organisations- und Membership-Funktionalität einen reproduzierbaren, fail-closed Abnahmenachweis in der vereinbarten Testumgebung bereitstellen. Der CLI-Runner MUST fehlende Konfiguration und fehlgeschlagene Pflichtprüfungen mit stabilem Fehlercode, Bericht und Exitcode 1 ausweisen, ohne Secretwerte zu protokollieren. Die Pflichtprüfungen MUST in der Reihenfolge Preflight, Testdaten-Reset, Readiness, Login/JIT, Organisations-/Membership-Nachweis und UI-Nachweis orchestriert werden.

#### Scenario: Organisations-CRUD wird im aktiven Instanzkontext nachgewiesen

- **WHEN** der Paket-2-Abnahmeflow ausgeführt wird
- **THEN** werden Erstellen, Lesen, Aktualisieren und Deaktivieren einer Organisation im aktiven Instanzkontext erfolgreich geprüft
- **AND** Parent-/Child-Beziehungen und Hierarchiefelder werden im selben Flow verifiziert

#### Scenario: Membership-Zuweisung und Default-Kontext werden nachgewiesen

- **WHEN** der Paket-2-Abnahmeflow eine Account-zu-Organisation-Zuweisung ausführt
- **THEN** ist die Membership über API und Datenbank nachweisbar vorhanden
- **AND** der Default-Kontext des Accounts ist korrekt gesetzt oder aktualisiert

#### Scenario: Admin-UI spiegelt Organisations- und Membership-Daten korrekt wider

- **WHEN** der Paket-2-Abnahmeflow die Admin-Oberfläche prüft
- **THEN** sind Benutzerliste, Organisationsstruktur und Membership-Zuweisung sichtbar korrekt
- **AND** der Abnahmebericht dokumentiert den erfolgreichen UI-Nachweis

#### Scenario: Fehlende Konfiguration bleibt fail-closed und redigiert

- **WHEN** mindestens eine erforderliche Acceptance-Umgebungsvariable fehlt
- **THEN** endet der CLI-Lauf mit `acceptance_config_missing` und Exitcode 1
- **AND** JSON- und Markdown-Bericht enthalten keine vorhandenen Passwort-, Client-Secret- oder Datenbank-Credential-Werte

#### Scenario: Pflichtprüfung schlägt fehl

- **WHEN** Preflight, Reset, Readiness, Login/JIT, Organisations-/Membership- oder UI-Nachweis fehlschlägt
- **THEN** werden nachgelagerte Nachweise nicht als erfolgreich ausgewiesen
- **AND** der autoritative `acceptance_*`-Fehlercode bleibt in Log und Bericht erhalten

