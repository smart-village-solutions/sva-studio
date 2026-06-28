## ADDED Requirements

### Requirement: Ownership-Transfer autorisiert den aktuellen Inhalt

Das System SHALL Ownership-Transfers als Mutation am aktuellen Inhalt autorisieren. Der Actor benötigt dafür die passende Update-Permission auf den aktuell sichtbaren Inhalt. Der Ziel-Owner SHALL validiert werden, setzt aber keine zusätzliche Berechtigung des Actors auf den Zielbereich voraus.

#### Scenario: Eigener Inhalt wird an anderen Benutzer übertragen

- **GIVEN** ein Benutzer besitzt `content.updateMetadata` mit Scope `own`
- **AND** ein Inhalt gehört diesem Benutzer über `ownerUserId`
- **WHEN** der Benutzer `ownerUserId` auf einen anderen gültigen Benutzer derselben Instanz ändert
- **THEN** erlaubt das System die Mutation ohne zusätzliche Zielbereich-Berechtigung
- **AND** anschließende Lesezugriffe werden anhand der neuen Ownership erneut autorisiert

#### Scenario: Organisationsinhalt wird in andere Organisation übertragen

- **GIVEN** ein Benutzer besitzt die passende Update-Permission auf einen Inhalt im aktuellen Organisationsscope
- **WHEN** der Benutzer `ownerOrganizationId` auf eine andere gültige Organisation ändert
- **THEN** entscheidet die Autorisierung über den aktuellen Inhalt vor der Änderung
- **AND** der Zielwert wird auf Existenz, Instanzzugehörigkeit und zulässigen Owner-Typ validiert

#### Scenario: Ownerloser Inhalt wird ohne globale Berechtigung zugewiesen

- **GIVEN** ein Inhalt besitzt weder `ownerUserId` noch `ownerOrganizationId`
- **AND** ein Benutzer besitzt nur `own`- oder `organization`-Scope
- **WHEN** der Benutzer dem Inhalt einen Owner zuweisen will
- **THEN** verweigert das System die Mutation
- **AND** nur eine passende globale Update-Berechtigung kann ownerlose Inhalte zuweisen

### Requirement: Sichtbare Autorenanzeige ist von Ownership getrennt

Das System SHALL die sichtbare Autorenanzeige eines Inhalts als fachliche Inhaltsmetadaten modellieren und strikt von technischer Ownership trennen.

`ownerUserId` und `ownerOrganizationId` SHALL ausschließlich Autorisierung und technische Zuständigkeit steuern. Die sichtbare Anzeige SHALL über einen validierten Autorenanzeige-Vertrag gesteuert werden, der mindestens zwischen Organisationsanzeige und persönlicher Anzeige unterscheidet.

#### Scenario: Inhalt wird mit Organisationsanzeige angelegt

- **GIVEN** ein Actor legt im aktiven Organisationskontext einen Inhalt an
- **WHEN** keine abweichende Autorenanzeige gewählt wird
- **THEN** setzt das System technische Ownership aus dem aktiven Kontext
- **AND** setzt die sichtbare Autorenanzeige standardmäßig auf die Organisation, sofern eine Organisation verfügbar ist

#### Scenario: Organisation erzwingt Organisationsanzeige

- **GIVEN** die aktive Organisation hat `content_author_policy = 'org_only'`
- **WHEN** ein Benutzer versucht, persönliche Autorenanzeige für einen Inhalt dieser Organisation zu speichern
- **THEN** weist das System die Änderung mit einem Validierungsfehler ab
- **AND** technische Ownership bleibt unverändert

#### Scenario: Persönliche Anzeige ist zulässig

- **GIVEN** die aktive Organisation hat `content_author_policy = 'org_or_personal'`
- **AND** der Actor ist für persönliche Anzeige im aktiven Kontext zulässig
- **WHEN** der Actor persönliche Autorenanzeige auswählt
- **THEN** speichert das System den Autorenanzeige-Modus getrennt von `ownerUserId` und `ownerOrganizationId`
- **AND** spätere Ownership-Änderungen ändern die sichtbare Autorenanzeige nicht stillschweigend ohne explizite Mutation
