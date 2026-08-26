# Dossier 10: IAM und Datenschutzfälle

## `admin.iam.overview` – IAM Transparenz-Cockpit

- **Route / Typ / Owner:** `/admin/iam`, Übersicht, Host.
- **Nutzerziel:** Wirksame Rechte, Governance-Fälle, Datenschutzfälle und tenantweite Löschregeln
  nachvollziehen.
- **Produktfakten:** Tabs sind Rechte, Governance, Datenschutz und Löschregeln. Rechte lassen sich
  nach Organisation, handelndem Kontext und Suchbegriff filtern; ein konkreter Authorize-Request
  kann geprüft werden. Governance-Fälle können gefiltert und als CSV exportiert werden.
  Datenschutzfälle zeigen Typ, kanonischen Status, Personen und Blocker. Löschregeln steuern
  Fristen, Inhaltsstrategie und persönliche Überschreibbarkeit.
- **Kontextabhängig:** Das Cockpit kann per Feature-Flag deaktiviert sein. Rolle und erlaubte Tabs
  bestimmen, welche Bereiche sichtbar sind; Löschregeln können nur lesbar sein.
- **Leitfragen / Stichwörter:** Was ist wirksames Recht, Quelle und Scope? Welche Sicht ist
  Self-Service, welche administrativ? IAM, Authorize, Governance, Datenschutz, Löschregel.
- **Evidenz:** `routes/admin/-iam-page.tsx`, `routes/admin/-iam.models.ts`,
  `i18n/resources/de/admin/iam.resources.ts`.

## `admin.iam.governance-detail` – IAM-Prüffall verwalten

- **Route / Typ / Owner:** `/admin/iam/governance/$caseId`, Detail, Host.
- **Nutzerziel:** Status, Beteiligte, Ticketbezug und Metadaten eines Governance-Falls prüfen.
- **Produktfakten:** Falltypen sind Rechteänderung, Delegation, Impersonation und
  Rechtstext-Akzeptanz. Angezeigt werden Zusammenfassung, Rohstatus, Typ, Ticket, auslösende und
  betroffene Person, Erstellungs- und Änderungszeit sowie Metadaten. Die aktuelle Detailseite ist
  eine Prüfsicht ohne sichtbare Statusmutation.
- **Kontextabhängig:** Feature-Flag, Cockpitrolle und Tabfreigabe müssen vorliegen.
- **Leitfragen / Stichwörter:** Welche externe Bearbeitung ist für offene Fälle vorgesehen? Welche
  Metadaten sind redaktionell erklärbar? Governance-Fall, Delegation, Impersonation, Ticket.
- **Evidenz:** `routes/admin/-iam-governance-detail-page.tsx`,
  `i18n/resources/de/admin/iam.resources.ts`.

## `admin.iam.dsr-detail` – Datenschutzanfrage verwalten

- **Route / Typ / Owner:** `/admin/iam/dsr/$caseId`, Detail, Host.
- **Nutzerziel:** Einen administrativen Datenschutzfall einschließlich Beteiligter und Blocker
  prüfen.
- **Produktfakten:** Angezeigt werden Titel, Zusammenfassung, Typ, kanonischer und roher Status,
  betroffene sowie anfragende Person, Erstellungs- und Abschlusszeit, Blocker und Metadaten.
  Falltypen umfassen Anfrage, Export, rechtliche Sperre, Profilkorrektur und
  Empfängerbenachrichtigung. Die aktuelle Seite zeigt keine sichtbare Bearbeitungsaktion.
- **Kontextabhängig:** Feature-Flag, Cockpitrolle und Datenschutz-Tabfreigabe sind erforderlich.
- **Leitfragen / Stichwörter:** Wo findet die eigentliche Fallbearbeitung statt? Welche Blocker
  dürfen in der Anwenderhilfe beschrieben werden? DSR, Datenschutzfall, Betroffene, Antragsteller,
  Blocker.
- **Evidenz:** `routes/admin/-iam-dsr-detail-page.tsx`,
  `i18n/resources/de/admin/iam.resources.ts`.
