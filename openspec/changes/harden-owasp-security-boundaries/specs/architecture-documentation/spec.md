## ADDED Requirements

### Requirement: Normative Sicherheitsrichtlinien benennen implementierte Kontrollpunkte

Die bestehende normative Security-Checkliste MUST das tatsächliche zentrale Studio-Modell aus Keycloak/OIDC, expliziter JWT-/Account-/Permission-Prüfung, Redis-Sessions und PostgreSQL beschreiben. Sie MUST CSRF-, Datenbank-, Upload-, Budget- und Headerkontrollen den zuständigen Implementierungen beziehungsweise Nachweisen zuordnen und MUST optionale Supabase-Integrationen davon unterscheiden. Sie MUST bestehende Sicherheitsanforderungen erhalten und MUST keine automatische Schutzwirkung eines nicht zuständigen Providers behaupten.

#### Scenario: CSRF und Authentifizierung werden anhand der realen Runtime geprüft

- **WHEN** ein Entwickler die Security-Checkliste für zentrale Studio-Endpunkte verwendet
- **THEN** verweist sie auf die tatsächlichen Custom-Header-/Origin-, OIDC-/JWT-, Account- und Session-Prüfungen
- **AND** behauptet sie keinen automatisch durch Supabase gewährleisteten zentralen Auth- oder CSRF-Schutz
- **AND** bleiben tatsächlich vorhandene optionale Supabase-Schnittstellen als Integrationen beschrieben

#### Scenario: Sicherheitskorrekturen werden in vorhandenen Quellen dokumentiert

- **WHEN** ein Lieferabschnitt Kontosperre, Body-Limit, DOI-Prüfung, Geocoding-Transport/-Budget oder Headervertrag ändert
- **THEN** werden betroffene normative Aussagen und aktuelle Referenzen im selben Abschnitt angepasst
- **AND** bleiben technische Auslieferung, direkte Fix-Evidenz und produktive Abnahme getrennte Angaben
- **AND** entsteht keine konkurrierende Security-Checkliste oder Rollout-Anleitung
