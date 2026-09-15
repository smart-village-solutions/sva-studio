## ADDED Requirements

### Requirement: New-Realm-Erstellung verwendet serverseitige Standards ohne zusätzliche Detailfragen

Die Instanzverwaltungs-UI SHALL bei `realmMode = new` nur tatsächlich tenantabhängige Daten abfragen. Technische Keycloak-Standardwerte SHALL serverseitig abgeleitet und in der Review-Ansicht verständlich zusammengefasst werden, ohne einen parallelen Client-Sollvertrag zu erzeugen.

#### Scenario: Neuer Tenant benötigt keine technischen Standardwerte

- **WHEN** eine berechtigte Person im Studio einen neuen Tenant-Realm anlegt
- **THEN** fragt der Dialog keine editierbaren Felder für Realmname, Login-Client-ID, Tenant-Admin-Client-ID, Theme, Sprache, Events, Mapper oder SMTP-Grundwerte ab
- **AND** zeigt die Review-Ansicht, welche serverseitige Baseline automatisch angewendet wird
- **AND** bleiben nur echte Tenantdaten und die Identität des initialen Tenant-Administrators einzugeben

#### Scenario: Bestands-Realm behält explizite technische Eingaben

- **WHEN** eine berechtigte Person `realmMode = existing` auswählt
- **THEN** bleiben die für den Bestandsvertrag notwendigen Realm-, Client-, Issuer- und Secret-Angaben verfügbar
- **AND** suggeriert die UI keine automatische Baseline-Migration des bestehenden Realms

### Requirement: Instanzdetail zeigt manuelle Realm-Nacharbeiten handlungsorientiert

Die Instanzdetailseite SHALL nicht automatisierbare Realm-Zielpunkte im bestehenden Betriebs- und Diagnosemodell anzeigen. Jeder Befund SHALL Status, Grund, konkrete Aktion und Freigabewirkung verständlich und barrierefrei darstellen.

#### Scenario: SMTP-Passwort muss manuell gesetzt werden

- **WHEN** die nicht geheime SMTP-Baseline gesetzt ist, aber noch kein erfolgreicher SMTP-Test vorliegt
- **THEN** zeigen Plan und Run-Protokoll den Befund `smtp_password_required` als manuelle Nacharbeit
- **AND** erklärt sie, dass das Passwort einmalig direkt in Keycloak gesetzt werden muss
- **AND** zeigt oder überträgt sie weder ein echtes noch ein maskiertes Passwort
- **AND** verweist sie auf das anschließende operative Testen direkt in Keycloak

#### Scenario: Passwortstatus bleibt vom automatischen Baseline-Erfolg unterscheidbar

- **WHEN** die automatische Realm-Baseline vollständig ist, aber das SMTP-Passwort fehlt
- **THEN** kann der technische Provisioning-Lauf erfolgreich sein
- **AND** bleibt die konkrete manuelle Nacharbeit im Status sichtbar
