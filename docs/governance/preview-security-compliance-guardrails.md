# Security- und Compliance-Leitplanken für Preview-Umgebungen

## Ziel und Geltungsbereich

Dieses Dokument definiert verbindliche, auditierbare Sicherheits- und Compliance-Regeln für Preview-Umgebungen im PR- und Branch-Workflow. Die Regeln gelten für beide Betriebsmodelle:

- Vercel (managed Preview-Plattform)
- Eigene Infrastruktur (self-hosted auf VM/Kubernetes mit eigener CI/CD)

Inhaltlicher Fokus: Secret-Handling, Zugriffsschutz, PII-Schutz, Datenquellen, Incident-Reaktion bei Secret-Leaks.

## Betriebsmodell

Die in diesem Dokument benannten Sicherheitsrollen sind Funktionsrollen. In fruehen Projektphasen kann dieselbe Verantwortungsgruppe mehrere dieser Rollen wahrnehmen, sofern Verantwortlichkeit, Freigaben und Incident-Dokumentation klar zuordenbar bleiben. Das Zielbild bleibt eine organisatorisch klar getrennte Security-Verantwortung bei wachsender Teamgroesse oder hoeherem Risikoprofil.

## Policy-Objekt (maschinenpruefbar)

```yaml
policy_version: 1
preview_security:
  secret_handling:
    source:
      vercel: github_secrets_only
      self_hosted: vault_only
    rotation:
      minimum_interval_days: 365
      event_triggered_rotation_on_leak: true
    scope:
      preview_specific_secrets_required: true
      production_keys_allowed_in_preview: false
    hardcoded_credentials:
      forbidden: true
      forbidden_locations:
        - source_code
        - config_files
        - environment_defaults
  access_control:
    default_auth:
      - basic_auth
      - github_sso
    public_preview:
      explicit_approval_required: true
      required_label: governance/preview-public-approved
    self_hosted_sensitive_data_requires_vpn: true
  pii_protection:
    allowed_data_classes:
      - test_data
      - sanitized_data
      - synthetic_data
    production_data_without_sanitization_forbidden: true
    violation_response:
      immediate_preview_destruction: true
      incident_report_deadline_hours: 2
  secret_leak_response:
    owner: security_team
    response_start_deadline_minutes: 60
    mandatory_actions:
      - rotate_exposed_secrets
      - audit_access_logs
      - document_scope_and_impact
```

## Regel 1: Secret-Quelle und Bereitstellung

- Für Vercel-Previews sind Secrets ausschließlich aus GitHub Secrets in die Deployment-Umgebung zu injizieren.
- Für self-hosted Previews sind Secrets ausschließlich über Vault-Integration bereitzustellen.
- Verbot: Speicherung von Secrets in Repository-Dateien, Build-Artefakten oder statischen `.env`-Defaults.
- Nachweis: Deployment-Template/CI-Config muss je Plattform die erlaubte Secret-Quelle explizit referenzieren.

## Regel 2: Rotation und Scope von Secrets

- Mindestrotation: Alle Preview-Secrets müssen mindestens alle `365` Tage rotiert werden.
- Ereignisgetriebene Rotation: Bei vermutetem oder bestätigtem Leak ist Rotation sofort ausgelöst (kein Warten auf Jahresintervall).
- Scope-Regel: Preview-Umgebungen dürfen nur preview-spezifische Secrets nutzen; Produktivschlüssel sind in Preview verboten.
- Verbot: Wiederverwendung von Production API Keys, Datenbank-Credentials oder Tokens in Preview.

## Regel 3: Hardcoded-Credentials-Policy (Zero Tolerance)

- Hardcoded Zugangsdaten sind ausnahmslos verboten.
- Das Verbot gilt für:
  - Quellcode
  - Konfigurationsdateien
  - Environment-Defaults und Templatewerte
- Jeder Fund wird als Security-Verstoß behandelt und blockiert den Merge bis zur Bereinigung.

## Regel 4: Zugriffsschutz fuer Preview-URLs

- Standardzugriff für Preview-URLs ist verpflichtend abgesichert durch `Basic Auth` oder `GitHub SSO`.
- Öffentliche Preview-URLs sind nur zulässig bei:
  - expliziter Freigabe,
  - Label `governance/preview-public-approved`,
  - dokumentierter Begründung im PR.
- Für self-hosted Previews mit sensitivem Datenbezug ist zusätzlich VPN-Zugang verpflichtend.

## Regel 5: PII-Schutz und Datenklassen in Preview

- Erlaubte Datenquellen in Preview:
  - Testdaten
  - sanitisierte Daten
  - synthetische Daten
- Produktivdaten ohne Sanitization/Anonymisierung sind in Preview strikt verboten.
- Jede Preview-Pipeline muss sicherstellen, dass nur freigegebene Datenklassen verarbeitet werden.

## Regel 6: Violation Response bei PII-Verstoss

- Bei festgestelltem PII-Verstoß gilt sofort:
  1. Preview-Umgebung unverzüglich zerstören,
  2. Incident erfassen,
  3. Incident-Report innerhalb von `2` Stunden veroeffentlichen.
- Mindestinhalt Incident-Report: Ursache, betroffene Datenklasse, Expositionspfad, Sofortmaßnahmen, Follow-up.

## Regel 7: Plattformspezifische Unterschiede

### Vercel-spezifisch

- Secret-Bereitstellung über Environment Variables aus GitHub Secrets.
- Rotation über Vercel Dashboard/API plus Aktualisierung der GitHub-Secrets-Quelle.
- Zugriffsschutz über Vercel-geeignete Auth-Layer (Basic Auth/GitHub SSO) vor Freigabe der Preview-URL.

### Self-hosted-spezifisch

- Secret-Bereitstellung über Vault-Integration (z. B. per Short-Lived Tokens oder Secret Injection bei Deploy).
- Rotation über automatisierte Pipeline-Jobs mit Vault als Source of Truth.
- Für sensitive Datenzugänge ist Netzwerkzugriff auf Preview-Runtimes via VPN zu erzwingen.

## Regel 8: Secret-Leak-Incident-Prozess

- Owner: `security_team` (verbindliche Verantwortung, keine offenen Zustandswechsel).
- Reaktionszeit: Start der Gegenmaßnahmen innerhalb von `1` Stunde nach Detection.
- Pflichtaktionen:
  - Exponierte Secrets rotieren,
  - Zugriffsprotokolle auditieren,
  - betroffene Systeme und Datenpfade dokumentieren,
  - Lessons Learned in Governance-Backlog uebernehmen.

Hinweis: Ist `security_team` in einer fruehen Projektphase noch keine eigenstaendige organisatorische Einheit, wird die Rolle durch die benannte Sicherheits-Verantwortung innerhalb der Maintainer-Struktur wahrgenommen.

## Audit-Nachweise (Minimum)

- Policy-Compliance fuer jede Preview-Aenderung muss in PR-Artefakten nachvollziehbar sein.
- Pflichtnachweise:
  1. genutzte Secret-Quelle je Plattform,
  2. letzte Rotation und Scope-Zuordnung,
  3. Access-Control-Modus der Preview-URL,
  4. Datenklasse der verwendeten Preview-Daten.

## Referenzen

- `DEVELOPMENT_RULES.md`
- `docs/governance/preview-platform-comparison.md`
- `docs/architecture/07-deployment-view.md`
