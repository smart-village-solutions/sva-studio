# M1 Abnahme-Map für die restlichen Arbeitspakete

## Zweck

Diese Datei bereitet eine einfache, wiederverwendbare Struktur für schnelle Abnahmen aller Arbeitspakete aus Meilenstein 1 vor. Sie ist kein vollwertiges Governance-Paket, sondern eine Arbeitsgrundlage, um die verbleibenden WPs zügig auf `acceptance` zu ziehen.

## Empfohlene Minimalstruktur je WP

Für jedes Arbeitspaket reicht im Schnellpfad zunächst genau eine kurze Nachweisdatei:

- Pfad: `docs/reports/wp-0xx-<slug>-abnahme-YYYY-MM-DD.md`
- Inhalt:
  - Zweck
  - Scope / Prüfpunkte
  - Ergebnis
  - Kurzprotokoll als Tabelle
  - Repo-seitige Stützbelege
  - Restlücken
  - Entscheidung für den Projektstatus

Optional, wenn echte Laufprotokolle vorliegen:

- zusätzlicher Pfad: `docs/staging/2026-05/wp-0xx-<slug>-testprotokoll-2026-05-25.md`

## Schnellbewertung nach WP

| WP | Titel | Empfohlene Nachweisdatei | Minimaler Inhalt für schnelle Abnahme |
| --- | --- | --- | --- |
| WP-001 | Authentifizierung und Sicherheit unter Berücksichtigung von Mandantenfähigkeit | `docs/reports/wp-001-auth-mandantenfaehigkeit-abnahme-2026-05-25.md` | Realm, Clients, Login, OIDC-Claims, Tenant-Scope |
| WP-002 | Benutzer-Accounts und Profile mit Organisations-Hierarchie | `docs/reports/wp-002-benutzer-accounts-profile-abnahme-2026-05-25.md` | Benutzer anlegen/lesen/bearbeiten, Organisationszuordnung, Profilpfad |
| WP-003 | Organisation und Struktur | `docs/reports/wp-003-organisation-struktur-abnahme-2026-05-25.md` | Hierarchie anlegen, Eltern-Kind-Zuordnung, Sichtbarkeit im UI |
| WP-004 | Permission Engine | `docs/reports/wp-004-permission-engine-abnahme-2026-05-25.md` | korrekte Authorize-Entscheidung, Cache-Hit/-Miss, Invalidation |
| WP-005 | Rollen- und Rechtemanagement via KeyCloak | `docs/reports/wp-005-rollen-rechte-keycloak-abnahme-2026-05-25.md` | Rolle pflegen, Sync, Zuweisung, wirksame Rechte |
| WP-006 | Datenschutz und Compliance | `docs/reports/wp-006-datenschutz-compliance-abnahme-2026-05-25.md` | vorhandene Matrix bündeln, Restlücke knapp benennen |
| WP-007 | Audit-Log | `docs/reports/wp-007-audit-log-abnahme-2026-05-25.md` | Audit-Ereignisse, Zugriffsschutz, Export-/Nachweisfähigkeit |
| WP-008 | Datenlöschkonzept | `docs/reports/wp-008-datenloeschkonzept-abnahme-2026-05-25.md` | Löschregeln, Retention, Ausführbarkeit, Doku |
| WP-009 | Nachrichten (MVP) | `docs/reports/wp-009-nachrichten-mvp-abnahme-2026-05-25.md` | erstellen, bearbeiten, veröffentlichen, anzeigen |
| WP-010 | Rechtstexte | `docs/reports/wp-010-rechtstexte-abnahme-2026-05-25.md` | Versionierung, Akzeptanz, Export, Erzwingung |
| WP-011 | Basis-UI & Navigation | `docs/reports/wp-011-basis-ui-navigation-abnahme-2026-05-25.md` | Kernrouten, Navigation, Guards, UI-Grundfluss |
| WP-012 | E-Mail-Server | `docs/reports/wp-012-e-mail-server-abnahme-2026-05-25.md` | Versandpfad, Zustellversuch, Fehlerpfad |
| WP-013 | Keycloak | `docs/reports/wp-013-keycloak-abnahme-2026-05-25.md` | Realm, Clients, Admin-Verbindung, Betriebsfähigkeit |
| WP-014 | Main-Server | `docs/reports/wp-014-main-server-abnahme-2026-05-25.md` | relevante API-/Laufzeitpfade erreichbar |
| WP-015 | OTEL | `docs/reports/wp-015-otel-abnahme-2026-05-25.md` | Exportpfad, Telemetriefluss, Redaction-Grundprüfung |
| WP-016 | Grafana | `docs/reports/wp-016-grafana-abnahme-2026-05-25.md` | Dashboard erreichbar, Datasource, zentrale Panels |
| WP-017 | Loki | `docs/reports/wp-017-loki-abnahme-2026-05-25.md` | Log-Ingestion, Suche, Labels, Grundbetrieb |
| WP-018 | News-Modul | `docs/reports/wp-018-news-modul-abnahme-2026-05-25.md` | Übersicht, Detail, Bearbeitung, Veröffentlichung |
| WP-019 | Dokumentation der Funktionalitäten und Entwicklungen des Moduls | `docs/reports/wp-019-dokumentation-modul-abnahme-2026-05-25.md` | Doku vollständig genug für Betrieb und Übergabe |
| WP-020 | Monitoringsystem | `docs/reports/wp-020-monitoringsystem-abnahme-2026-05-25.md` | OTEL, Grafana, Loki, Jobsicht zusammengeführt |
| WP-021 | Redaktion über die App | `docs/reports/wp-021-redaktion-ueber-die-app-abnahme-2026-05-25.md` | redaktioneller End-to-End-Flow über die App |

## Empfohlene Reihenfolge

Wenn es schnell gehen soll, ist diese Reihenfolge sinnvoll:

1. WPs mit vorhandener starker Repo-Evidenz oder bereits bestätigtem Acceptance-Lauf dokumentieren.
2. WPs mit vorhandenem Bericht oder vorhandener Nachweismatrix auf eine kurze Abnahmedatei verdichten.
3. WPs mit noch fehlendem Laufprotokoll zuletzt nachziehen.

## Gute Kandidaten für den nächsten schnellen Durchlauf

Aus dem aktuellen Stand wirken diese Pakete am ehesten kurzfristig dokumentierbar:

- `WP-002`
- `WP-003`
- `WP-004`
- `WP-005`
- `WP-010`
- `WP-015`
- `WP-016`
- `WP-017`
- `WP-018`
- `WP-020`

## Arbeitsregel

Sobald pro WP eine kurze Abnahmedatei mit klarer Entscheidung vorliegt, kann die Einstufung im Projektstatus pragmatisch auf `acceptance` gezogen werden, solange keine bekannte fachliche Restblockade besteht.
