## ADDED Requirements

### Requirement: Revisionssicherer Einzel- und Sammelnachweis für Rechtstext-Akzeptanzen

Das System SHALL für Rechtstext-Akzeptanzen exportierbare Einzel- und Sammelnachweise bereitstellen, die konsistent zur Auditspur bleiben. Audit-Records werden in einem vom operativen Logging-Pfad (OTEL → Loki) getrennten, persistenten Store gespeichert und sind unveränderlich.

#### Scenario: Einzel-Nachweis einer Akzeptanz

- **WHEN** ein Administrator den Nachweis einer konkreten Rechtstext-Akzeptanz anfordert
- **THEN** enthält der Nachweis mindestens: `workspace_id`, `subject_id` (OIDC `sub`-Claim, kein Klarname), `legal_text_id`, `legal_text_version`, `action_type` (`accepted` | `revoked` | `prompted`), Zeitpunkt, Ergebnis, `request_id` und `trace_id`
- **AND** der Nachweis bleibt konsistent zu den gespeicherten Audit- und Akzeptanzdaten

#### Scenario: Sammel-Export für Auditprüfung

- **WHEN** ein Administrator einen Zeitraum oder Filter für Rechtstext-Akzeptanzen exportiert
- **THEN** enthält der Export alle passenden Akzeptanz- und Widerrufsereignisse mit vollständigen Pflichtfeldern
- **AND** es entsteht kein Informationsverlust zwischen UI-Sicht, API-Export und Auditspur
- **AND** der Export enthält **keine** Klarnamen, E-Mail-Adressen oder andere PII-Felder außer `subject_id`

### Requirement: Zugriffsschutz für Rechtstext-Nachweis-Export

Das System MUST den Zugriff auf Rechtstext-Nachweis-Exporte auf Benutzer mit der Permission `legal-consents:export` beschränken.

#### Scenario: Export ohne ausreichende Permission

- **WHEN** ein Benutzer ohne die Permission `legal-consents:export` den Export-Endpunkt aufruft
- **THEN** antwortet das System mit HTTP 403
- **AND** kein Akzeptanz-Datensatz wird ausgeliefert

#### Scenario: Export-Rate-Limiting schützt vor Bulk-PII-Extraktion

- **WHEN** ein Benutzer den Export-Endpunkt in kurzer Folge mehrfach aufruft
- **THEN** greift ein Rate-Limit von max. 10 Exporten pro Stunde pro Benutzer
- **AND** überschreitende Anfragen erhalten HTTP 429 mit dokumentierter Retry-After-Angabe

### Requirement: Audit-Trail für Permission-Mutationen

Das System SHALL sicherheitsrelevante IAM-Mutationen revisionssicher protokollieren.

#### Scenario: Rollen-Permission wird geändert

- **WHEN** eine Rollen-Permission angelegt, geändert oder entfernt wird
- **THEN** wird ein Audit-Eintrag mit folgenden Feldern gespeichert: `workspace_id`, `actor_subject_id`, `target_role_id`, `action_type` (`permission_added` | `permission_modified` | `permission_removed`), `changed_fields`, Zeitpunkt, `request_id`, `trace_id`
- **AND** der Eintrag ist unveränderlich und exportierbar

#### Scenario: Gruppenberechtigungsentzug wird auditiert

- **WHEN** einem Benutzer eine Gruppenmitgliedschaft entzogen wird
- **THEN** wird ein Audit-Eintrag mit `action_type: membership_removed`, `workspace_id`, `actor_subject_id`, `target_subject_id`, `group_id`, Zeitpunkt, `request_id` gespeichert
- **AND** der Eintrag bleibt konsistent zur tatsächlichen Invalidation des Permission-Snapshots
