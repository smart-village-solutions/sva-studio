# Delta: iam-access-control

## ADDED Requirements

### Requirement: Wiederverwendbare Autorisierungs- und Prüfdaten für Rechteverwaltung

Das System SHALL die bestehende Rollenverwaltung, Rechteübersicht und Szenario-Prüfung auf denselben vorhandenen Autorisierungs- und Permissions-Daten aufbauen lassen.

#### Scenario: Rollennahe Rechteansichten nutzen bestehende Permissions-Felder

- **WHEN** eine Admin-UI Rollenrechte, effektive Rechte oder Prüfergebnisse darstellt
- **THEN** kann sie auf vorhandene strukturierte Felder wie `action`, `resourceType`, optionale `resourceId`, optionale `organizationId`, optionale `effect`, optionale `scope`, `sourceRoleIds` und `sourceGroupIds` zugreifen
- **AND** diese Felder bleiben ohne zusätzliche serverseitige Sonderlogik UI-tauglich

#### Scenario: Rechteprüfung verwendet bestehende Authorize-Pfade

- **WHEN** ein Administrator aus der Rollenverwaltung heraus eine konkrete Rechteentscheidung nachvollziehen möchte
- **THEN** verwendet die UI denselben serverseitigen Prüfpfad wie die bestehende IAM-Szenario-Prüfung oder operative Autorisierung
- **AND** es entsteht keine zweite konkurrierende Entscheidungslogik nur für die Rollenansicht

#### Scenario: Explainability bleibt auf vorhandene strukturierte Diagnostik begrenzt

- **WHEN** Diagnose- oder Begründungsdaten an Rollenverwaltung oder Fach-UI ausgeliefert werden
- **THEN** bestehen diese aus den bestehenden allowlist-basierten Diagnosefeldern, Reason-Codes oder Denial-Codes
- **AND** die UI muss keine unstrukturierten Rohdiagnosen interpretieren
- **AND** interne Policy- oder Identitätsdetails werden nicht offengelegt

#### Scenario: Fehlende Prüfdaten bleiben als definierter Zustand behandelbar

- **WHEN** eine Autorisierungsentscheidung oder Permissions-Antwort keine optionalen Diagnosefelder enthält
- **THEN** bleibt mindestens ein stabiler Entscheidungs- oder Fehlerkontext wie `allowed`, `reason` oder ein strukturierter Denial-Fehler verfügbar
- **AND** die UI kann den Zustand verständlich darstellen, ohne aus dem Fehlen optionaler Prüfdaten eine Erlaubnis abzuleiten

### Requirement: Inkrementelle Rechteverwaltung ohne neues Ownership-Modell

Das System SHALL eine erweiterte Rechteverwaltungs-UI ermöglichen, ohne dafür in diesem Change ein neues Ownership-, Transfer- oder Override-Modell vorauszusetzen.

#### Scenario: Bestehendes Rollen- und Permission-Modell bleibt Grundlage

- **WHEN** die Rechteverwaltungs-UI erweitert wird
- **THEN** basiert sie weiterhin auf den bestehenden Rollen-, Permission- und Authorize-Contracts
- **AND** ein neues autorisierungsrelevantes Ownership-Modell ist keine Voraussetzung für die erste Ausbaustufe

#### Scenario: Technische Permission-Referenzen bleiben kompatibel nutzbar

- **WHEN** Rollen-Permissions noch ganz oder teilweise über technische Referenzen wie `permissionKey` modelliert sind
- **THEN** bleiben diese Referenzen im System und in kompatiblen APIs nutzbar
- **AND** die UI darf darüber eine fachlich lesbarere Mapping-Schicht legen
- **AND** bestehende Rollenauflösung und bestehende Entscheidungen brechen dadurch nicht

#### Scenario: Read-only-Zustände sind serverseitig anschlussfähig

- **WHEN** eine Rolle aufgrund von `isSystemRole` oder `managedBy != studio` fachlich nicht editierbar ist
- **THEN** bleibt die Bearbeitung serverseitig begrenzt oder verweigert
- **AND** die UI kann diesen Zustand ohne eigene heuristische Sonderlogik konsistent darstellen

### Requirement: Konsistente Fehler- und Konfliktkommunikation für Admin- und Fach-UI

Das System SHALL für Rechteverwaltung und priorisierte Fach-UI stabile Fehler- und Konfliktsignale bereitstellen, die auf dem heutigen Modell aufsetzen.

#### Scenario: Serverseitige Verweigerung bleibt verständlich darstellbar

- **WHEN** eine Rollenänderung, eine Rechteprüfung oder eine Fachaktion serverseitig verweigert wird
- **THEN** liefert das System einen strukturierten Fehler- oder Denial-Kontext, der der UI eine verständliche Darstellung erlaubt
- **AND** die UI muss nicht zwischen ungeprüften Textmeldungen und HTTP-Statuscodes reverse-engineeren

#### Scenario: Konflikte bei Rollenänderungen bleiben von generischen Fehlern unterscheidbar

- **WHEN** eine Rollenänderung aufgrund von Read-only-Regeln, Synchronisationsstand oder konkurrierender Änderung nicht übernommen werden kann
- **THEN** liefert das System einen strukturierten Konflikt- oder Denial-Kontext mit stabiler Klassifikation
- **AND** die UI kann diesen Zustand gesondert von generischen Transport- oder Validierungsfehlern behandeln

#### Scenario: Vorschau und operative Prüfung bleiben logisch anschlussfähig

- **WHEN** eine UI eine Rechteprüfung vorab darstellt oder einen operativen Fehler nach einer Aktion verarbeitet
- **THEN** beruhen beide auf demselben bestehenden Autorisierungs- und Diagnosemodell
- **AND** Unterschiede zwischen Rollen-Kontext, effektiver Berechtigung und konkreter Anfrage bleiben nachvollziehbar
