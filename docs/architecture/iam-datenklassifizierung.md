# IAM-Datenklassifizierung

## Ziel

Diese Übersicht klassifiziert alle IAM-Entitäten nach Schutzbedarf und definiert die verpflichtenden Schutzmaßnahmen.

## Schutzklassen

- **Vertraulich:** Personenbezug, Credentials oder sicherheitskritische Merkmale; verschlüsselte Speicherung verpflichtend.
- **Intern:** Betriebs- und Strukturdaten ohne direkten Personenbezug; Zugriff eingeschränkt, Verschlüsselung optional nach Risiko.
- **Öffentlich:** Daten mit geringem Schutzbedarf; keine vertraulichen Inhalte.

## Klassifizierungsmatrix

| Entität/Feld | Klasse | Begründung | Mindestmaßnahmen |
|---|---|---|---|
| `iam.accounts.keycloak_subject` | Intern | Technische Identitätsreferenz, aber sensitiver Schlüssel | Zugriffsbeschränkung, Audit bei Änderungen |
| `iam.accounts.email_ciphertext` | Vertraulich | Direkter Personenbezug (PII) | Application-Level Encryption, kein Klartext in Logs |
| `iam.accounts.display_name_ciphertext` | Vertraulich | Direkter Personenbezug (PII) | Application-Level Encryption, Datenminimierung |
| Session Tokens (Redis) | Vertraulich | Authentifizierungsrelevant | Token-Verschlüsselung, kurze TTL, kein Logging |
| `iam.activity_logs.payload` (PII-Anteile) | Vertraulich | Sicherheitsereignisse mit potenziell personenbezogenen Referenzen | Pseudonymisierung, keine Klartext-PII, Zugriffsgrenzen |
| `iam.instances`, `iam.organizations` Metadaten | Intern | Mandanten-/Strukturinformationen | RLS, Rollenmodell, Audit bei Mutationen |
| `iam.roles`, `iam.permissions` Namen/Keys | Öffentlich | Systemrollen und Berechtigungsdefinitionen | Integritätsschutz, versionierte Pflege |
| Zuordnungstabellen (`account_roles`, `account_organizations`, `role_permissions`) | Intern | Autorisierungsstruktur | RLS, Integrität über FK/Constraints |

## Operative Regeln

- Vertrauliche Felder werden ausschließlich als Ciphertext persistiert.
- Schlüsselmaterial liegt nie in der Datenbank.
- SQL-Direktzugriffe auf Vertraulich-Daten dürfen keine Klartextwerte liefern.
- Logs enthalten keine Klartext-E-Mail-Adressen, Tokens oder sonstige Credentials.
