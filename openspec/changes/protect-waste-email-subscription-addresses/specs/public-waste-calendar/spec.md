## MODIFIED Requirements

### Requirement: Öffentliche App aktiviert E-Mail-Erinnerungen erst nach Double-Opt-In
Das System SHALL den E-Mail-Erinnerungsdienst erst nach bestätigtem Double-Opt-In aktivieren.

#### Scenario: Formular erzeugt nur ein Pending-Abo
- **WHEN** ein Benutzer das Formular mit gültigen Daten absendet
- **THEN** speichert das System zunächst ein Pending-Abo
- **AND** versendet eine Bestätigungs-E-Mail an die angegebene Adresse
- **AND** die UI bestätigt nur den Versand des Bestätigungslinks, nicht die sofortige Aktivierung

#### Scenario: DOI-Bestätigung erfolgt in derselben Public-Waste-App
- **WHEN** ein Benutzer auf den Bestätigungslink aus der DOI-Mail klickt
- **THEN** landet er auf einer Unterseite derselben Public-Waste-App
- **AND** das Pending-Abo wird atomar nur bei gültigem Token und vor dem gespeicherten Ablaufzeitpunkt in den Status `active` überführt
- **AND** die App bestätigt, dass der E-Mail-Erinnerungsdienst eingerichtet wurde

#### Scenario: Abgelaufene oder ungültige DOI-Tokens bleiben sicher behandelbar
- **WHEN** ein Benutzer einen abgelaufenen, manipulierten oder bereits verbrauchten DOI-Link aufruft
- **THEN** aktiviert das System kein Abo
- **AND** die App zeigt eine verständliche Fehlseite ohne technische Interna

#### Scenario: Unbestätigte Anmeldung hat den Ablaufzeitpunkt erreicht

- **WHEN** eine weiterhin unbestätigte Anmeldung den gespeicherten Ablaufzeitpunkt erreicht
- **THEN** kann ihr Link das Abo auch bei gleichzeitig laufender Bereinigung nicht aktivieren
- **AND** darf ab diesem Zeitpunkt keine neue DOI-Übergabe für dieses Abo beginnen
- **AND** entfernt der erste zuständige Bereinigungslauf die operativen Abo- und Outbox-Daten ohne zusätzliche Aufbewahrungszeit, sobald ein gegebenenfalls bereits begonnener Versandversuch beendet ist

### Requirement: Jede Erinnerungs-E-Mail enthält eine Abmeldung über dieselbe Public-Waste-App
Das System SHALL jede Erinnerungs-E-Mail mit einem eindeutigen Abmeldelink auf eine Unterseite derselben Public-Waste-App versehen.

#### Scenario: Abmeldelink deaktiviert den Dienst sofort
- **WHEN** ein Benutzer den Abmeldelink aus einer Erinnerungs-E-Mail öffnet
- **THEN** deaktiviert das System das zugehörige Abo ohne zusätzlichen Login
- **AND** die App bestätigt auf einer Unterseite der Public-Waste-App, dass der Dienst deaktiviert wurde
- **AND** nach erfolgreicher Abmeldung beginnt keine weitere Übergabe einer Bestätigungs- oder Erinnerungsmail für dieses Abo an den Versanddienst

#### Scenario: Abmeldelink ist idempotent
- **WHEN** ein Benutzer denselben Abmeldelink mehrfach aufruft
- **THEN** bleibt das Abo deaktiviert
- **AND** die App zeigt weiterhin einen stabilen Bestätigungszustand statt eines technischen Fehlers

#### Scenario: Bestätigte Abmeldung entfernt operative Adressdaten

- **WHEN** die Abmeldung eines Pending- oder aktiven Abos erfolgreich bestätigt wird
- **THEN** wurden Status, Adresslöschung und Stornierung offener Aufträge in derselben Transaktion verarbeitet
- **AND** enthalten weder das beendete Abo noch seine gespeicherten Versandaufträge die Adresse, ihren Hash oder Adresskopien
- **AND** bleiben nur die für die wiederholbare Abmeldung und die datensparsame Versandübersicht benötigten Informationen verfügbar

#### Scenario: Abmeldung trifft auf einen beanspruchten Versandauftrag

- **WHEN** ein beanspruchter Auftrag und eine Abmeldung dasselbe Abo betreffen
- **THEN** serialisiert das System die Versandfreigabe und die Abmeldung an diesem Abo
- **AND** prüft eine Wiederaufnahme nach Abbruch den gültigen Abozustand erneut
- **AND** beginnt nach der bestätigten Abmeldung keine neue Provider-Übergabe
