## ADDED Requirements

### Requirement: IAM-Transparenz-Cockpit für Administratoren

Das System MUST unter `/admin/iam` ein tab-basiertes Transparenz-Cockpit bereitstellen, das strukturierte Rechteinformationen, Governance-Vorgänge und Betroffenenrechtsfälle aufgabengerecht sichtbar macht.

#### Scenario: Rechte-Tab zeigt strukturierte Effective Permissions

- **WENN** ein Administrator den Tab `Rechte` in `/admin/iam` öffnet
- **DANN** werden effektive Berechtigungen mit `action`, `resourceType`, optionaler `resourceId`, `effect`, `organizationId`, `scope` und `sourceRoleIds` angezeigt
- **UND** ein Authorize-Check zeigt `reason` und vorhandene Diagnoseinformationen ohne Roh-JSON-Zwang im Standardzustand

#### Scenario: Governance-Tab zeigt operative Freigabe- und Delegationsdaten

- **WENN** ein Administrator den Tab `Governance` öffnet
- **DANN** sieht er Listen und Detailansichten für Permission-Change-Requests, Delegationen, Impersonation-Sitzungen und Legal-Text-Akzeptanzen
- **UND** pro Eintrag sind mindestens Status, beteiligte Identitäten, Ticketbezug und relevante Zeitstempel sichtbar

#### Scenario: Betroffenenrechte-Tab zeigt Compliance-relevante Fälle

- **WENN** ein Administrator den Tab `Betroffenenrechte` öffnet
- **DANN** sieht er Requests, Export-Jobs, Legal Holds, Profilkorrekturen und Empfängerbenachrichtigungen
- **UND** pro Fall sind Status, Frist-/Zeitinformationen und Blockierungsgründe nachvollziehbar

#### Scenario: Transparenz-Cockpit bleibt barrierefrei und fokussiert

- **WENN** Datenmengen groß oder Teilbereiche leer sind
- **DANN** bietet das Cockpit Filter, klare Empty-States, Loading-States und Fehlerzustände
- **UND** Tabs, Tabellen und Detailpanels sind vollständig tastaturbedienbar und screenreader-tauglich
- **UND** Fokuswechsel sind deterministisch (Tab/Panel/Dialog setzt Fokus zielgerichtet; beim Schließen erfolgt Fokus-Restore)
- **UND** asynchrone Statusmeldungen sind als Live-Regionen für assistive Technologien wahrnehmbar

#### Scenario: Zugriff auf Admin-Cockpit wird rollenbasiert begrenzt

- **WENN** ein Benutzer ohne ausreichende Berechtigung `/admin/iam` oder einen sensiblen Tab aufruft
- **DANN** erhält er einen verweigerten Zustand ohne Leckage sensitiver Felder
- **UND** die UI zeigt eine verständliche Meldung mit nächstem sicheren Schritt
- **UND** die Route selbst bleibt auf `iam_admin`, `support_admin`, `system_admin`, `security_admin` und `compliance_officer` begrenzt
- **UND** der Tab `Governance` ist zusätzlich für `security_admin` und `compliance_officer` lesbar, ohne DSR- oder Rechte-Details freizuschalten

#### Scenario: Große Datenmengen werden performanzstabil angezeigt

- **WENN** Governance- oder DSR-Listen hohe Datenmengen enthalten
- **DANN** werden serverseitige Pagination, Filter und Sortierung verwendet
- **UND** initial lädt nur der aktive Tab; Detaildaten werden on-demand nachgeladen

### Requirement: Datenschutz-Self-Service im Account-Bereich

Das System MUST unter `/account/privacy` eine eigenständige Self-Service-Oberfläche für Datenschutz- und Betroffenenrechtsvorgänge bereitstellen.

#### Scenario: Benutzer sieht eigene Datenschutzvorgänge

- **WENN** ein authentifizierter Benutzer `/account/privacy` aufruft
- **DANN** sieht er seine Betroffenenanfragen, Export-Jobs und deren Statushistorie
- **UND** blockierende Zustände wie Legal Holds oder Verarbeitungseinschränkungen werden verständlich erklärt
- **UND** die Seite akzeptiert keine fremden Subjekt-IDs oder Admin-Drill-downs im Client

#### Scenario: Benutzer steuert optionale Verarbeitung

- **WENN** ein Benutzer gegen optionale Verarbeitung widersprechen oder deren Status prüfen möchte
- **DANN** zeigt die UI den aktuellen Opt-out-/Restriktionsstatus
- **UND** die Aktion ist mit einer nachvollziehbaren Statusrückmeldung verbunden

#### Scenario: Erstaufruf ohne bestehende Datenschutzvorgänge ist geführt

- **WENN** ein authentifizierter Benutzer `/account/privacy` ohne bestehende Anträge oder Export-Jobs öffnet
- **DANN** zeigt die UI einen klaren Empty-State mit primärem CTA für den nächsten sinnvollen Schritt
- **UND** nach Ausführung wird der neue Status ohne manuelle Rohdateninterpretation sichtbar

### Requirement: Lokalisierung und klare Inhaltsführung in IAM-UI

Das System MUST alle neu eingeführten sichtbaren UI-Texte in IAM- und Privacy-Ansichten über Translation-Keys bereitstellen und konsistent in `de` und `en` ausliefern.

#### Scenario: Keine hardcoded Strings in neuen IAM-Ansichten

- **WENN** neue Labels, Statusmeldungen, Tabellenköpfe oder Fehlermeldungen in den betroffenen Views angezeigt werden
- **DANN** werden diese ausschließlich über Translation-Keys gerendert
- **UND** es existieren korrespondierende Übersetzungen in `de` und `en`

### Requirement: Vertiefte IAM-Metadaten in bestehenden Admin-Ansichten

Das System MUST heute verdeckte IAM-Metadaten in den bestehenden Benutzer-, Rollen-, Organisations- und Kontextansichten sichtbar machen, soweit dies fachlich sinnvoll und sicher ist.

#### Scenario: Benutzerdetail zeigt Profil- und Rollenmetadaten

- **WENN** ein Administrator `/admin/users/:userId` öffnet
- **DANN** wird ein vorhandener Avatar verwendet, andernfalls ein Platzhalter
- **UND** Rollen-Gültigkeitsfenster und andere zuweisungsbezogene Metadaten sind sichtbar
- **UND** die Historie zeigt echte IAM-Aktivitäten statt eines statischen Empty-States, sofern Daten vorhanden sind

#### Scenario: Rollenansicht zeigt externe Abbildung und Sync-Interna

- **WENN** ein Administrator `/admin/roles` öffnet
- **DANN** sind pro Rolle neben Name und Beschreibung auch `externalRoleName`, `managedBy`, `roleLevel` sowie relevante Sync-Informationen sichtbar
- **UND** Fehlerzustände des Rollen-Syncs sind in der UI nachvollziehbar

#### Scenario: Organisationsansicht zeigt Hierarchie- und Membership-Details

- **WENN** ein Administrator `/admin/organizations` oder den Membership-Dialog öffnet
- **DANN** sind Hierarchiepfad, Kindorganisationen, Metadata sowie Membership-Zeitpunkte sichtbar
- **UND** Default-Kontext und Sichtbarkeit einer Membership bleiben klar erkennbar

#### Scenario: Organisationskontext-Switcher zeigt mehr als nur den Anzeigenamen

- **WENN** ein Benutzer mehrere Organisationskontexte zur Auswahl hat
- **DANN** zeigt der globale Kontext-Switcher zusätzliche Kontextinformationen wie Organisationstyp, Schlüssel oder Standardkontext-Markierung
- **UND** die Shell bleibt dabei kompakt und responsiv
