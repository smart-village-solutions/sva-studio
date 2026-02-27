# Seed-Matrix: 7 Personas (erster Aufschlag, anpassbar)

## Ziel

Diese Matrix definiert einen deterministischen Seed-Startzustand fuer Task `3.1` in `add-iam-core-data-layer`.
Sie ist absichtlich als editierbarer Entwurf aufgebaut und kann vor Implementierung von Child C/D fachlich nachgeschaerft werden.

## Leitplanken fuer Anpassungen

- Persona-Keys (`persona_key`) bleiben stabil, damit Upserts und Tests nicht brechen.
- Konkrete Permission-Zuordnungen bleiben als Startprofile modelliert und koennen zur Laufzeit im SVA Studio angepasst werden.
- IDs und Seed-Emails sind deterministisch; keine zufaelligen Werte pro Lauf erzeugen.

## Persona-Matrix (Draft v0)

| persona_key | display_name | role_slug | scope_default | cross_tenant | mfa_policy | permission_profile_seed | seed_account_email |
|---|---|---|---|---|---|---|---|
| system_admin | System-Administrator:in | system-admin | instance | nein | required | starter_system_admin | seed.system-admin@sva.local |
| app_manager | App-Manager:in | app-manager | instance | nein | recommended | starter_app_manager | seed.app-manager@sva.local |
| feature_manager | Feature-Manager:in | feature-manager | instance | nein | recommended | starter_feature_manager | seed.feature-manager@sva.local |
| interface_manager | Schnittstellen-Manager:in | interface-manager | instance | nein | recommended | starter_interface_manager | seed.interface-manager@sva.local |
| designer | Designer:in | designer | org | nein | optional | starter_designer | seed.designer@sva.local |
| editor | Redakteur:in | editor | org | nein | optional | starter_editor | seed.editor@sva.local |
| moderator | Moderator:in | moderator | org | nein | optional | starter_moderator | seed.moderator@sva.local |

## Deterministische Identitaeten

- `instance_id`: aus festem `instance_key` (z. B. `seed-instance-default`)
- `organization_id`: aus festem `organization_key` (z. B. `seed-org-default`)
- `account_id` je Persona: aus `persona_key`
- Empfehlung: UUID v5 mit stabiler Namespace-UUID und Schluessel `iam:<entity>:<key>`

Beispielschluessel:

- `iam:instance:seed-instance-default`
- `iam:organization:seed-org-default`
- `iam:account:system_admin`

## Idempotenz-Regeln fuer 3.1

1. `roles`: Upsert ueber `(instance_id, slug)`
2. `permissions`: Upsert ueber `(instance_id, key)`
3. `accounts`: Upsert ueber `(instance_id, email)`
4. `instance_memberships`: Upsert ueber `(instance_id, account_id)`
5. `account_organizations`: Upsert ueber `(instance_id, account_id, organization_id)`
6. `account_roles`: Upsert ueber `(instance_id, account_id, role_id)`
7. `role_permissions`: Upsert ueber `(instance_id, role_id, permission_id)`

Technik:

- SQL: `INSERT ... ON CONFLICT (...) DO UPDATE SET updated_at = NOW()`
- Seed-Lauf in einer Transaktion je `instance_id`
- Seed-Lauf ist mehrfach ausfuehrbar ohne Dubletten oder Drift

## Offene Anpassungspunkte vor finaler Umsetzung

- Sollen `content_creator` oder `decision_maker` eine der 7 Start-Personas ersetzen?
- Braucht `support_admin` bereits in Child B einen Seed-Default (fuer spaetere Impersonation-Workflows)?
- Sollen `designer/editor/moderator` immer org-gebunden sein oder optional instanzweite Rollen bekommen?

## Definition of Done fuer Task 3.1

- 7 Personas aus dieser Matrix sind als Seed-Datensaetze idempotent einspielbar.
- Wiederholte Seed-Ausfuehrung erzeugt keine Dubletten.
- IDs, Slugs und Seed-Emails bleiben stabil zwischen Runs.
- Grundlage fuer Tests in Task `3.3` ist dokumentiert.
