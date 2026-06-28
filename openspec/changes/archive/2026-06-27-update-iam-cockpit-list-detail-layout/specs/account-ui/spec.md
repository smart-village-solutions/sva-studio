## MODIFIED Requirements

### Requirement: IAM-Transparenz-Cockpit für Administratoren

Das System MUST unter `/admin/iam` ein tab-basiertes Transparenz-Cockpit bereitstellen, das strukturierte Rechteinformationen, Governance-Vorgänge und Betroffenenrechtsfälle aufgabengerecht sichtbar macht. Die Tabs SHALL das etablierte Waste-Management-Muster für Trigger-Leiste, mobile Alternativauswahl und gemeinsame Panel-Hülle übernehmen.

#### Scenario: Rechte-Tab zeigt strukturierte Effective Permissions

- **WENN** ein Administrator den Tab `Rechte` in `/admin/iam` öffnet
- **DANN** werden effektive Berechtigungen tabellarisch mit `action`, `resourceType`, optionaler `resourceId`, optionaler `organizationId`, `scope`, `sourceRoleIds` und Rollen-/Gruppen-Provenienz angezeigt
- **UND** enthält die Ansicht keine fachliche `effect`-Unterscheidung zwischen Allow und Deny
- **UND** die Tabelle besitzt eine semantische `caption` oder ein gleichwertiges Tabellenlabel
- **UND** ein Authorize-Check zeigt `reason` und vorhandene Diagnoseinformationen ohne Roh-JSON-Zwang im Standardzustand

#### Scenario: Governance-Tab zeigt tabellarische Übersicht und separate Detailseiten

- **WENN** ein Administrator den Tab `Governance` öffnet
- **DANN** sieht er eine tabellarische Übersicht für Permission-Change-Requests, Delegationen, Impersonation-Sitzungen und Legal-Text-Akzeptanzen
- **UND** pro Eintrag sind mindestens Status, beteiligte Identitäten, Ticketbezug und relevante Zeitstempel sichtbar
- **UND** die Übersicht rendert keine konkurrierende Inline-Detailkarte
- **UND** die Navigation zu einem Eintrag führt auf eine separate Detailseite innerhalb des IAM-Bereichs

#### Scenario: Betroffenenrechte-Tab zeigt tabellarische Übersicht und separate Detailseiten

- **WENN** ein Administrator den Tab `Betroffenenrechte` öffnet
- **DANN** sieht er Requests, Export-Jobs, Legal Holds, Profilkorrekturen und Empfängerbenachrichtigungen in einer tabellarischen Übersicht
- **UND** pro Fall sind Status, Frist-/Zeitinformationen und Blockierungsgründe nachvollziehbar
- **UND** die Übersicht rendert keine konkurrierende Inline-Detailkarte
- **UND** die Navigation zu einem Fall führt auf eine separate Detailseite innerhalb des IAM-Bereichs

#### Scenario: Transparenz-Cockpit bleibt barrierefrei und fokussiert

- **WENN** Datenmengen groß oder Teilbereiche leer sind
- **DANN** bietet das Cockpit Filter, klare Empty-States, Loading-States und Fehlerzustände
- **UND** Tabs, Tabellen und Detailseiten sind vollständig tastaturbedienbar und screenreader-tauglich
- **UND** Fokuswechsel sind deterministisch (Tab/Panel/Detailseite/Dialog setzt Fokus zielgerichtet; beim Schließen erfolgt Fokus-Restore)
- **UND** asynchrone Statusmeldungen sind als Live-Regionen für assistive Technologien wahrnehmbar

#### Scenario: Große Datenmengen werden performanzstabil angezeigt

- **WENN** Governance- oder DSR-Listen hohe Datenmengen enthalten
- **DANN** werden serverseitige Pagination, Filter und Sortierung verwendet
- **UND** initial lädt nur der aktive Tab
- **UND** Detaildaten werden on-demand erst auf der jeweiligen Detailseite nachgeladen

## ADDED Requirements

### Requirement: Separate IAM-Detailseiten für Governance- und DSR-Fälle

Das System SHALL innerhalb des IAM-Bereichs eigenständige Detailseiten für Governance- und Betroffenenrechtsfälle bereitstellen, damit Übersichten und Bearbeitungskontext nicht in derselben Oberfläche konkurrieren.

#### Scenario: Governance-Detailseite strukturiert den Fallkontext

- **WENN** ein berechtigter Administrator einen Governance-Eintrag aus der Übersicht öffnet
- **DANN** landet er auf einer dedizierten Governance-Detailseite
- **UND** die Seite zeigt mindestens Titel, Status, Typ, beteiligte Identitäten, Ticketbezug und relevante Zeitstempel in einer Kopfsektion
- **UND** weitere Metadaten und Zusammenhänge werden in strukturierten Inhaltsblöcken statt in einer einzelnen Inline-Karte dargestellt

#### Scenario: DSR-Detailseite strukturiert den Fallkontext

- **WENN** ein berechtigter Administrator einen DSR-Fall aus der Übersicht öffnet
- **DANN** landet er auf einer dedizierten DSR-Detailseite
- **UND** die Seite zeigt mindestens Titel, Status, Typ, betroffene Person, Antragsteller und relevante Zeitstempel in einer Kopfsektion
- **UND** weitere Metadaten, Blocker und Fallzusammenhänge werden in strukturierten Inhaltsblöcken statt in einer einzelnen Inline-Karte dargestellt

#### Scenario: Rücknavigation erhält den fachlichen Übersichtskontext

- **WENN** ein Administrator von einer Governance- oder DSR-Detailseite zur Übersicht zurückkehrt
- **DANN** führt die Navigation deterministisch zurück in den passenden IAM-Tab
- **UND** die Rückkehr bleibt ohne manuelles Neuwählen des Fachbereichs verständlich und erwartbar
