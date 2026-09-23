## Context

Die Account-Anlage schreibt heute nach Keycloak und Studio und plant danach
einen tenantweiten SSF-Reconcile. Der Administrator erhält dadurch Erfolg,
bevor die SSF-Claims vollständig vorliegen. Die Anlage soll einen einzigen
synchronen Abschluss haben; ein späterer Prozess darf sie nicht fertigstellen.

## Goals / Non-Goals

Ziel ist ein kurzer Ablauf mit unmittelbar sichtbaren Fehlern. Aktive,
SSF-berechtigte Accounts sind nach erfolgreicher Anlage und Erfüllung der
bestehenden Anmeldevoraussetzungen nutzbar. Bewusst inaktive oder nicht
SSF-berechtigte Accounts erhalten dadurch weder Aktivierung noch Zusatzrechte.

### Verbindliche Umfangsgrenze

- Bestehende Create-, IAM-, Keycloak-, Transaktions-, Fehleranzeige- und
  Lifecycle-Pfade erweitern; keine neue Tabelle, Spalte, Queue, Lifecycle-Phase,
  Statusseite, Retry-Oberfläche, Saga oder zusätzliche Revisionsquelle.
- Kein Projektionsjob, Polling, technischer Pending-Account oder
  benutzerspezifischer Keycloak-Read-back zum Abschluss einer Neuanlage.
- Keine Mapper-Reparatur oder Mandantenprovisionierung im Create-Request.
- Keine Reparatur alter unvollständiger Accounts und keine Änderung der
  fachlichen Einladungs- oder Mainserver-Credential-Provisionierung.
- Der bestehende tenantweite Lifecycle bleibt für Mandantenbasis, Mapper-Drift,
  spätere Rechteänderungen und Recovery zuständig. Seine Projektionsdaten,
  Read-backs, Sperren und Retry-Behandlung bleiben dafür erhalten.
- Entfernt werden der create-spezifische Reconcile-Aufruf und nachweislich nur
  dafür benötigte Teile. Die Prüfung ihrer direkten Verbraucher genügt;
  keine allgemeine Bereinigung der Plattform.

## Decisions

### Vier Schritte innerhalb eines Requests

1. **Voraussetzungen prüfen:** Tenant-Provider auflösen, bestehende bestätigte
   SSF-Readiness samt aktueller Vertragsrevision lesen, direkte Rollen und
   Gruppenrollen serverseitig validieren und effektive SSF-Rechte ableiten.
   Dabei bestehende Zuweisungsgrenzen und tenantlokales Scoping verwenden.
   Keine erneute Realm-, Client- oder Mapper-Prüfung. Fehlende Voraussetzungen
   beenden die Anlage vor dem Keycloak-Create und lokalen Account-Write.
2. **Keycloak vollständig schreiben:** Den Benutzer mit den kanonisch
   abgeleiteten Attributen anlegen und erforderliche technische Rollen über
   den vorhandenen begrenzten Rollenabgleich zuweisen. Für SSF-berechtigte
   Benutzer sind `studio_tenant_id`, `ssf_roles`, `ssf_permissions` und
   `ssf_authorization_revision` vollständig. Ohne SSF-Berechtigung entstehen
   keine zusätzlichen Rechte; fachlich inaktive Accounts bleiben inaktiv.
3. **Lokal speichern:** Account, Mandantenmitgliedschaft, Rollen und Gruppen
   gemeinsam in einer Datenbanktransaktion persistieren. Die gespeicherten
   Zuweisungen müssen der validierten Ableitung entsprechen. Dieser Commit
   beendet den kompensierbaren Teil der Anlage.
4. **Ergebnis zurückgeben:** Den vorhandenen Einladungs- und optionalen
   Mainserver-Folgepfad mit unveränderter Fehlersemantik ausführen. Diese
   Folgepfade liegen außerhalb der Delete-Kompensation. Es gibt keinen
   erfolgreichen Response vor dem Commit und keinen SSF-Reconcile danach.

Die bestehende Request-Idempotenz bleibt erhalten. Die gemeinsame fachliche
Ableitung wird von Create und Lifecycle verwendet; es entsteht keine zweite
Rollen-/Permission-Abbildung. Bestehende fachliche Accountstatus werden nicht
als technischer Projektionsfortschritt umgedeutet. Nicht-SSF-Anlagen bleiben
außerhalb der SSF-spezifischen Voraussetzungen.

### Bestehende Tenant-Sperre für Create und Reconcile

Beide Abläufe verwenden dieselbe vorhandene tenantgebundene Sperre. Create
hält sie vom Lesen der Readiness und des Rollenstands bis zum lokalen Commit
oder zur abgeschlossenen Kompensationsbehandlung. Einladung und Mainserver-
Folgeschritte liegen außerhalb der Sperre. Wird sie im begrenzten bestehenden
Request-Zeitbudget nicht verfügbar, endet Create mit einem sichtbaren Konflikt;
er plant keinen Job und wartet nicht auf eine komplette Mandantenreparatur.

Der Lifecycle liest seinen Source-Snapshot erst unter dieser Sperre und hält
sie während Projektion und Bestätigung. Ein vor Sperrerwerb gelesener Snapshot
darf nicht verwendet werden: Die bestehende Bereinigung würde sonst Claims
eines zwischenzeitlich angelegten Benutzers entfernen. Spätere IAM-Mutationen
behalten ihren bestehenden Änderungs- und Reconcile-Pfad.

### Vertragsrevision und Projektionsinhalt getrennt behandeln

Die `ssf_authorization_revision` bindet den Tenant an Vertragsversion,
erlaubten Permission-Katalog und kanonische Studio→SSF-Abbildungsregeln.
Konkrete Subjects und Mitgliedschaften ändern sie nicht. Die tenantbezogene
Bindung bleibt erhalten; eine neue Anlage übernimmt die bestätigte Revision.

Revisionsgleichheit beweist dagegen keine gleichen Benutzerrechte. Staging,
Ready-Entscheidung und Read-back vergleichen die vollständigen normalisierten
Projektionsinhalte einschließlich Subjects, Rollen und Permissions. Eine
inhaltliche Änderung invalidiert die Bestätigung und erhöht die bestehende
`generation`, auch wenn die Vertragsrevision gleich bleibt. Der Reconcile
darf dann nicht allein wegen gleicher Revision übersprungen werden.

Dafür dienen die vorhandenen desired-/confirmed-Projektionen und deren
Generation; es entsteht kein zweiter Hash oder persistierter Revisionszähler.
Ein späterer Lifecycle-Lauf darf den aktuellen Benutzerbestand abgleichen,
ist aber keine Voraussetzung für den Erfolg oder Login eines neuen Accounts.
Die bestehende begrenzte Gültigkeit bereits ausgestellter Tokens bleibt
unverändert; Vertragsrevision und individueller Rechteentzug werden nicht
mehr gleichgesetzt.

### Directory berücksichtigt den abgeschlossenen Create

Die vorhandene Directory-Prüfung verlangt weiterhin bestätigte aktuelle
Mandantenreadiness. Den Benutzer-Nachweis liest sie aus aktiven lokalen
Accounts, Mandantenmitgliedschaften und effektiven SSF-Rechten statt allein
aus `confirmed_has_subjects` der letzten tenantweiten Projektion. Dieselbe
kanonische Rechteableitung verhindert Abweichungen zwischen Create und
Directory; der bestehende tenantisolierte Lesepfad wird gezielt angepasst.

Damit wird auch der erste berechtigte Account nach seinem Commit sichtbar.
Inaktive, nicht berechtigte oder zurückgerollte Anlagen erfüllen den Nachweis
nicht. Create schreibt keine vorgetäuschte Read-back-Bestätigung in die
Projektionspersistenz. Bestehende Subject-Nachweise bleiben für tatsächliche
Lifecycle-Verbraucher erhalten; Bestandsreparatur gehört nicht zu diesem Change.

### Fehler bleiben unmittelbar sichtbar

Scheitern technischer Rollenabgleich oder lokale Transaktion vor erfolgreichem
Commit, löscht Studio ausschließlich die eindeutig vom Create zurückgegebene
Benutzer-ID über denselben tenantgebundenen Provider. Keine Suche und Löschung
anhand der E-Mail, keine erneute Providerauflösung für die Kompensation.

Scheitert die Löschung, bleibt der Request fehlgeschlagen. Der bestehende
Formularfehler zeigt einen übersetzten, sicheren Hinweis auf die unvollständige
Bereinigung samt Korrelations-ID. Strukturierte Betriebslogs verwenden die
vorhandenen datensparsamen Identifikatoren und sichere Fehlerklassen, keine
E-Mail oder ungefilterten Providerfehler. Ein Logeintrag allein genügt nicht.
Es gibt keinen automatischen Hintergrundabschluss der ursprünglichen Anlage.

Nach erfolgreichem lokalen Commit dürfen Fehler der Folgepfade keine
Keycloak-Löschung mehr auslösen. Bei einem unklaren externen Create-Ergebnis,
etwa Timeout ohne bekannte Benutzer-ID, wird kein Erfolg behauptet und kein
fremder Benutzer kompensiert; eine mögliche externe Restanlage bleibt ein
sichtbarer Betriebsfehler. Ein neuer Recovery-Prozess wird dafür nicht gebaut.

## Migration Plan

1. Projektionsvertragsversion erhöhen und die bestehende SSF-Lifecycle-
   Vertragsrevision mitziehen. Der vorhandene Scheduler erkennt Vertragsdrift
   über `resolveAutomaticProvisioningSchedule` in
   `packages/auth-runtime/src/plugin-tenant-lifecycle/automatic-schedule.ts`
   und plant den bestehenden Reconcile; kein neuer Migrationsjob.
2. Den vorhandenen Readiness-Leser auf den aktuell unterstützten bestätigten
   Vertragsstand begrenzen. Alte `ready`-Datensätze sind bereits vor dem
   ersten Reconcile nicht freigegeben. Der Versionsbump allein genügt nicht.
3. Create-Umstellung und Entfernung seines Reconcile-Aufrufs gemeinsam
   liefern. Solange der Mandant nicht konvergiert ist, scheitert Create sofort
   an seiner Voraussetzung. Es gibt keinen temporären Alternativpfad.
4. Konvergenz, Directory, reale Tokenausgabe und SSF-Nutzung im regulären
   Staging-Rollout am exakten Image-Digest nachweisen.

Rollback erfolgt über den regulären Rollout-Prozess auf den vorherigen Stand;
der dort unterstützte Vertragsstand muss erneut konvergieren. Vor Freigabe ist
auch dieser Wechsel nachzuweisen. Es gibt weder Dual-Read noch parallele
Revisionen. Ein gescheiterter Lifecycle bleibt unabhängig von Create sichtbar
und fail-closed.

## Risks / Trade-offs

- Keycloak und lokale Datenbank sind nicht atomar. Die begrenzte Kompensation
  behandelt bekannte Teilfehler; fehlgeschlagene oder unklare externe Writes
  können operative Bereinigung erfordern.
- Die gemeinsame Sperre begrenzt gleichzeitige Arbeit pro Tenant. Der Create
  beantwortet einen Konflikt sichtbar, statt ihn in eine Warteschlange zu legen.
- Ohne Benutzer-Read-back beruht Create auf dem Keycloak-Schreibergebnis und
  bestätigter Mandantenbasis. Reale Claims werden durch Keycloak-Integration
  und Token-E2E nachgewiesen; das ist keine Behauptung dauerhafter Driftfreiheit.

## Alternatives Considered

- **Background-Abschluss oder Pending-Modell:** widerspricht dem gewünschten
  unmittelbar sichtbaren Ergebnis und entfällt.
- **Tenantweiten Reconcile synchron abwarten:** koppelt eine Einzelanlage an
  alle Benutzer und verlängert den Request unnötig.
- **Zweite Revision oder neue Recovery-Infrastruktur:** für Inhaltsvergleich,
  Serialisierung und sichtbare Fehler sind die bestehenden Mittel ausreichend.
