# Change: Instanzverwaltung auf Aufgaben, klare Befunde und gezielte Vertiefung ausrichten

## Why

Die Instanzverwaltung verteilt Identität, Status, nächste Aktion und technische
Nachweise auf wiederholte Kopfkarten, Einrichtungscockpit, Betriebsflächen und
Doctor. Die Modulverwaltung stellt Zuweisungen, Aktivierungsrichtlinien und
Plugin-Bereitschaft getrennt dar. Dadurch müssen Nutzer dieselbe Instanz aus
mehreren Teilansichten zusammensetzen, obwohl der fachliche Prozess bereits
feststeht.

Der UI-Umbau benötigt einen präzisen Darstellungs- und Interaktionsvertrag als
unmittelbare Implementierungsgrundlage. Ein eigener Change hält diesen Auftrag
von den Backend- und Rollout-Nachweisen des weitgehend umgesetzten Changes
`refactor-tenant-creation-readiness` getrennt; dessen Verträge werden konsumiert.

## Auftrag und Liefergrenze

Die bestehenden Instanzseiten SHALL einen einfachen geführten Standardpfad,
sichtbaren Handlungsbedarf und gezielt zugängliche technische Details anbieten,
ohne den fachlichen Anlage-, Provisioning- oder Aktivierungsprozess zu ändern.

Maximal betroffen sind die React-Instanzseiten, ihre bestehenden lokalen Modelle
und Hooks, die gemeinsam genutzte Moduloberfläche, der Einladungsvorlagen-Editor,
die zugehörigen deutschen/englischen Texte, Tests und aktuelle Dokumentation.
Die Implementierung bleibt innerhalb dieser Liefergrenze; Proposal, Design, Tasks
und das Delta der bestehenden Capability `account-ui` bilden die Abnahmegrundlage.

## What Changes

- Die Liste priorisiert Instanzidentität, Adresse, Lifecycle und belegbaren
  Handlungsbedarf; seltene Lifecycle-Aktionen erhalten ein beschriftetes Menü.
- Der bestehende Vier-Schritt-Assistent bündelt die Realm-Modus-Entscheidung im
  zweiten Schritt. Die Review zeigt alle fachlichen Eingaben mit direkter
  Korrekturrückkehr und trennt die vorhandenen drei Blockerklassen.
- Die Detailseite erhält einen kompakten Kopf mit getrennt benanntem Lifecycle
  und Betriebszustand. Während der Anlage steht eine aktuelle Einrichtungsaufgabe
  im Mittelpunkt; Bestandsinstanzen öffnen im Betrieb.
- Die fünf vorhandenen Einrichtungsschritte bleiben erhalten. Der konkrete
  Änderungsplan, aktuelle Freigaben, manuelle Aktivierung und die sichere
  Wiederholbarkeit bestimmen weiterhin die verfügbaren Aktionen.
- Blocker bleiben sichtbar. Technische Belege werden aufgeklappt; Fehlerlinks
  öffnen den passenden Bereich und fokussieren das betreffende Feld.
- Der Doctor bietet vorhandene zulässige Diagnose-/Reparaturmaßnahmen direkt an
  und zeigt aktuelle Ergebnisse vor historischen Läufen. Zur Aktivierung führt
  er in den bestehenden geschützten Abschluss im Einrichtungscockpit.
- Eine gemeinsame Modulansicht führt Zuweisung, Aktivierungsinformationen und
  technische Bereitschaft pro Modul zusammen, ohne deren Semantik zu vermischen.
- Einstellungen werden fachlich gruppiert. Das Speichern/Zurücksetzen einer
  Einladungsvorlage übernimmt keine ungespeicherten Instanzeinstellungen.
- Ersetzte Karten und Darstellungswege werden im jeweiligen Lieferabschnitt
  entfernt; bestehende Studio-, Formular- und Accessibility-Primitiven werden
  verwendet.

## Non-Goals

- Keine neuen Endpunkte, Backend-Verträge, Datenbankänderungen, Worker,
  Prozesszustände, Retry-Mechanismen oder Freigabeschritte.
- Keine Änderung von Realm-Baseline, Pflichtfeldern, Default-Modulen,
  Berechtigungen, Session/CSRF/Fresh-Reauth, Plan-Fingerprints oder
  Idempotenzverträgen.
- Kein zweiter Experten-, Setup-, Kassel- oder MCP-Prozess; keine automatische
  Aktivierung und keine zusätzliche fachliche Browserabnahme.
- Keine neue UI-Plattform, globale Formularabstraktion, Dependency, Route oder
  Bestandsdatenmigration. Vorhandene Formstandards gelten für die überarbeiteten
  Formulare.
- Keine serverweite Konfigurationsrevision oder Garantie zur Vermeidung aller
  konkurrierenden Einstellungsänderungen; die Vorlagenrevision bleibt wirksam.
- Keine neue Entwurfspersistenz über vollständige Seitenwechsel zur Anmeldung;
  der Erhalt lokaler Entwürfe gilt innerhalb der geöffneten Instanzoberfläche.
- Keine allgemeinen Plugin-, Servervorlagen- oder anderen Admin-Redesigns.

## Abhängigkeiten und Überschneidungen

Stand: `472c93830`, 27.09.2026. Source, aktuelle Specs und aktive Deltas bilden
gemeinsam den Ausgangspunkt; erledigte Tasks allein sind kein Abnahmenachweis.

| Bestehender Change                                                            | Beziehung und verbindliche Abgrenzung                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `refactor-tenant-creation-readiness`                                          | Realm-Katalog, Draft-Readiness, nächste Serveraktion, sicherer Retry und manuelle Aktivierung werden übernommen. Die offenen UI-Tasks 7.16/7.17 werden durch die Aufgaben 2.2, 2.3 und 5.2 dieses Changes konkretisiert und erhalten dieselbe Implementierung/Evidenz. Der Status im älteren Change wird erst nach diesem Nachweis aktualisiert. Dessen Rollout-Aufgaben 10.5/10.6 bleiben dort. |
| `add-instance-account-invitation-templates`                                   | Editor, Validierung, Quelle, Revision und Reset werden erhalten. Die Trennung lokaler Speicherbereiche wird hier ergänzt. Die offenen realen Einladungsabnahmen bleiben beim Ursprungschange.                                                                                                                                                                                                    |
| `add-plugin-tenant-lifecycle`, `extend-plugin-platform-scopes-and-activation` | Vorhandene Aktivierungs- und Readiness-Daten werden dargestellt; keine neue Berechnung der effektiven Aktivierung oder Plugin-Spezialfälle.                                                                                                                                                                                                                                                      |
| `fix-tenant-iam-doctor-evidence`                                              | Klassifikation, Quelle, Serviceidentität und Korrelation bleiben nachvollziehbar. Keine neue Rechteprobe oder andere Serviceidentität.                                                                                                                                                                                                                                                           |
| `automate-keycloak-realm-baseline`                                            | Bestehende serverseitige Standards und gegebenenfalls manuelle Nacharbeiten bleiben erhalten.                                                                                                                                                                                                                                                                                                    |
| `add-studio-data-form-and-test-foundations`                                   | Bestehende RHF-/Zod- und Studio-Form-Verträge werden in den überarbeiteten Formularen verwendet. Keine repo-weite Formularmigration.                                                                                                                                                                                                                                                             |
| `refactor-plugin-auth-composition`                                            | Keine formale Implementierungsabhängigkeit. Plugin-Verfügbarkeit wird weiterhin aus der vorhandenen Composition bezogen.                                                                                                                                                                                                                                                                         |

Die Implementierung benötigt die genannten bereits vorhandenen Verträge, aber
nicht den pauschalen Abschluss sämtlicher älterer Changes. Bei der Archivierung
müssen deren einschlägige Deltas berücksichtigt sein. Dieses Delta verändert nur
Requirements, die bereits unter `openspec/specs/account-ui/spec.md` existieren;
es ersetzt keine erst im Readiness- oder Vorlagen-Change hinzugefügten
Requirements. Abweichende ältere Formulierungen zu separater Setup-Route und
lokaler Aktionsfreigabe sind im Readiness-Change bereits abgelöst. Der vorliegende
Change führt sie nicht wieder ein.

## Impact

- Affected specs: `account-ui`; `instance-provisioning` und
  `plugin-tenant-lifecycle` bleiben unveränderte Fachverträge.
- Affected code: `apps/sva-studio-react/src/routes/admin/instances/`,
  `routes/admin/modules/-instance-modules-workspace.tsx`,
  `hooks/use-instances.ts`, `hooks/use-plugin-tenant-readiness.ts`,
  bestehende Instanz-API-Payload-Abbildung und `i18n/resources/{de,en}/admin/instances/`.
- Affected tests: zugehörige Vitest-Dateien und bestehende
  `e2e/account-admin-ui.instance-{create,control}.spec.ts`.
- Affected documentation: `docs/reference/instance-lifecycle-navigation.md`,
  `docs/development/studio-form-migrationsinventur.md` sowie arc42
  `05-building-block-view` und `08-cross-cutting-concepts`.
- arc42 04 und 06 werden auf Widersprüche geprüft; die Fachstrategie und
  serverseitigen Sequenzen werden nicht umdefiniert. Kein neuer ADR erforderlich.
- Einführung: bestehender App-Build und kanonischer Rollout. Kein Feature-Flag
  oder paralleler Altpfad; Rücknahme über den vorherigen App-Stand.

## Success Criteria

- Der New-Realm-Standardfall ist ohne Öffnen technischer Details bedienbar.
- Aktuelle Blocker und ihre Folgen sind sichtbar und führen zu einer passenden
  zulässigen Handlung; `unknown` wird nicht als Erfolg präsentiert.
- Vorhandene strukturierte Fehler bleiben bis zur Darstellung erhalten;
  unbekannte Fehlercodes werden nicht als belegter Ausfall eines Dienstes ausgegeben.
- Ein aktiver, eingeschränkter Tenant bleibt in der Bestandsverwaltung.
- Pro sichtbarem Arbeitsbereich existiert höchstens eine hervorgehobene nächste
  Aktion; wiederholte Identitäts-/Statuskarten sind entfernt.
- Modulzuweisung und technische Bereitschaft bleiben auch in einer gemeinsamen
  Zeile getrennt ablesbar.
- Vorlage und Instanzeinstellungen speichern ausschließlich ihren benannten
  lokalen Entwurf; Fehler, Revision und Dirty-State bleiben korrekt.
- Bestehende Prozess-, Auth-, i18n- und Accessibility-Verträge sind durch die im
  Design zugeordneten Nachweise abgesichert.
