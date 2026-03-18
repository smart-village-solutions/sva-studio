## ADDED Requirements

### Requirement: Gruppen als zusätzliche Quelle effektiver Berechtigungen

Das System SHALL Gruppen als instanzgebundene IAM-Entität auswerten und deren Zuweisungen in die effektive Berechtigungsberechnung einbeziehen.

#### Scenario: Gruppenmitgliedschaft erweitert effektive Rechte

- **WHEN** ein Benutzer einer Gruppe mit fachlich relevanten Berechtigungen zugewiesen ist
- **THEN** werden diese Gruppenrechte in `GET /iam/me/permissions` und `POST /iam/authorize` berücksichtigt
- **AND** die Herkunft der Berechtigung bleibt nachvollziehbar

#### Scenario: Konflikte zwischen Rollen und Gruppen bleiben deterministisch

- **WHEN** eine Rollenfreigabe und eine gruppenbasierte Restriktion denselben Zugriff betreffen
- **THEN** wird die finale Entscheidung nach einer dokumentierten Prioritätsregel berechnet
- **AND** identischer Kontext führt zu identischem Ergebnis und identischem Reasoning

### Requirement: Hierarchische Geo-Vererbung für ABAC-Scopes

Das System SHALL geografische Berechtigungen entlang definierter Geo-Hierarchien vererben und untergeordnete Restriktionen berücksichtigen.

#### Scenario: Übergeordneter Geo-Scope wirkt auf untergeordnete Einheiten

- **WHEN** eine Berechtigung für eine übergeordnete geografische Einheit vergeben ist
- **AND** die angefragte Ressource zu einer untergeordneten geografischen Einheit gehört
- **THEN** wird die Berechtigung auf Basis der Geo-Hierarchie vererbt
- **AND** die Entscheidung bleibt auf die aktive `instanceId` begrenzt

#### Scenario: Untergeordnete Geo-Restriktion überschreibt Parent-Freigabe

- **WHEN** eine übergeordnete Geo-Freigabe vorliegt
- **AND** für eine untergeordnete geografische Einheit eine restriktive Regel existiert
- **THEN** wird der Zugriff für diese untergeordnete Einheit verweigert
- **AND** die Antwort enthält einen nachvollziehbaren Denial-Reason
