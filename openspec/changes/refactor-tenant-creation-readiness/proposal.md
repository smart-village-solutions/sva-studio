# Change: Tenant-Erstellung an verifizierten Sollprozess anpassen

## Why

Die aktuelle Tenant-Erstellung prüft Keycloak und die Eignung eines
Bestands-Realms erst nach der Registry-Persistenz. Gleichzeitig sind
Background-Bereitschaft, technische Provisionierung und Aktivierung nicht
sauber getrennt: technische Folgearbeiten können die Anlage beeinflussen,
ein Kasseler Worker aktiviert automatisch und spätere Fehler liefern nicht
durchgängig eine sichere Behebung.

Der verbindliche Sollprozess in
`docs/operations/instance-keycloak-provisioning.md` verlangt dagegen eine
frühe, read-only Bereitschaftsprüfung, eine fehlertolerante fachliche
Tenant-Anlage, einen eigentumssicheren Bestands-Realm-Pfad und eine
ausschließlich manuelle, nachweisgebundene Aktivierung.

## What Changes

- **BREAKING**: Eine neue Tenant-Anlage wird unmittelbar vor der
  Registry-Persistenz serverseitig gegen aktuelle Keycloak-Verfügbarkeit und
  die erforderliche Admin-Berechtigung geprüft. Ein nicht erreichbares oder
  nicht ausreichend autorisiertes Keycloak verhindert die Anlage.
- Für noch nicht persistierte Tenant-Daten entsteht ein gemeinsamer read-only
  Readiness-Vertrag für UI, HTTP und MCP. Er trennt Blocker der Anlage,
  Blocker der technischen Bereitstellung und Blocker der Aktivierung.
- Bestands-Realms werden über einen autorisierten Realm-Katalog gewählt.
  `master` und bereits zugeordnete Realms bleiben mit Begründung sichtbar,
  sind aber serverseitig nicht auswählbar.
- Die Eignungsprüfung eines Bestands-Realms klassifiziert den Zustand als
  `ready`, `auto_completable` oder `manual_resolution_required`. Nur fehlende
  oder eindeutig Studio-eigene Artefakte dürfen automatisch verändert werden.
- Registry-Persistenz und nachgelagerte technische Bereitstellung werden
  fachlich getrennt. Fehlende Worker-, Queue-, Callback-, Ingress- oder
  Plugin-Fähigkeiten verhindern die Tenant-Anlage nicht, werden aber vorab und
  am gespeicherten Tenant als wartend oder blockiert ausgewiesen.
- Keycloak-Mutationen benötigen einen aktuellen Preflight und einen
  ausdrücklich bestätigten, fingerprint-gebundenen Plan. Veraltete Pläne und
  unklare Eigentümerschaft blockieren fail-closed.
- **BREAKING**: Kein Worker und kein MCP-Gesamtprozess darf eine Instanz
  automatisch auf `active` setzen. Aktivierung bleibt eine kritische,
  kanalgeeignet geschützte Benutzeraktion und prüft aktuelle Betriebsnachweise
  erneut.
- Kassel verwendet denselben fachlichen Tenant-Flow, dieselben Create-Gates,
  Zustandsklassen, Fehlerverträge und die gleiche manuelle Aktivierung wie alle
  anderen Betriebsprofile. Der Kasseler Provisioner bleibt lediglich eine
  umgebungsspezifische Ausführungsfähigkeit innerhalb dieses Flows.
- Fehlerantworten und persistierte Prozessbefunde erhalten sichere,
  verständliche Angaben zu betroffenem Feld oder Schritt, Auswirkung,
  Behebung, Folgeprüfung, Zuständigkeit, Korrelation und zulässiger
  Wiederholbarkeit.
- Die UI behält Session, CSRF und Fresh-Reauth; MCP behält den
  Service-Account-/Einmal-Challenge-Vertrag aus ADR-047. Beide nutzen dieselbe
  fachliche Aktivierungsentscheidung nach ausdrücklicher menschlicher Bestätigung.
- Der bestehende MCP-Gesamtprozess wartet in allen Modi vor nicht bestätigten
  Keycloak-Mutationen auf Planfreigabe und setzt denselben Run fort.
- Nachgewiesene eigene Planschritte erhalten die Freigabe der verbleibenden
  Schritte; fremde Drift verlangt einen neuen Plan. Es entsteht keine
  allgemeine Plan- oder Workflow-Engine.
- Unbekannte oder nach Teilmutationen nicht nachweislich sichere Fehler werden
  nicht automatisch wiederholt.
- Die Instanz-UI erhält feldbezogene Validierung, eine durchsuchbare
  Realm-Auswahl, eine Review der drei Blockerklassen sowie gegatete
  Provisioning-, Retry- und Aktivierungsaktionen.
- Die UI verwendet einen gemeinsamen geführten Flow mit progressiver
  Offenlegung. Im Standardpfad heißt der Realm
  `Nutzer-Datenbank (Keycloak-Realm)`; die aktuellen Studio-Instanzen werden
  exakt als `Smart Village App` und `KasselDIALOG` angezeigt.
- Nach der Anlage ersetzt ein gemeinsames Einrichtungscockpit die separate
  Setup-Strecke und die parallelen Hauptkarten für Preflight, Status,
  Planvorschau und Provisioning.
- Der MCP-Pfad verwendet dieselben Readiness-, Plan-, Aktivierungs- und
  Fehlerverträge wie die UI und behandelt nur serverseitig bestätigte,
  payloadgleiche Wiederholungen als idempotente Wiederaufnahme.

## Liefergrenze

Der Change beschreibt einen gemeinsamen Zielvertrag und wird in eigenständig
prüfbaren Lieferabschnitten umgesetzt:

1. Read-only Realm-Katalog, Draft-Readiness und authoritative Create-Recheck.
2. Persistente Bereitstellungsprojektion und Entkopplung nicht kritischer
   Background-Fähigkeiten.
3. Eigentumssicherer Bestands-Realm-Plan und bestätigte Keycloak-Mutation.
4. Manuelle Aktivierung auf Basis aktueller technischer Bereitschaft.
5. UI- und MCP-Adaption sowie vollständige Fehler- und Retry-Verträge.

Jeder Abschnitt erweitert den vorhandenen Instanzpfad. Es entsteht keine neue
allgemeine Workflow-, Queue- oder Deployment-Plattform.

## Non-Goals

- Keine direkte Implementierung innerhalb dieses OpenSpec-Changes.
- Kein zweiter Registry-, Provisioning-, IAM- oder Keycloak-Pfad.
- Keine automatische Übernahme fremder Clients, Rollen oder Benutzer.
- Keine automatische Änderung von Identity Providern, User Federation, SMTP,
  Passwort-, MFA-, Session-, Token- oder sonstigen realmweiten
  Sicherheitseinstellungen in Bestands-Realms.
- Kein neuer kanonischer Deployment- oder Rolloutpfad.
- Keine automatische Aktivierung, auch nicht für Kassel oder über MCP.
- Keine Browserabnahme als Voraussetzung oder nachgelagerter Pflichtschritt
  der Tenant-Erstellung; kein zusätzlicher Abnahmestatus oder Auth-Sonderzugang.
- Kein Kassel-spezifischer fachlicher Create-, Status-, Retry- oder
  Aktivierungspfad.
- Keine rückwirkende Vollmigration aller Bestands-Realms ohne einzeln
  bestätigte Eignungsprüfung.

## Impact

- Affected specs: `instance-provisioning`, `account-ui`,
  `deployment-topology`
- Affected code: Instanz-Registry-Create, Keycloak-Admin-Client,
  Provisioning-Plan und -Worker, Kasseler Elternlauf, Statusprojektion,
  Instanz-Wizard und -Cockpit einschließlich Ablösung der separaten
  Setup-Strecke und überlappender Operationskarten, HTTP-/MCP-Verträge sowie
  Fehlerdiagnose
- Affected active changes:
  - `automate-kassel-tenant-ingress`: Der automatische terminale Übergang auf
    `active` wird durch einen wartenden Zustand vor manueller Aktivierung
    ersetzt. Der Kasseler Elternlauf wird in den gemeinsamen Tenant-Flow
    eingeordnet; umgebungsspezifisch bleiben nur seine technischen
    Ingress-/TLS-Fähigkeiten.
  - `automate-keycloak-realm-baseline`: Die serverseitige Ableitung für
    `realmMode = new` bleibt erhalten; der Change ergänzt den sicheren
    Bestands-Realm-Pfad.
  - `add-plugin-tenant-lifecycle` und `fix-tenant-iam-doctor-evidence`:
    vorhandene Lifecycle- und Diagnoseverträge werden wiederverwendet.
- Database: Eine Schemaänderung ist nur zulässig, wenn die vorhandenen Run- und
  Evidenzfelder die fachlichen Klassen `wartet`, `blockiert` und
  `awaiting_activation` nicht eindeutig und dauerhaft projizieren können.
  Falls nötig, sind `docs/development/studio-db-schema-final.sql` und
  `docs/development/studio-db-schema.md` im selben Lieferabschnitt anzupassen.
- Affected architecture: arc42 03, 04, 05, 06, 08, 09, 10 und 11
- Affected documentation:
  `docs/operations/instance-keycloak-provisioning.md` sowie die relevanten
  Architektur- und Bedienpfade der Instanzverwaltung
- Rollout: Einführung hinter serverseitig kontrollierter Vertragsversion;
  bestehende Tenants bleiben lesbar. Automatische Aktivierung wird erst
  entfernt, wenn die manuelle Freigabe und ihre Nachweise produktiv verfügbar
  sind.
