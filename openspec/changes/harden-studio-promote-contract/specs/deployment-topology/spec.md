## ADDED Requirements

### Requirement: Remote-Konfigurationen werden deterministisch und gestuft aktiviert

Das System SHALL nicht-sensitive Studio-Remote-Konfiguration versioniert im Repository führen und sie über einen repository-lokalen Builder mit einem kompakten geschützten Override-Bundle des jeweiligen GitHub-Environments zusammenführen. Lokale `*.local.vars` dürfen keine Remote-Deployment-Quelle sein.

#### Scenario: Builder läuft erstmals für eine Remote-Umgebung

- **WHEN** der neue Builder in Dev, Staging oder Production eingeführt wird
- **THEN** läuft er zunächst im Shadow-Modus ohne Änderung der autoritativen Deploy-Ausgabe
- **AND** vergleicht Schlüsselmengen, nicht-sensitive Werte, Secret-Klassifikationen und externe Referenznamen redigiert mit dem bestehenden Pfad
- **AND** wird erst nach erfolgreichem Dev- und Staging-Nachweis für Production autoritativ

#### Scenario: Lokale Override-Datei wird als Remote-Quelle angeboten

- **WHEN** eine `config/runtime/*.local.vars` als Remote-Profil oder geschütztes Override-Bundle verwendet werden soll
- **THEN** endet der Config-Build vor Upload, Backup oder Deployment mit `PROMOTE_CONFIG_SOURCE_FORBIDDEN`
- **AND** nennt die Fehlermeldung die zulässige Remote-Quelle, ohne lokale Inhalte auszugeben

#### Scenario: Secret-Wert liegt unter einem Referenzschlüssel

- **WHEN** ein Schlüssel mit der Semantik `_SECRET_NAME` oder `_SECRET_REF` keinen zulässigen externen Referenznamen enthält
- **THEN** stoppt der Builder fail-closed vor jeder Remote-Mutation
- **AND** übernimmt den referenzierten Secret-Wert weder in Config-Evidenz noch Logs

### Requirement: Candidate-Konfiguration wird vor jeder Zielmutation read-only geprüft

Das System SHALL nach Image-, Git- und statischer Config-Validierung einen isolierten read-only Candidate-One-shot mit Zielimage, Candidate-Konfiguration und erforderlichen Secret-Mounts ausführen. Der Candidate SHALL keine Migration, keinen Bootstrap und keine fachliche Datenmutation ausführen können.

#### Scenario: Candidate ist vollständig und kompatibel

- **WHEN** ein Staging- oder Production-Promote den Candidate-Preflight erreicht
- **THEN** prüft der One-shot Runtime-Profil, externe Secret-Referenzen, Registry-Lesbarkeit, Release-Tenant-Scope und Entschlüsselbarkeit aktiver Tenant-Secrets
- **AND** wird er vor Backup und App-Deploy terminal ausgewertet und entfernt

#### Scenario: Candidate kann aktive Tenant-Secrets nicht entschlüsseln

- **WHEN** der konfigurierte Schlüsselbund nicht zur Registry passt
- **THEN** stoppt der Promote vor Backup und App-Deploy mit `PROMOTE_PREFLIGHT_TENANT_SECRET_UNREADABLE`
- **AND** enthält die Meldung eine konkrete nächste Aktion, aber keine Secret-Inhalte, Hashes oder Wertlängen

### Requirement: Standard und Recovery bleiben Modi desselben Promote-Workflows

Das System SHALL reguläre und degradierte Ausgangszustände innerhalb desselben kanonischen `Promote`-Workflows als `standard` beziehungsweise `recovery` behandeln.

#### Scenario: Standard-Promote trifft degradierte Production

- **WHEN** `promote_mode=standard` gewählt ist und die bestehende Production vor der Mutation nicht HTTP 200 von `health/ready` liefert
- **THEN** stoppt der Promote vor der ersten Zielmutation mit `PROMOTE_READINESS_NOT_READY`
- **AND** verweist auf den kontrollierten Recovery-Modus

#### Scenario: Recovery-Promote wird ausdrücklich freigegeben

- **WHEN** `promote_mode=recovery` mit nicht leerem Grund und geschützter Environment-Freigabe gestartet wird
- **THEN** darf der Ausgangszustand degradiert sein
- **AND** bleiben Backup, Staging-Digest-Parität, Migration-/Bootstrap-Gates, finale Readiness, Release-Tenant-Smoke und Digest-Prüfung unverändert blockierend

#### Scenario: Recovery-Grund fehlt

- **WHEN** `promote_mode=recovery` ohne nicht leeren dokumentierten Grund gestartet wird
- **THEN** stoppt der Workflow mit `PROMOTE_RECOVERY_REASON_REQUIRED` vor jeder Zielmutation

### Requirement: Production verlangt denselben erfolgreichen Staging-Image-Digest

Das System SHALL bei jedem Production-Promote mit einem vom Live-Digest abweichenden Zieldigest eine erfolgreiche Staging-Promotion exakt desselben Image-Digests verlangen. Umgebungsspezifische Config-Werte SHALL nicht als Staging-Production-Gleichheit behandelt werden.

#### Scenario: Reines App-Deployment nach Production

- **WHEN** Migration und Bootstrap auf `assert-none` stehen
- **AND** der Zieldigest vom Production-Live-Digest abweicht
- **THEN** validiert der Workflow dennoch die erfolgreiche Staging-Evidenz für exakt diesen Digest
- **AND** stoppt bei fehlender oder abweichender Evidenz mit `PROMOTE_PARITY_DIGEST_MISMATCH`

#### Scenario: Konvergenz-Retry verwendet bereits live laufenden Zieldigest

- **WHEN** ein vorheriger Versuch den Staging-geprüften Zieldigest bereits ausgerollt hat
- **AND** der vorherige Fehler als retryfähige Infrastrukturkonvergenz klassifiziert oder die Ursache dokumentiert wurde
- **THEN** darf der Retry dieselbe Staging-Digest-Evidenz verwenden

### Requirement: Backup-Agent-Capabilities werden vor dem Auftrag live validiert

Das System SHALL den tatsächlich laufenden Backup-Agenten über einen geschützten read-only Capability-Endpoint prüfen, bevor ein Backup-Auftrag erzeugt wird.

#### Scenario: Agent erfüllt den Consumer-Vertrag

- **WHEN** der Promote ein Backup benötigt
- **THEN** validiert er Protokollversion, Agent-Revision, Datenbankziele, Ergebnisfelder und Waste-Inventar-Unterstützung
- **AND** erzeugt erst danach den signierten Backup-Auftrag

#### Scenario: Agent ist nicht kompatibel

- **WHEN** eine benötigte Capability oder Ergebnisversion fehlt
- **THEN** stoppt der Promote vor Backup und Zielmutation mit `PROMOTE_BACKUP_AGENT_INCOMPATIBLE`
- **AND** nennt die Meldung den erforderlichen Producer-vor-Consumer-Rollout ohne sensitive Agent-Konfiguration auszugeben

### Requirement: Swarm- und HTTP-Konvergenz werden getrennt verifiziert

Das System SHALL nach dem Deploy zuerst den erfolgreichen terminalen Swarm-Service- und Task-Zustand abwarten und erst danach das begrenzte externe HTTP-Warmup starten.

#### Scenario: Traefik bindet Router vorübergehend neu

- **WHEN** Root-, Health-, IAM- und Tenant-Probes während eines Warmup-Versuchs ausschließlich mit 404, 502, 503, 504, Timeout oder Gateway-Fehlern scheitern
- **THEN** wiederholt der Workflow die blockierenden Probes bis zum Erfolg oder Ablauf des Warmup-Fensters
- **AND** aggregiert Versuchszahl, Statusverteilung und Retryklassifikation ohne Logflut pro Tenant

#### Scenario: Swarm-Service konvergiert nicht

- **WHEN** Service-Update oder gewünschte App-Tasks keinen erfolgreichen terminalen Zustand erreichen
- **THEN** startet der Workflow den externen Smoke nicht
- **AND** endet mit `PROMOTE_SWARM_CONVERGENCE_TIMEOUT` oder einem spezifischeren Swarm-Fehlercode

#### Scenario: Fachlicher Tenant-Vertrag ist falsch

- **WHEN** Release-Tenant-Realm oder Callback-URI vom erwarteten Vertrag abweichen
- **THEN** ist der Fehler nicht retryfähig
- **AND** endet der Promote mit `PROMOTE_SMOKE_REALM_MISMATCH` beziehungsweise `PROMOTE_SMOKE_CALLBACK_MISMATCH`

#### Scenario: Production-Readiness bleibt degradiert

- **WHEN** `health/ready` nach dem Warmup-Fenster nicht HTTP 200 liefert
- **THEN** ist der Promote mit `PROMOTE_READINESS_NOT_READY` fehlgeschlagen
- **AND** HTTP 503 wird nicht als Erfolg akzeptiert

### Requirement: Promote-Fehler sind strukturiert, redigiert und handlungsorientiert

Das System SHALL für jede Promote-Phase stabile maschinenlesbare Fehlercodes, Retryklassifikation und eine konkrete nächste Aktion bereitstellen. GitHub-Annotation, Step-Summary und JSON-Evidenz müssen denselben terminalen Fehlercode verwenden.

#### Scenario: Ein bekanntes Gate schlägt fehl

- **WHEN** Config-Build, Preflight, Parität, Backup, Deploy, Konvergenz, Smoke oder Digest-Prüfung terminal fehlschlagen
- **THEN** enthält das Ergebnis Phase, `PROMOTE_`-Code, Umgebung, `retryable`, nicht-sensitive Zusammenfassung und `nextAction`
- **AND** korreliert es GitHub Run-ID, Attempt, Image-Digest und Config-Revision, soweit bereits bekannt

#### Scenario: Ein unerwarteter interner Fehler tritt auf

- **WHEN** kein spezifischer Fehlercode zugeordnet werden kann
- **THEN** wird der Fehler als `PROMOTE_INTERNAL_ERROR` redigiert
- **AND** erscheinen interne Exceptiondetails nicht ungefiltert im GitHub-Step-Summary

#### Scenario: Evidenz wird persistiert

- **WHEN** der Workflow strukturierte Logs oder Evidenz schreibt
- **THEN** enthält sie keine Secret-Werte, Secret-Hashes, Wertlängen, vollständigen Environment-Dumps, unredigierten Remote-Logs oder PII

### Requirement: Recovery-Evidenz bleibt minimal und reproduzierbar

Das System SHALL vorherigen und neuen Image-Digest, Git-Grenzen, versionierte nicht-sensitive Config-Revision, externe Secret-Referenznamen, Backup-Agent-Vertrag und blockierende Gate-Ergebnisse redigiert erfassen. Der Change SHALL keinen automatischen Rollback oder eine vollständige Secret-Historisierung voraussetzen.

#### Scenario: App-Rollback wird vorbereitet

- **WHEN** ein fehlgeschlagener Promote auf den vorherigen App-Digest zurückgeführt werden soll
- **THEN** verwendet der kontrollierte Pfad den vorherigen Digest und dessen versionierte nicht-sensitive Config-Revision
- **AND** setzt er Rückwärtskompatibilität des geschützten Override-Bundles voraus
- **AND** verlangt für eine inkompatible Secret-Rotation einen separat geprüften Rollback- oder Recovery-Plan
