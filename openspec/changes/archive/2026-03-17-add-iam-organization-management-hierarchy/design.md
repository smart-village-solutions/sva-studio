# Design: IAM Organisationshierarchie und Organisationsverwaltung

## Kontext

Das aktuelle IAM-Modell kennt Organisationen bereits als flache Entität pro Instanz, nutzt diese aber noch nicht als vollwertige Verwaltungs- und Strukturdomäne. Für Milestone 1 fehlt damit die verbindende Schicht zwischen Mandant (`instanceId`), Accounts, Rollen und realen organisatorischen Einheiten.

## Ziele

- Hierarchische Organisationsstruktur innerhalb einer Instanz belastbar modellieren
- Organisationsarten und organisationsbezogene Basispolicies modellieren
- Mehrfach-Zugehörigkeiten von Accounts zu Organisationen ermöglichen
- Aktiven Organisationskontext für Multi-Org-Accounts definieren
- Einfache und stabile Verwaltungs-API für Organisationen bereitstellen
- Eine erste Admin-UI für Organisationspflege und Org-Kontextwechsel spezifizieren
- Spätere Hierarchie-Vererbung im Access-Control-Modul vorbereiten, aber nicht vorwegimplementieren

## Nicht-Ziele

- Keine vollständige ABAC-/Vererbungsimplementierung im Authorize-Pfad
- Keine externe Synchronisation mit Drittsystemen
- Keine komplexe Organigramm-Visualisierung
- Keine delegierte Org-Administration im ersten Schnitt
- Kein vollständiges White-Label-/Branding-Modell im ersten Schnitt

## Nichtfunktionale Anforderungen

- **Sicherheit:** Mutierende Organisations- und Kontext-Endpunkte validieren Instanzgrenzen, Membership-Regeln und den bestehenden CSRF-Header-Contract.
- **Privacy:** Organisations- und Membership-Daten gelten mindestens als `Intern`; Logs und Audit-Payloads enthalten keine Klartext-PII.
- **Observability:** Organisationspfade nutzen den SDK-Logger mit `workspace_id`, `component`, `environment`, `level`, `request_id` und `trace_id`.
- **Auditierbarkeit:** Organisationsmutationen und Org-Kontextwechsel erzeugen korrelierbare Audit-Events im bestehenden Dual-Write-Muster.
- **Accessibility und i18n:** Alle neuen UI-Texte laufen über i18n-Keys; Views müssen WCAG 2.1 AA und die Projektmuster für Tastaturbedienung, Fokusführung und Live-Regionen einhalten.
- **Responsive Verhalten:** Organisations-UI und Org-Switcher bleiben auf 320 px, 768 px und 1024 px funktionsfähig.
- **Performance:** Das Datenmodell und die Read-Model-Queries dürfen die bestehende `authorize`-Leitplanke nicht regressiv beeinflussen; Listen- und Detailpfade vermeiden unnötige Rekursionen und N+1-Zugriffe.
- **Qualität:** Typ-, Lint-, Unit- und relevante Integrationsläufe müssen grün sein; Datenmigrationen benötigen einen verifizierten Rollback-Pfad.

## Entscheidungen

### 1. Instanzzentriertes Modell bleibt führend

- `instanceId` bleibt der kanonische Mandanten-Scope.
- Organisationen bleiben Untereinheiten einer Instanz.
- Parent-/Child-Beziehungen dürfen ausschließlich innerhalb derselben `instanceId` existieren.

### 2. Hierarchie als adjacency-list mit abgeleiteten Strukturfeldern

- Die Grundbeziehung wird über `parent_organization_id` modelliert.
- Ergänzende Strukturinformationen wie `hierarchy_path`, `depth` oder vergleichbare abgeleitete Felder dürfen für effiziente Lesezugriffe ergänzt werden.
- Zyklen und instanzfremde Verknüpfungen werden serverseitig und per DB-Constraints/Validierung verhindert.

### 3. Organisationen werden im ersten Schnitt administrativ, nicht fachlich, ausgewertet

- Ziel ist Organisationspflege und Zuordnung.
- Access-Control nutzt die persistierte Hierarchie erst in einem nachgelagerten Change für Vererbung und Restriktionen.
- Die API darf bereits Hierarchiepfade und Parent-/Child-Informationen liefern, ohne daraus sofort Autorisierungslogik abzuleiten.

### 4. Organisationstypen und Basispolicies werden explizit modelliert

- Organisationen erhalten einen kontrollierten Typ mit mindestens Unterstützung für kommunale und nicht-kommunale Grundformen.
- Das Modell soll mindestens `county`, `municipality`, `district`, `company`, `agency` und `other` oder eine äquivalente stabile Taxonomie unterstützen.
- Organisationsbezogene Basispolicies werden zunächst klein gehalten und umfassen im ersten Schnitt ausschließlich eine Policy für Autorenattribution im Organisationskontext (`content_author_policy`).

### 5. Organisationszuordnungen bleiben Many-to-Many

- Accounts können mehreren Organisationen innerhalb derselben Instanz zugeordnet sein.
- Die Zuordnung soll im ersten Schnitt bereits einen Default-Kontext je Account innerhalb einer Instanz unterstützen.
- Mitgliedschaften können mit einer einfachen internen/externalen Sichtbarkeit markiert werden.

### 6. Aktiver Organisationskontext ist ein eigener Contract

- Ein Benutzer darf nur in Organisationskontexte wechseln, für die innerhalb der aktiven Instanz eine gültige Mitgliedschaft besteht.
- Der aktive Organisationskontext wird im ersten Schnitt serverseitig in der Session persistiert und von nachgelagerten Services aus diesem kanonischen Session-Kontext gelesen.
- Ein expliziter Request-Override für den Organisationskontext ist nicht Teil des ersten Schnitts.
- Der Contract muss mit dem instanzzentrierten Modell kompatibel bleiben; `instanceId` bleibt führend, `acting_as_org_id` ist abgeleiteter Fachkontext.

### 7. Admin-UI startet bewusst klein

- Eine Organisationsliste mit Suche/Filter, einfache Strukturansicht, Detailpflege und Zuordnungsdialoge reicht für den ersten produktiven Schnitt.
- Aufwendige Baumeditoren oder Drag-and-Drop-Reorganisation werden nicht vorausgesetzt.

### 8. Sicherheits- und Betriebsereignisse folgen bestehenden IAM-Mustern

- Organisationsmutationen, Membership-Änderungen und Org-Kontextwechsel gelten als auditierbare IAM-Ereignisse.
- Serverpfade verwenden den SDK-Logger mit projektspezifischen Pflichtfeldern; `console.*` ist nicht zulässig.
- Audit- und Betriebslogs bleiben PII-minimiert und referenzieren Actors und Ziele über zulässige IDs bzw. Pseudonyme.

## Datenmodell

Zielbild im `iam`-Schema:

- `iam.organizations`
  - bestehende instanzgebundene Organisation
  - ergänzt um Parent-/Hierarchy-Felder
  - ergänzt um `organization_type`
  - ergänzt um organisationsbezogene Basispolicies wie `content_author_policy`
  - optionaler Status für aktive/inaktive Organisationen
- `iam.account_organizations`
  - bleibt Zuordnungstabelle zwischen Account und Organisation
  - bildet Mehrfach-Zugehörigkeit ab
  - ergänzt um `is_default_context`
  - ergänzt um einfache Sichtbarkeits-/Typisierungsfelder für interne vs. externe Mitgliedschaft

Zusätzliche Modellregeln:

- Root-Organisationen haben keinen Parent.
- Jede Organisation referenziert höchstens einen Parent.
- Parent und Child müssen dieselbe `instance_id` tragen.
- Pro Account und Instanz darf höchstens eine Organisationszuordnung als Default-Kontext markiert sein.
- Deaktivierte Organisationen bleiben referenzierbar für Audit-, Migrations- und Bestandsansichten, sind aber für neue Zuordnungen und aktive Auswahlpfade gesperrt.
- Löschungen oder Deaktivierungen von Organisationen mit abhängigen Children/Memberships werden kontrolliert behandelt.

## API-Modell

Erster Satz geplanter Endpunkte:

- `GET /api/v1/iam/organizations`
- `POST /api/v1/iam/organizations`
- `GET /api/v1/iam/organizations/:organizationId`
- `PATCH /api/v1/iam/organizations/:organizationId`
- `DELETE /api/v1/iam/organizations/:organizationId`
- `POST /api/v1/iam/organizations/:organizationId/memberships`
- `DELETE /api/v1/iam/organizations/:organizationId/memberships/:accountId`
- `GET /api/v1/iam/me/context`
- `PUT /api/v1/iam/me/context`

Entscheidungen für den ersten Schnitt:

- `DELETE /api/v1/iam/organizations/:organizationId` bedeutet kontrollierte Deaktivierung statt physischer Löschung.
- `PUT /api/v1/iam/me/context` aktualisiert den aktiven Organisationskontext in der Session.
- `GET /api/v1/iam/me/context` liest den aktuell wirksamen Session-Kontext plus verfügbare Organisationsoptionen.

Antworten enthalten mindestens:

- Organisationsidentität und Basis-Metadaten
- Organisationstyp und organisationsbezogene Basispolicies
- Parent-Referenz
- Hierarchie-Kontext für Lesezugriffe
- Member-/Child-Zähler für die Admin-Oberfläche
- aktiven Organisationskontext und verfügbare Organisationsoptionen für den Benutzerkontext

Mutierende API-Anforderungen:

- CSRF-Validierung entsprechend bestehendem IAM-v1-Contract
- strukturierte Fehlercodes für Scope-, Zyklus-, Default-Kontext- und Policy-Verletzungen
- Propagation von `X-Request-Id` und OTEL-Trace-Kontext

## UI-Modell

Geplante Admin-Oberflächen:

- Organisationsliste mit Suchfeld, Status-/Typfilter und einfacher Hierarchieanzeige
- Organisationsdetailseite oder Seitendialog für Pflege von Name, Key, Parent, Typ und Basispolicies
- Zuordnungsoberfläche für Accounts einer Organisation inklusive Default-Kontext und interner/externer Kennzeichnung
- Kleiner Org-Kontextwechsel für Benutzer mit Multi-Org-Mitgliedschaften

UX-Leitplanken:

- Tabellen-/Listenansicht zuerst, Baumdarstellung nur unterstützend
- klare Fehlermeldungen bei Konflikten (z. B. Zyklus, Parent ungültig, Organisation hat Children)
- vollständige i18n-Abdeckung und WCAG-konforme Interaktion
- Kontextwechsel muss den aktiven Zustand klar kommunizieren und nach Tastatur-/Screenreader-Mustern bedienbar bleiben
- neue Views müssen auf 320 px, 768 px und 1024 px ohne Funktionsverlust benutzbar bleiben

## Sicherheit und Mandantenfähigkeit

- Alle Organisationszugriffe sind strikt instanzgebunden.
- RLS und Service-Guards müssen dieselben Instanzgrenzen durchsetzen.
- Der aktive Organisationskontext darf nur gesetzt werden, wenn eine gültige Organisationszuordnung in derselben Instanz existiert.
- Deaktivierte Organisationen dürfen nicht als neuer aktiver Organisationskontext gesetzt werden.
- Schreibende Operationen prüfen zusätzlich:
  - Parent existiert in derselben Instanz
  - Ziel-Account gehört derselben Instanz an
  - Default-Kontext-Regeln pro Account bleiben konsistent
  - keine zyklischen Hierarchieänderungen
- Mutierende Endpunkte erzwingen den bestehenden CSRF-Header-Contract.
- Logs und Audit-Einträge enthalten keine Klartext-PII aus Account- oder Membership-Daten.

## Observability und Audit

- Organisationspfade verwenden `component`-Namen im Muster `iam-organizations`.
- Für Organisationsmutationen und Org-Kontextwechsel werden strukturierte Operations wie `organization_created`, `organization_updated`, `organization_membership_assigned`, `organization_context_switched` definiert.
- Sicherheitsrelevante Ereignisse folgen dem Dual-Write-Muster: Audit-Eintrag in `iam.activity_logs` plus strukturierter SDK-Log mit Korrelation.
- Denial- und Validierungsfälle werden mit stabilen Fehlercodes emittiert, damit Betriebs- und Security-Analysen filterbar bleiben.

## Performance und Skalierung

- Listen- und Detailabfragen sollen Hierarchie- und Zählerdaten in einem lesefähigen Read-Model bereitstellen, statt rekursive Einzelabfragen in der UI auszulösen.
- Der Org-Kontextwechsel soll ohne Vollrecompute fachlicher Berechtigungen modelliert werden; teure Vererbungsberechnungen bleiben Folgearbeit.
- Die Umsetzung darf das bestehende Leistungsziel von `POST /iam/authorize` nicht regressiv beeinflussen; relevante Performance-Negativpfade werden in Tests oder Benchmarks festgehalten.

## Risiken / Trade-offs

- Adjacency-list allein kann tiefere Hierarchieabfragen verteuern.
  - Mitigation: optionale abgeleitete Pfad-/Depth-Felder, ohne das Modell unnötig zu verkomplizieren.
- Ein zu enger Organisationstyp-Katalog kann spätere Trägerformen erschweren.
  - Mitigation: kontrollierte Start-Taxonomie mit dokumentierter Erweiterungsregel und Fallback `other`.
- Ein zu breiter UI-Schnitt verzögert die Delivery.
  - Mitigation: Fokus auf Verwaltung statt Visualisierung.
- Spätere Access-Control-Anforderungen können zusätzliche Strukturfelder benötigen.
  - Mitigation: API und Schema so schneiden, dass Hierarchiepfade und Parent-Referenzen stabil verfügbar sind.
- Aktiver Org-Kontext kann bei Session- und Backend-Verarbeitung auseinanderlaufen.
  - Mitigation: einen klaren API-Contract für Lesen/Schreiben des Kontexts definieren und serverseitig kanonisieren.
- Unvollständige Logging-/Audit-Integration erschwert Security- und Betriebsanalyse.
  - Mitigation: Pflichtfelder, Dual-Write und Negativpfade bereits im Design und in der Testmatrix verankern.
- Responsive oder A11y-Schulden in der neuen Admin-UI erzeugen Folgearbeit.
  - Mitigation: Breakpoints, Tastaturpfade und i18n-Keys als explizite Spezifikationsanforderungen festhalten.

## Migration Plan

1. Bestehende flache Organisationen behalten ihre IDs und Instanzbindung.
2. Neue Hierarchiefelder, Organisationstypen und Policy-Felder werden rückwärtskompatibel ergänzt.
3. Bestehende Datensätze starten als Root-Organisationen, sofern kein Parent definiert ist.
4. Bestehende Organisationen erhalten einen konservativen Default-Typ und konservative Policy-Defaults.
5. Memberships können optional einen Default-Kontext erhalten; fehlt dieser, bleibt das Verhalten rückwärtskompatibel.
6. Seeds und Tests werden auf Mehrfach-Zugehörigkeit, Hierarchie und Org-Kontext erweitert.
7. Up/Down-Migrationen werden als Paar verifiziert, bevor der Change in die Umsetzung geht.
