## Kontext

Das IAM speichert heute bereits Governance-Workflows, Betroffenenrechtsfälle, strukturierte Berechtigungen und zusätzliche Verwaltungsmetadaten. Die React-Anwendung zeigt davon aber nur einen kleinen Ausschnitt. Die fehlende Sichtbarkeit erschwert Betrieb, Support, Compliance und Debugging.

## Ziele / Nicht-Ziele

- Ziele:
  - Verdeckte IAM-Daten entlang realer Arbeitsabläufe sichtbar machen
  - Bestehende Admin-Seiten gezielt anreichern statt Rohdaten ungefiltert auszugeben
  - Compliance- und Governance-Daten für Administratoren und betroffene Nutzer nachvollziehbar darstellen
  - Bestehende API-Verträge soweit möglich wiederverwenden und nur dort schärfen, wo UI-Transparenz das verlangt
- Nicht-Ziele:
  - Keine neue fachliche Governance- oder DSR-Logik
  - Kein Ersatz der bestehenden IAM-Admin-Seiten durch ein komplett neues Backoffice
  - Keine Offenlegung geheimer Werte wie Mainserver-Secrets oder verschlüsselter Altwerte

## Entscheidungen

- Entscheidung: `/admin/iam` wird zum zentralen Transparenz-Cockpit mit Tabs für `Rechte`, `Governance` und `Betroffenenrechte`.
  - Begründung: Die bislang verborgenen Daten sind operativ eng verwandt und werden von denselben Admin-Rollen benötigt.
  - Alternative: Separate Routen pro Thema.
  - Verworfen, weil dies die Navigation zersplittert und den vorhandenen Einstiegspunkt `/admin/iam` entwertet.

- Entscheidung: Nutzer-Self-Service für DSGVO/Privacy wird unter `/account/privacy` statt im allgemeinen Profil verortet.
  - Begründung: Profilpflege und Datenschutzprozesse sind unterschiedliche Aufgaben mit anderem Risikoprofil.
  - Alternative: Zusätzlicher Tab auf `/account`.
  - Verworfen, weil das Profil bereits formularlastig ist und DSR-/Export-Status dort untergehen würden.

- Entscheidung: Versteckte Metadaten bleiben aufgabennah in bestehenden Screens.
  - Benutzerdetail: Avatar, Rollen-Gültigkeitsfenster, echte Historie
  - Rollen: externe Zuordnung, Management-Herkunft, Level, Sync-Details
  - Organisationen: Hierarchiepfad, Kindorganisationen, Metadata, Membership-Zeitpunkte
  - Kontext-Switcher: mehr Kontextinformationen ohne die Shell zu überladen

- Entscheidung: Sensible, aber nicht anzeigbare Daten werden weiter nur als Zustandsindikator gezeigt.
  - Beispiel: Secret-Werte bleiben write-only; die UI zeigt nur Konfigurationsstatus.

## Informationsarchitektur

- `/admin/iam`
  - Tab `Rechte`: strukturierte Effective Permissions, Resource-ID, Effect, Scope, Source Roles, Authorize-Diagnosen
  - Tab `Governance`: Permission-Change-Requests, Delegations, Impersonations, Legal-Text-Acceptances
  - Tab `Betroffenenrechte`: DSR-Requests, Export-Jobs, Legal Holds, Profile-Korrekturen, Empfänger-Benachrichtigungen
- `/account/privacy`
  - Eigene Anträge und Export-Jobs
  - Status, Fristen, Sperrgründe, optionale Verarbeitung / Opt-out
- Bestehende Screens
  - `/admin/users/:userId`: Avatar, Rollen-Gültigkeit, aussagekräftige Historie
  - `/admin/roles`: externe Rollenabbildung und Sync-Interna
  - `/admin/organizations`: Hierarchie- und Metadata-Detail
  - Header-Kontext-Switcher: Anzeige relevanter Organisationsmetadaten

## Risiken / Trade-offs

- Risiko: `/admin/iam` wird zu komplex.
  - Mitigation: Tab-Struktur, Filter, leere Zustände und progressive Offenlegung pro Datensatz

- Risiko: Zusätzliche Diagnosefelder könnten als zu technisch wahrgenommen werden.
  - Mitigation: Standardmäßig kompakte Labels, erweiterbare Detailpanels für rohe Diagnose- und Scope-Daten

- Risiko: DSR-Daten enthalten sensible Informationen.
  - Mitigation: Rollenbasierte Zugriffsgrenzen, PII-Minimierung in Listen, Detailansichten nur bei expliziter Drill-down-Aktion

## Migration Plan

1. API- und ViewModel-Lücken für strukturierte Transparenz schließen
2. Self-Service-Privacy-Seite und IAM-Cockpit-Routing ergänzen
3. Bestehende Admin-Seiten schrittweise anreichern
4. Tests und Doku pro Sicht ergänzen

## Open Questions

- Soll `/admin/iam` als eine Route mit Tabs oder zusätzlich mit deep-linkbaren Search-Params pro Tab umgesetzt werden?
- Soll die Nutzerhistorie nur `iam.activity_logs` zeigen oder zusätzlich Governance-/DSR-Ereignisse logisch zusammenführen?
