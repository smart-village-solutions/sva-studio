# Change: Kasseler Tenant-Ingress vollständig automatisieren

## Why

Die Kasseler Instanzanlage provisioniert Registry- und Keycloak-Artefakte heute
bereits über einen eigenständigen, persistenten Provisioner. Externe
Erreichbarkeit ist jedoch weiterhin eine manuelle Compose-Änderung: Nach
`tenant-havelland` musste auch `svs.dialog.kassel.de` einzeln in dieselbe
Traefik-Hostregel aufgenommen werden. Der wiederholte Betriebsfall bestätigt,
dass Registry, IAM, Ingress, Zertifikat und Login noch kein gemeinsames
terminales Provisioning-Ergebnis besitzen.

Der erste Entwurf vom 11. September 2026 ging noch von einer allgemeinen
Graphile-Jobbasis aus. Seit PR #1316 besitzt Kassel stattdessen einen dedizierten
Provisioner mit spezialisierter PostgreSQL-Queue, instanzgebundener
Serialisierung und unveränderlichen Auftragssnapshots. Gleichzeitig hat Issue
#1319 gezeigt, dass ein gültiger Studio-Login allein keine vollständige
SSF-Betriebsbereitschaft beweist. Dieser Change wird auf diese aktuellen
Verträge ausgerichtet.

## What Changes

- `iam.instance_provisioning_runs` wird zum führenden Elternlauf einer
  Kasseler Instanzanlage. Die vorhandenen spezialisierten Keycloak- und
  Plugin-Lifecycle-Läufe bleiben untergeordnete, korrelierte Ausführungen und
  werden nicht durch eine zweite generische Queue ersetzt.
- Der vorhandene eigenständige Kasseler Provisioner übernimmt die persistente
  Orchestrierung. Sein Queue-, Snapshot-, Claim-, Recovery- und
  instanzgebundener Lock-Vertrag aus PR #1316 bleibt maßgeblich und wird für den
  Elternlauf erweitert.
- Traefik erhält in `smart-speech-flow` einen beobachteten File-Provider-Ordner.
  Nur der Kasseler Provisioner darf diesen Ordner schreiben; Traefik mountet
  ihn nur lesbar. Beide Prozesse erhalten weiterhin weder einen zusätzlichen
  Docker-Socket noch DNS-Zugangsdaten.
- Pro Tenant wird atomar ein deterministisch benannter, expliziter
  `Host(...)`-Router mit eigenem ACME-Zertifikatsvertrag veröffentlicht. Ein
  generischer `HostRegexp`-Router und ein Wildcard-Zertifikat bleiben
  ausgeschlossen.
- Eine Kasseler Anlage gilt erst nach Registry, Keycloak, Ingress, öffentlichem
  TLS, Studio-Login und den für ihre effektiv aktiven Module erforderlichen,
  maschinenprüfbaren Readiness-Nachweisen als erfolgreich. Für SSF umfasst das
  Browser- und Ressourcenclient, IAM-Projektion, Runtime-Tenant-Baseline,
  Runtime-Readiness und aktuelle Authorization-Revision aus #1319.
- Der echte credentialgebundene SSF-Pfad Directory → Keycloak → Callback →
  Gateway bleibt ein geschütztes Rollout- und Enablement-Gate. Er ist kein
  Bestandteil jedes Create-Laufs, weil das Directory vor `active` absichtlich
  unsichtbar bleibt und der Provisioner keine Benutzerpasswörter erhält.
- Create liefert einen beobachtbaren Elternlauf, aber keinen vorzeitigen
  fachlichen Erfolg. Die UI zeigt die Anlage ausschließlich nach terminalem
  Erfolg als abgeschlossen; jeder Fehler endet innerhalb einer definierten
  Frist terminal als `failed`.
- Registry-, Keycloak-, Secret-, Lifecycle- und Router-Artefakte bleiben bei
  `failed` erhalten. Ein autorisierter Retry wird über eine eigene Aktion mit
  frischem Transport-Idempotency-Key ausgelöst, setzt denselben persistierten
  Elternlauf fort und reconciled ab der ersten nicht nachgewiesenen Stufe.
- Der Kassel-Modus ist explizit und standardmäßig aus. Dev, Staging, Production
  und andere Studio-Installationen behalten ihren vorhandenen Ingress- und
  Promote-Vertrag.
- Instanz-IDs werden an Create- und Update-Grenzen vor Registry-, Realm-,
  Hostname- oder Lifecycle-Persistenz gegen den kanonischen kleingeschriebenen
  DNS-Label-Vertrag geprüft. Ungültige IDs werden nicht still normalisiert.
- Unveränderliche Lifecycle-Blocker bewahren ihren konkreten Fehlercode und
  enden terminal. Eine unveränderte terminale Generation darf nicht erneut
  durch `plugin_tenant_lifecycle_retry` eingestellt werden; nur explizit als
  transient klassifizierte Fehler erhalten begrenzte Wiederholungen.
- Der fehlerhafte Kasseler Test-Tenant `Labor` wird nach einem verifizierten
  Backup vollständig und korreliert aus Studio, Keycloak, SSF und dynamischem
  Ingress entfernt. Eine Rename-Migration oder Erhaltung seiner Identität ist
  ausdrücklich nicht erforderlich.

## Current Baseline

- `origin/main` bei Erstellung dieser Revision: `35d80ea89`
- PR #1316 ist gemergt und liefert den eigenständigen Kasseler
  Keycloak-Provisioner.
- Issue #1319 und PR #1339 definieren beziehungsweise implementieren den
  stärkeren SSF-Login-Readiness-Vertrag; #1339 ist noch nicht gemergt und ist
  eine fachliche Vorbedingung für die maschinenprüfbare SSF-Readiness sowie die
  getrennte Ende-zu-Ende-Rollout-Abnahme dieses Changes.
- Live sind `tenant-havelland` und `svs` weiterhin Bestandteile einer statischen
  Docker-Label-Hostregel. Der Traefik File Provider ist nicht aktiviert.
- `tenant-havelland` liefert aktuell einen erfolgreichen Studio-Login-Redirect;
  `svs` liefert auf `/auth/login` weiterhin HTTP 500. Die korrelierte Diagnose
  weist als Ursache die fehlende öffentliche `auth_issuer_url` und den dadurch
  verwendeten internen Keycloak-Admin-Fallback nach. Dieser Fehler bleibt ein
  expliziter Abnahmeblocker und ein negativer Testfall für den neuen Create-Pfad.

## Impact

- Affected specs: `instance-provisioning`, `deployment-topology`
- Affected code: Elternlauf-Persistenz und Statusprojektion,
  Kasseler Provisioner, Ingress-Renderer, Modul-Readiness-Kopplung,
  Admin-UI und Kasseler Deployment-Konfiguration
- External repository: `smart-speech-flow` für Traefik File Provider,
  Read-only-Mount und Provider-/Router-Abnahmetests
- Related work: Issue #1319 und PR #1339; deren SSF-Verträge werden verwendet,
  nicht parallel neu modelliert
- Affected documentation: Kasseler Standalone-Betrieb,
  Control-Plane-Zielbild, ADR sowie arc42-Abschnitte 03, 04, 05, 06, 07, 08,
  09, 10 und 11
- Database: Der vorhandene Elternlauf benötigt voraussichtlich persistente
  Claim-/Retry-/Deadline- und Schritt-Evidenz sowie eine explizite Korrelation
  zu untergeordneten Läufen. Jede tatsächlich erforderliche Migration muss die
  verbindlichen Schema-Snapshots aktualisieren.
- Rollout: Kein zweiter kanonischer Studio-Deploypfad. Studio-Artefakte folgen
  weiterhin dem geschützten Build-/Promote-Prozess; die SSF-Infrastruktur wird
  in ihrem zuständigen Repository geliefert und vor Aktivierung des
  Kassel-Modus ausgerollt.

## Liefergrenze

Die Umsetzung wird nach der Review-Erkenntnis zur getrennten Worker-
Prozessgrenze in zwei eigenständig prüfbare Studio-PRs aufgeteilt:

1. Der vorgelagerte SSF-Readiness-PR liefert ausschließlich den allgemeinen
   Browser-, IAM-, Runtime- und Directory-Vertrag.
2. Dieser Change liefert darauf aufbauend den Kasseler Elternlauf, die
   explizite Initialisierung beziehungsweise Persistenz des Plugin-Vertrags im
   separaten Provisioner-Prozess, Ingress/TLS, Retry und UI.

Der zweite Slice darf nicht als merge- oder enablement-bereit gelten, solange
der Provisioner seinen benötigten Plugin-/OIDC-/Lifecycle-Snapshot nur aus
prozesslokalem App-Zustand ableiten würde. Ein leerer Worker-Snapshot ist kein
gültiger Readiness-Nachweis.
