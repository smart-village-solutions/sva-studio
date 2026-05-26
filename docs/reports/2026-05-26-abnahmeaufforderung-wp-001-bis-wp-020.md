# Abnahmeaufforderung für die Arbeitspakete WP-001 bis WP-020

Stand: `2026-05-26`

## Anlass und Ziel

Dieses Dokument dient der Abnahmeaufforderung für die Arbeitspakete `WP-001` bis `WP-020` gemäß `https://smart-village-solutions.github.io/sva-studio/?view=work-packages&milestone=M1` im Stand vom `2026-05-26`.

Die nachfolgende Übersicht beschreibt je Arbeitspaket den gelieferten Funktionsumfang und benennt einen Prüfweg. Als Nachweise dienen entweder konkrete Unterseiten der Sandbox-Instanz unter `https://de-studio-sandbox.studio.smart-village.app/` oder die zugehörige Dokumentation und Nachweisführung im Repository unter `docs/`.

Die Gliederung folgt einer Reihenfolge, in der Anmelde-, Verwaltungs-, Inhalts- und Betriebsfunktionen nacheinander geprüft werden können.

## Strukturierte Abnahmeschritte

### Schritt 1: IAM-Basis und Benutzerverwaltung

#### `WP-001` Authentifizierung und Sicherheit unter Berücksichtigung von Mandantenfähigkeit

`Leistungsstand:` Das Arbeitspaket umfasst den Login-Pfad, die Session-Führung und die mandantenbezogene Scope-Auflösung. Ein Benutzer wird über den konfigurierten Anmeldepfad authentifiziert und nach erfolgreicher Anmeldung in einen geschützten Studio-Bereich zurückgeführt. Geschützte Verwaltungsbereiche werden nur mit gültiger Sitzung und im aufgelösten Mandantenkontext geöffnet.

`Prüfweg:` Anmeldung über `https://de-studio-sandbox.studio.smart-village.app/auth/login` starten, erfolgreichen Login durchführen und anschließend einen geschützten Verwaltungsbereich öffnen. Erwartetes Ergebnis: erfolgreicher Rücksprung in die Anwendung, sichtbarer eingeloggter Zustand und Zugriff auf den Verwaltungsbereich ohne erneute Anmeldung.

`Repo-Nachweis:` [wp-001-auth-mandantenfaehigkeit-abnahme-2026-05-25.md](./wp-001-auth-mandantenfaehigkeit-abnahme-2026-05-25.md), [iam-acceptance-runbook.md](../guides/iam-acceptance-runbook.md)

#### `WP-002` Benutzer-Accounts und Profile mit Organisations-Hierarchie

`Leistungsstand:` Das Arbeitspaket umfasst Benutzerliste, Benutzerdetail, Organisationszuordnung und Self-Service-Profil. Benutzerkonten können im Mandantenkontext angezeigt, bearbeitet und deaktiviert werden. Zusätzlich steht für angemeldete Benutzer ein Profilpfad zur Verfügung, in dem eigene Profildaten angezeigt und bearbeitet werden können.

`Prüfweg:` In `https://de-studio-sandbox.studio.smart-village.app/admin/users` die Benutzerliste öffnen, ein Benutzerdetail aufrufen und die Organisationszuordnung prüfen. Danach unter `https://de-studio-sandbox.studio.smart-village.app/account` den Profilpfad öffnen. Erwartetes Ergebnis: Benutzerdaten sind lesbar, Organisationszuordnungen werden angezeigt und der Profilpfad zeigt die eigenen Stammdaten.

`Repo-Nachweis:` [wp-002-benutzer-accounts-profile-abnahme-2026-05-25.md](./wp-002-benutzer-accounts-profile-abnahme-2026-05-25.md), [iam-service-api-dokumentation.md](../guides/iam-service-api-dokumentation.md)

#### `WP-003` Organisation und Struktur

`Leistungsstand:` Das Arbeitspaket umfasst die Verwaltung hierarchischer Organisationen mit Parent-Child-Beziehungen. Organisationsdatensätze können angezeigt und organisatorische Beziehungen im Verwaltungsmodell nachvollzogen werden. Die Hierarchie dient als Grundlage für Zuordnungen und weitere Verwaltungsfunktionen.

`Prüfweg:` Unter `https://de-studio-sandbox.studio.smart-village.app/admin/organizations` die Organisationsübersicht und mindestens ein Detail öffnen. Erwartetes Ergebnis: Organisationen werden mit ihren Hierarchiebezügen angezeigt und Parent-Child-Beziehungen sind in Liste oder Detail nachvollziehbar.

`Repo-Nachweis:` [wp-003-organisation-struktur-abnahme-2026-05-25.md](./wp-003-organisation-struktur-abnahme-2026-05-25.md), [iam-organization-management-verification-2026-03-09.md](./iam-organization-management-verification-2026-03-09.md)

### Schritt 2: Autorisierung, Rollen und Rechte

#### `WP-004` Permission Engine

`Leistungsstand:` Das Arbeitspaket umfasst den zentralen Autorisierungspfad einschließlich Rechteauswertung, Cache-Nutzung und Invalidierung. Berechtigungsentscheidungen werden aus Rollen, Gruppen, Direktrechten und Kontextinformationen abgeleitet. Für den Rechtepfad liegen zusätzlich gesonderte Nachweise zur Performance des Cache-Hit-Szenarios vor.

`Prüfweg:` Im IAM-Cockpit unter `https://de-studio-sandbox.studio.smart-village.app/admin/iam?tab=rights` die Rechteansicht öffnen. Erwartetes Ergebnis: Rechte werden geordnet angezeigt und ihre Herkunft ist in der Ansicht nachvollziehbar. Der Performance-Nachweis erfolgt ergänzend über den verlinkten Repo-Report.

`Repo-Nachweis:` [wp-004-permission-engine-abnahme-2026-05-25.md](./wp-004-permission-engine-abnahme-2026-05-25.md), [wp-004-permission-engine-performance-nachweis-2026-05-25.md](./wp-004-permission-engine-performance-nachweis-2026-05-25.md)

#### `WP-005` Rollen- und Rechtemanagement via Keycloak

`Leistungsstand:` Das Arbeitspaket umfasst die Verwaltung von Rollen und Gruppen einschließlich direkter und vererbter Berechtigungen. Rollendetails, Gruppenzuordnungen und Rechteherkunft sind in der Admin-Oberfläche einsehbar. Die Rechteauflösung berücksichtigt Organisations- und Geo-Bezüge gemäß dem dokumentierten Rollenmodell.

`Prüfweg:` Unter `https://de-studio-sandbox.studio.smart-village.app/admin/roles` Rollenübersicht und Rollendetails öffnen, anschließend unter `https://de-studio-sandbox.studio.smart-village.app/admin/groups` Gruppen und deren Zuordnungen prüfen. Erwartetes Ergebnis: Rollen, Gruppen und Rechtezuordnungen sind sichtbar; direkte und vererbte Rechte lassen sich ergänzend im Rechte-Cockpit unter `https://de-studio-sandbox.studio.smart-village.app/admin/iam?tab=rights` nachvollziehen.

`Repo-Nachweis:` [wp-005-rollen-rechte-keycloak-abnahme-2026-05-25.md](./wp-005-rollen-rechte-keycloak-abnahme-2026-05-25.md), [keycloak-rollen-sync-runbook.md](../guides/keycloak-rollen-sync-runbook.md)

### Schritt 3: Datenschutz, Governance und Rechtstexte

#### `WP-006` Datenschutz und Compliance

`Leistungsstand:` Das Arbeitspaket umfasst mandantenbezogene Datenschutz- und Governance-Pfade, Pflichtzustimmungen sowie berechtigungsgebundene Einsichts- und Exportpfade. Datenschutzinformationen, Governance-Sichten und Consent-Nachweise sind als getrennte Funktionspfade dokumentiert. Für Consent-Enforcement und Export liegen ergänzende Einzelberichte vor.

`Prüfweg:` Das Datenschutz- und Governance-Cockpit unter `https://de-studio-sandbox.studio.smart-village.app/admin/iam?tab=governance` sowie den Privacy-Pfad unter `https://de-studio-sandbox.studio.smart-village.app/account/privacy` öffnen. Erwartetes Ergebnis: Datenschutz- und Governance-Informationen sind getrennt aufrufbar, im Mandantenkontext sichtbar und den vorgesehenen Rollenpfaden zugeordnet.

`Repo-Nachweis:` [wp-006-datenschutz-compliance-abnahme-2026-05-25.md](./wp-006-datenschutz-compliance-abnahme-2026-05-25.md), [wp-006-consent-enforcement-export-nachweis-2026-05-25.md](./wp-006-consent-enforcement-export-nachweis-2026-05-25.md)

#### `WP-007` Audit-Log

`Leistungsstand:` Das Arbeitspaket umfasst die Protokollierung und Auswertbarkeit sicherheits- und governance-relevanter Vorgänge. Die Nachweisführung ist über Audit- und Governance-Dokumentation beschrieben; ein eigenständiger UI-Pfad nur für das Audit-Log ist im Studio nicht vorgesehen. Der Nachweis erfolgt daher primär über die dokumentierten Daten- und Exportpfade.

`Prüfweg:` Führender Prüfweg ist der Repo-Nachweis über [iam-governance-runbook.md](../guides/iam-governance-runbook.md) und [05-building-block-view.md](../architecture/05-building-block-view.md). Ergänzend kann unter `https://de-studio-sandbox.studio.smart-village.app/admin/iam?tab=governance` geprüft werden, dass Governance-Sichten vorhanden sind. Erwartetes Ergebnis: Die Audit- und Governance-Pfade sind dokumentiert, Auswertungspfade benannt und den Verwaltungsfunktionen zugeordnet.

`Repo-Nachweis:` [iam-governance-runbook.md](../guides/iam-governance-runbook.md), [05-building-block-view.md](../architecture/05-building-block-view.md)

#### `WP-008` Datenlöschkonzept

`Leistungsstand:` Das Arbeitspaket umfasst DSR-Pfade, Löschkontexte und dokumentierte Retention-Abläufe. Benutzerseitige Datenschutzfunktionen und administrative Bearbeitungspfade sind getrennt beschrieben. Die operative Retention-Ausführung ist ergänzend über die Repository-Dokumentation nachgewiesen.

`Prüfweg:` Unter `https://de-studio-sandbox.studio.smart-village.app/account/privacy` den benutzerseitigen Datenschutzpfad und unter `https://de-studio-sandbox.studio.smart-village.app/admin/iam?tab=dsr` die administrativen DSR-Sichten aufrufen. Erwartetes Ergebnis: Datenschutzanliegen sind sowohl aus Nutzer- als auch aus Bearbeitungssicht erreichbar; Retention- und Löschabläufe sind über die Repo-Nachweise spezifiziert.

`Repo-Nachweis:` [iam-data-subject-rights-runbook.md](../guides/iam-data-subject-rights-runbook.md), [iam-retention-automation.md](../guides/iam-retention-automation.md)

#### `WP-010` Rechtstexte

`Leistungsstand:` Das Arbeitspaket umfasst die Verwaltung versionierter Rechtstexte, Pflichtakzeptanzen und die zugehörige Nachweisführung. Rechtstext-Versionen können angezeigt und verwaltet werden; für Akzeptanz- und Exportpfade liegen ergänzende Einzelberichte vor. Die Akzeptanzprotokollierung ist über die verlinkten Nachweise beschrieben.

`Prüfweg:` Unter `https://de-studio-sandbox.studio.smart-village.app/admin/legal-texts` die Rechtstext-Verwaltung öffnen und vorhandene Versionen prüfen. Erwartetes Ergebnis: mehrere Rechtstext-Versionen sind sichtbar und als verwaltbare Einträge dargestellt. Ergänzende Prüfungen zu Akzeptanz und Export erfolgen über die verlinkten Repo-Nachweise.

`Repo-Nachweis:` [wp-010-rechtstexte-abnahme-2026-05-25.md](./wp-010-rechtstexte-abnahme-2026-05-25.md), [iam-governance-runbook.md](../guides/iam-governance-runbook.md)

### Schritt 4: Redaktions- und Bedienpfade

#### `WP-009` Nachrichten (MVP)

`Leistungsstand:` Das Arbeitspaket umfasst die generische Inhaltsverwaltung als ersten redaktionellen Bearbeitungspfad. Im Fokus steht die Basis für strukturierte Inhaltseinträge im Verwaltungsbereich. Es beschreibt den allgemeinen Inhaltszugang, nicht das fachlich spezialisierte News-Modul.

`Prüfweg:` Unter `https://de-studio-sandbox.studio.smart-village.app/admin/content` die allgemeine Inhaltsübersicht öffnen. Erwartetes Ergebnis: Inhaltsobjekte werden als generische Verwaltungsliste angezeigt und können als Ausgangspunkt redaktioneller Bearbeitung identifiziert werden.

`Repo-Nachweis:` [content-management-core-contract.md](../guides/content-management-core-contract.md), [04-solution-strategy.md](../architecture/04-solution-strategy.md)

#### `WP-011` Basis-UI & Navigation

`Leistungsstand:` Das Arbeitspaket umfasst Shell, Navigation, Breadcrumbs und die Grundstruktur der Verwaltungsoberfläche. Die wesentlichen Funktionsbereiche sind über eine einheitliche Navigation erreichbar. Seitenwechsel zwischen Inhalts-, Verwaltungs- und Monitoring-Bereichen folgen demselben Oberflächenmodell.

`Prüfweg:` Startseite, Inhaltsbereich und Monitoring unter `https://de-studio-sandbox.studio.smart-village.app/`, `https://de-studio-sandbox.studio.smart-village.app/admin/content` und `https://de-studio-sandbox.studio.smart-village.app/monitoring` aufrufen. Erwartetes Ergebnis: die Bereiche sind über die Navigation erreichbar und Breadcrumbs bzw. Seitenstruktur bleiben zwischen den Bereichen konsistent.

`Repo-Nachweis:` [ui-shell-theming-verification-2026-03-09.md](./ui-shell-theming-verification-2026-03-09.md), [accessibility.md](../guides/accessibility.md)

#### `WP-018` News-Modul

`Leistungsstand:` Das Arbeitspaket umfasst den fachlich spezialisierten News-Baustein innerhalb der Inhaltsverwaltung. Im Unterschied zu `WP-009` geht es hier nicht um den allgemeinen Inhaltszugang, sondern um den konkreten News-Fachbaustein mit eigener fachlicher Einordnung und eigener Dokumentation im Plugin- und Architekturkontext.

`Prüfweg:` Unter `https://de-studio-sandbox.studio.smart-village.app/admin/content` die Inhaltsverwaltung öffnen und dort gezielt News-bezogene Inhalte oder News-Kontexte prüfen. Erwartetes Ergebnis: Der News-Fachbaustein ist als spezialisierter redaktioneller Anwendungsfall innerhalb der allgemeinen Inhaltsverwaltung nachvollziehbar.

`Repo-Nachweis:` [plugin-development.md](../guides/plugin-development.md), [05-building-block-view.md](../architecture/05-building-block-view.md)

### Schritt 5: Integrations- und Plattformbasis

#### `WP-012` E-Mail-Server

`Leistungsstand:` Das Arbeitspaket umfasst die Unterstützung von Einladungs-, Passwort-Setup- und Kommunikationspfaden im Benutzerkontext. Der Funktionsnachweis erfolgt primär über die Benutzerverwaltung und die zugehörige API- und Betriebsdokumentation. Ein eigenständiger sichtbarer Mail-Ausgang in der Sandbox ist nicht Teil des Prüfumfangs.

`Prüfweg:` In der Benutzerverwaltung unter `https://de-studio-sandbox.studio.smart-village.app/admin/users` einen Benutzerkontext öffnen und die dafür vorgesehenen Verwaltungsaktionen prüfen. Erwartetes Ergebnis: Der Verwaltungsablauf verweist auf Einladungs- oder Passwort-Setup-Funktionen; die technische Ausgestaltung des Mailpfads ist über die verlinkten Repo-Nachweise beschrieben.

`Repo-Nachweis:` [iam-service-api-dokumentation.md](../guides/iam-service-api-dokumentation.md), [swarm-deployment-runbook.md](../guides/swarm-deployment-runbook.md)

#### `WP-013` Keycloak

`Leistungsstand:` Das Arbeitspaket umfasst die Einbindung von Keycloak als Identity Provider für Login, Realm- und Client-Konfiguration sowie administrative Identitätsfunktionen. Der Nachweis stützt sich auf den funktionierenden Login-Pfad und die dokumentierten Provisioning- und Betriebsprozesse. Die eigentliche IdP-Integration wird daher nicht allein über eine Verwaltungsseite, sondern über Login-Verhalten und Repo-Dokumentation geprüft.

`Prüfweg:` Den Login-Einstieg unter `https://de-studio-sandbox.studio.smart-village.app/auth/login` ausführen und ergänzend die Dokumentation zur Instanz- und Keycloak-Verwaltung heranziehen. Erwartetes Ergebnis: Der Login läuft über den vorgesehenen IdP-Pfad; die Einrichtung und Verwaltung der zugehörigen Realm- und Client-Konfiguration ist in den Repo-Nachweisen beschrieben.

`Repo-Nachweis:` [ADR-009-keycloak-als-zentraler-identity-provider.md](../adr/ADR-009-keycloak-als-zentraler-identity-provider.md), [instance-keycloak-provisioning.md](../guides/instance-keycloak-provisioning.md)

#### `WP-014` Main-Server

`Leistungsstand:` Das Arbeitspaket umfasst die serverseitige Laufzeit- und Integrationsschicht für Inhalts-, IAM- und Verwaltungsfunktionen. Ein direkter isolierter UI-Nachweis nur für den Main-Server existiert nicht; der Nachweis erfolgt über das Funktionieren mehrerer darauf aufsetzender Bereiche und die verlinkte Architektur- und Servicedokumentation.

`Prüfweg:` Inhalts- und IAM-Bereich unter `https://de-studio-sandbox.studio.smart-village.app/admin/content` und `https://de-studio-sandbox.studio.smart-village.app/admin/iam` öffnen. Erwartetes Ergebnis: beide Bereiche sind aus derselben Anwendung erreichbar und funktionsfähig; die serverseitige Struktur und Zuständigkeit sind über die verlinkten Repo-Nachweise beschrieben.

`Repo-Nachweis:` [05-building-block-view.md](../architecture/05-building-block-view.md), [iam-service-architektur.md](../architecture/iam-service-architektur.md)

### Schritt 6: Observability und Monitoring

#### `WP-015` OTEL

`Leistungsstand:` Das Arbeitspaket umfasst Telemetrie-, Metrik- und Trace-Pfade der Anwendung. Der sichtbare Nachweis erfolgt über Monitoring-Seiten und ergänzende Betriebsdokumentation. Die konkrete OTEL-Konfiguration und Exportkette ist in den verlinkten Runbooks beschrieben.

`Prüfweg:` Monitoring-Übersicht und Job-Sicht unter `https://de-studio-sandbox.studio.smart-village.app/monitoring` und `https://de-studio-sandbox.studio.smart-village.app/monitoring/jobs` öffnen. Erwartetes Ergebnis: Monitoring- und Job-Ansichten sind erreichbar; die ergänzende technische Ausgestaltung der Telemetriepfade ist in den Repo-Nachweisen dokumentiert.

`Repo-Nachweis:` [swarm-deployment-runbook.md](../guides/swarm-deployment-runbook.md), [deployment-overview.md](../guides/deployment-overview.md)

#### `WP-016` Grafana

`Leistungsstand:` Das Arbeitspaket umfasst die Dashboard- und Visualisierungsschicht des Monitoring-Konzepts. Der Nachweis erfolgt über die dokumentierten Dashboard-Vorlagen und die Betriebsdokumentation; ein direkter öffentlich sichtbarer Grafana-Pfad ist nicht Bestandteil dieses Dokuments.

`Prüfweg:` Führender Prüfweg ist der Repo-Nachweis über die Dashboard-Vorlagen und das Deployment-Runbook. Erwartetes Ergebnis: definierte Dashboard-Struktur, beschriebene Visualisierungspfade und dokumentierte Betriebsintegration.

`Repo-Nachweis:` [iam-cache-grafana-dashboard-template-2026-02-28.md](./iam-cache-grafana-dashboard-template-2026-02-28.md), [swarm-deployment-runbook.md](../guides/swarm-deployment-runbook.md)

#### `WP-017` Loki

`Leistungsstand:` Das Arbeitspaket umfasst die zentrale Logsammlung und die dokumentierten Analysepfade für Laufzeitprotokolle. Der Nachweis erfolgt primär über Runbooks und Troubleshooting-Dokumentation; ein direkter Loki-Zugriff über die Sandbox-Oberfläche ist nicht Bestandteil dieses Dokuments.

`Prüfweg:` Führender Prüfweg ist der Repo-Nachweis über Troubleshooting- und Deployment-Dokumentation. Erwartetes Ergebnis: beschriebene Logging-Pfade, definierte Analysevorgehen und dokumentierte Einbindung in den Betriebsablauf.

`Repo-Nachweis:` [troubleshooting.md](../guides/troubleshooting.md), [swarm-deployment-runbook.md](../guides/swarm-deployment-runbook.md)

#### `WP-020` Monitoringsystem

`Leistungsstand:` Das Arbeitspaket umfasst die Zusammenführung von Gesundheits-, Zustands- und Beobachtungsinformationen im Monitoring-Bereich. Es bündelt die sichtbaren Anwendungsansichten und die ergänzende Betriebsdokumentation zu einem gemeinsamen Monitoring-Kontext.

`Prüfweg:` Unter `https://de-studio-sandbox.studio.smart-village.app/monitoring` die Monitoring-Ansicht öffnen. Erwartetes Ergebnis: Monitoring-Seiten sind erreichbar und stellen Gesundheits- oder Betriebsinformationen in einer zusammenhängenden Oberfläche bereit.

`Repo-Nachweis:` [deployment-overview.md](../guides/deployment-overview.md), [swarm-deployment-runbook.md](../guides/swarm-deployment-runbook.md)

### Schritt 7: Dokumentation und Übergabe

#### `WP-019` Dokumentation der Funktionalitäten und Entwicklungen des Moduls

`Leistungsstand:` Das Arbeitspaket umfasst die technische, architektonische und betriebliche Dokumentation der gelieferten Funktionen. Dazu gehören Architekturübersichten, ADRs, Runbooks und fachliche Leitdokumente. Die Dokumentation ist Bestandteil des Lieferumfangs und bildet den schriftlichen Nachweis für Aufbau, Betrieb und Weiterentwicklung.

`Prüfweg:` Führender Prüfweg ist die Sichtung der verlinkten Architektur-, ADR- und Betriebsdokumente im Repository. Erwartetes Ergebnis: die Dokumentation ist gegliedert, thematisch zugeordnet und deckt Architektur, Entscheidungen und Betrieb ab.

`Repo-Nachweis:` [docs/architecture/README.md](../architecture/README.md), [docs/adr/README.md](../adr/README.md)

## Empfohlener Abnahmeablauf

Für eine effiziente Prüfung empfiehlt sich folgende Reihenfolge:

1. Anmeldung und Mandantenkontext mit `WP-001`
2. Benutzer, Profile und Organisationen mit `WP-002` und `WP-003`
3. Rollen, Gruppen und Autorisierung mit `WP-004` und `WP-005`
4. Datenschutz, Governance und Rechtstexte mit `WP-006`, `WP-007`, `WP-008` und `WP-010`
5. Redaktions- und Bedienpfade mit `WP-009`, `WP-011` und `WP-018`
6. Integrations-, Identity- und Serverbasis mit `WP-012`, `WP-013` und `WP-014`
7. Observability und Monitoring mit `WP-015`, `WP-016`, `WP-017` und `WP-020`
8. Gesamtdokumentation und Übergabefähigkeit mit `WP-019`

## Führende Referenzen

- [project-status.json](../../apps/project-report/src/data/project-status.json)
- [2026-05-25-angebotsabdeckung-meilenstein-1-rueckrichtung.md](./2026-05-25-angebotsabdeckung-meilenstein-1-rueckrichtung.md)
- [2026-05-25-iam-abnahme-1-seiten-matrix.md](./2026-05-25-iam-abnahme-1-seiten-matrix.md)
- [wp-001-auth-mandantenfaehigkeit-abnahme-2026-05-25.md](./wp-001-auth-mandantenfaehigkeit-abnahme-2026-05-25.md)
- [wp-002-benutzer-accounts-profile-abnahme-2026-05-25.md](./wp-002-benutzer-accounts-profile-abnahme-2026-05-25.md)
- [wp-003-organisation-struktur-abnahme-2026-05-25.md](./wp-003-organisation-struktur-abnahme-2026-05-25.md)
- [wp-004-permission-engine-abnahme-2026-05-25.md](./wp-004-permission-engine-abnahme-2026-05-25.md)
- [wp-005-rollen-rechte-keycloak-abnahme-2026-05-25.md](./wp-005-rollen-rechte-keycloak-abnahme-2026-05-25.md)
- [wp-006-datenschutz-compliance-abnahme-2026-05-25.md](./wp-006-datenschutz-compliance-abnahme-2026-05-25.md)
- [wp-010-rechtstexte-abnahme-2026-05-25.md](./wp-010-rechtstexte-abnahme-2026-05-25.md)
