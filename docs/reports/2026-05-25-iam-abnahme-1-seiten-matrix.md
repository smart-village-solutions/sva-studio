# IAM-Abnahme: 1-Seiten-Matrix Angebot zu Nachweis

Stand: `2026-05-25`

| Angebots-Paket | führende Workpackages | tragender Report | Vorführschritt im Termin | offener Restpunkt | Einschätzung `grün`, `gelb` |
| --- | --- | --- | --- | --- | --- |
| Architektur & Basis-IAM-Inkrement | `WP-001` | [wp-001-auth-mandantenfaehigkeit-abnahme-2026-05-25.md](./wp-001-auth-mandantenfaehigkeit-abnahme-2026-05-25.md) | Login-Einstieg, erfolgreicher Anmeldezustand, Tenant-Scope | optionaler archivierter Zielumgebungslauf für Delivery-Gate | grün |
| Accounts & Profile | `WP-002` | [wp-002-benutzer-accounts-profile-abnahme-2026-05-25.md](./wp-002-benutzer-accounts-profile-abnahme-2026-05-25.md) | Benutzerliste, Benutzerdetail, Organisationszuordnung, Profilpfad | optionaler kompletter Acceptance-Runner in Zielumgebung | grün |
| Organisation & Hierarchie | `WP-003` | [wp-003-organisation-struktur-abnahme-2026-05-25.md](./wp-003-organisation-struktur-abnahme-2026-05-25.md) | Parent-Child-Anlage, Re-Zuordnung, Hierarchiepfad | archivierter Zielumgebungs-Smoke-Test gemäß [wp-003-zielumgebungs-smoke-test-protokoll-2026-05-25.md](./wp-003-zielumgebungs-smoke-test-protokoll-2026-05-25.md) | gelb |
| Permission Engine & Authorize-Performance | `WP-004` | [wp-004-permission-engine-abnahme-2026-05-25.md](./wp-004-permission-engine-abnahme-2026-05-25.md) | zentraler `/iam/authorize`-Pfad, Cache, Invalidation, Performance-Nachweis | kein repo-seitiger Pflichtrestpunkt | grün |
| Rollen, Gruppen & Vererbungen | `WP-005` | [wp-005-rollen-rechte-keycloak-abnahme-2026-05-25.md](./wp-005-rollen-rechte-keycloak-abnahme-2026-05-25.md) | vier Konfliktfälle: Mehrfachherkunft, inaktive Gruppe, Gültigkeitsfenster, Geo Parent-Allow/Child-Deny | normierte Zielumgebungs-Evidence der vier Fälle | gelb |
| Datenschutz & Compliance | `WP-006` | [wp-006-datenschutz-compliance-abnahme-2026-05-25.md](./wp-006-datenschutz-compliance-abnahme-2026-05-25.md) | Consent-Enforcement, Exportpfad, PII-Schutz | echter E2E-Lauf für Consent/Export plus Negativfall, gebündelt in [wp-006-consent-enforcement-export-nachweis-2026-05-25.md](./wp-006-consent-enforcement-export-nachweis-2026-05-25.md) | gelb |
| Rechtstexte & Akzeptanzsystem | `WP-010` | [wp-010-rechtstexte-abnahme-2026-05-25.md](./wp-010-rechtstexte-abnahme-2026-05-25.md) | Rechtstext-Verwaltung, blockierender Akzeptanzflow, sicherer Rücksprung | Zielumgebungs-E2E und Export-Negativnachweis; führende Evidence identisch zu `WP-006` | gelb |
