## Context

Der bestehende Studio-Promote ist grundsätzlich funktionsfähig: Ein Image wird einmal gebaut, per Digest nach Dev, Staging und Production befördert, durch GitHub-Environments freigegeben, vor Staging und Production gesichert und anschließend live verifiziert. Die aufgetretenen Fehler lagen nicht in diesem Grundmodell, sondern an fehlenden Eingangs- und Kompatibilitätsprüfungen sowie einer zu engen Konvergenzklassifikation.

Der aktuelle Remote-Config-Vertrag verwendet ein monolithisches GitHub-Secret `APP_CONFIG`. Lokale Werkzeuge führen dagegen ignorierte Dateien wie `base.vars`, Profildateien und `*.local.vars` zusammen. Dadurch konnte eine lokale Override-Datei fälschlich das vollständige Remote-Bundle ersetzen. Die anschließende Production-Recovery zeigte außerdem, dass ein syntaktisch vorhandener IAM-Schlüsselbund fachlich inkompatibel sein kann und dass HTTP-404 während der Traefik-Neubindung nicht durch alle blockierenden Probes einheitlich als Warmup behandelt werden.

## Goals / Non-Goals

### Goals

- Falsche oder unvollständige Candidate-Konfigurationen stoppen vor jeder Zielmutation.
- Der bestehende Runtime- und Secret-Injektionsvertrag bleibt zunächst unverändert.
- App-only-Production-Promotes verlangen denselben erfolgreich in Staging geprüften Image-Digest.
- Backup-Agent-Versionen werden vor dem Auftrag kompatibel geprüft.
- Swarm- und HTTP-Konvergenz werden getrennt und nachvollziehbar bewertet.
- Jeder blockierende Fehler besitzt einen stabilen Code, eine Retryklassifikation und eine konkrete nächste Aktion.
- Neue Gates werden zuerst beobachtend und erst nach Dev-/Staging-Nachweis blockierend aktiviert.

### Non-Goals

- Migration des IAM-Schlüsselbunds oder sämtlicher Runtime-Secrets auf neue Secret-Datei-Verträge.
- Einführung eines externen Secret-Managers.
- Vollständige Historisierung aller geschützten Override-Werte.
- Automatischer App- oder Datenbank-Rollback.
- Zweiter kanonischer Deployment- oder Recovery-Workflow.
- Vergleich umgebungsspezifischer Staging- und Production-Config-Werte.
- Wiedereinführung eines Wartungsfenster-Inputs.

## Decisions

### 1. Getrackte nicht-sensitive Remote-Config plus geschützte Overrides

Neue getrackte Dateien unter `config/runtime/remote/` enthalten ausschließlich nicht-sensitive Remote-Konfiguration für Dev, Staging und Production. Eine typsichere Klassifikationsquelle beschreibt bekannte Schlüssel als `config`, `secret-value` oder `secret-reference` und markiert erforderliche sowie umgebungsspezifisch erlaubte Schlüssel.

Sensitive Overrides bleiben zunächst als kompaktes Secret im jeweiligen GitHub-Environment. Der Builder führt getracktes Zielprofil und geschützte Overrides deterministisch zusammen. Er validiert Pflichtwerte, Duplikate je Schicht, unbekannte Schlüssel, Platzhalter, Werttypen und die semantische Trennung von Secret-Werten und Referenzen. Ein Schlüssel mit `_SECRET_NAME` oder `_SECRET_REF` darf ausschließlich einen Referenznamen enthalten.

`config/runtime/*.local.vars` bleibt lokale Diagnose- und Recovery-Konfiguration. Der Remote-Builder akzeptiert diese Pfade weder direkt noch als geschützte Override-Quelle. Der bestehende IAM-Schlüsselbund bleibt während dieses Changes in der bisherigen geschützten Injektion; seine fachliche Eignung wird vor dem Deploy geprüft, nicht durch einen neuen Mountvertrag ersetzt. Das Waste-Provisioner-Passwort bleibt im bereits vorhandenen externen Swarm-Secret, während Remote-Konfiguration ausschließlich dessen Namen enthält.

### 2. Shadow-Modus vor autoritativer Aktivierung

Der Builder wird zuerst zusätzlich zum bestehenden Pfad ausgeführt, ohne dessen Deploy-Ausgabe zu ersetzen. Eine redigierte Äquivalenzprüfung vergleicht:

- Schlüsselmengen,
- nicht-sensitive kanonische Werte,
- Secret-Klassifikationen,
- externe Secret-Referenznamen,
- resultierende nicht-sensitive Compose-/Stack-Struktur.

Secret-Werte, deren Hashes oder Längen werden nicht verglichen oder ausgegeben. Abweichungen erzeugen im Shadow-Modus strukturierte Warnungen und blockieren die Umschaltung auf den neuen Builder. Erst nach erfolgreichem Shadow-Nachweis wird der Builder nacheinander in Dev, Staging und Production autoritativ.

### 3. Statischer und read-only Candidate-Preflight

Der statische Preflight läuft im GitHub-Runner und prüft Config-Schema, Vollständigkeit, Referenzen und Umgebungsscope. Danach startet ein isolierter Candidate-One-shot im Ziel-Swarm mit Zielimage, Candidate-Konfiguration und denselben benötigten Secret-Mounts.

Der Candidate besitzt keine Migration-, Bootstrap- oder fachlichen Schreibrechte. Er prüft ausschließlich Runtime-Profil, externe Secret-Referenzen, Registry-Lesbarkeit, Release-Tenant-Scope und Entschlüsselbarkeit aktiver Tenant-Secrets. Der Job wird vor Backup und App-Deploy terminal ausgewertet und entfernt. Ein Fehler stoppt fail-closed vor der ersten Zielmutation.

### 4. Ein Promote-Workflow mit Standard- und Recovery-Modus

`promote_mode=standard` bleibt der Default. In Production verlangt der Standardmodus vor der Mutation einen bestehenden Readiness-Zustand HTTP 200.

`promote_mode=recovery` erlaubt einen degradierten Ausgangszustand ausschließlich innerhalb desselben `Promote`-Workflows. Er verlangt einen nicht leeren dokumentierten Recovery-Grund, eine erneute geschützte Environment-Freigabe, vorherigen Live-Digest, Backup, Staging-Digest-Parität und vollständige Post-Deploy-Verifikation. Der Modus lockert weder Migration-/Bootstrap-Gates noch finale Readiness-, Tenant- oder Digest-Prüfungen.

### 5. Staging-Parität bleibt bewusst digestbasiert

Wenn der Production-Zieldigest vom Live-Digest abweicht, muss eine erfolgreiche Staging-Promotion exakt dieses Digests vorliegen. Git-Grenzen und OCI-Revision werden weiterhin separat durch den Imagevertrag geprüft. Staging- und Production-Konfiguration werden nicht wertmäßig verglichen; Builder und Candidate-Preflight attestieren jede Umgebung eigenständig.

Ein Konvergenz-Retry mit bereits live laufendem Zieldigest darf dieselbe Staging-Evidenz wiederverwenden, wenn der vorherige Fehlercode retryfähige Infrastrukturkonvergenz ausweist oder die Ursache vor dem Retry dokumentiert wurde.

### 6. Backup-Agent-Capabilities werden live abgefragt

Der Agent stellt innerhalb derselben OIDC-/HMAC-Vertrauensgrenze wie Backup-Aufträge einen geschützten read-only Capability-Endpoint bereit. Die Antwort enthält nur nicht-sensitive Vertragsdaten:

- Protokollversion,
- laufende Agent-Revision,
- unterstützte Datenbankziele,
- unterstützte Ergebnisfelder,
- Waste-Inventar-Unterstützung.

Der Workflow prüft seine Mindestanforderungen vor dem ersten Backup-Auftrag. Neue Consumer-Anforderungen dürfen erst blockierend werden, nachdem der kompatible Agent ausgerollt und live nachgewiesen wurde.

### 7. Zweistufige Konvergenz

Nach dem Deploy wartet der Workflow zuerst auf den erfolgreichen terminalen Zustand des Swarm-Service-Updates und der gewünschten App-Tasks. Erst danach beginnt das begrenzte externe HTTP-Warmup.

Ein HTTP-Versuch ist retryfähig, wenn alle blockierenden Fehler ausschließlich aus 404, 502, 503, 504, Timeout oder Gateway-Zuständen bestehen. Das gilt für Root-, Health-, IAM- und Tenant-Probes. Nicht retryfähig bleiben falsches Realm, falsche Callback-URI, fehlender Release-Tenant-Scope, Secret- oder Entschlüsselungsfehler, falscher Digest und ein betriebsbereiter unbekannter Host. Production akzeptiert am Ende nur HTTP 200 von `health/ready`.

### 8. Stabiler Logging- und Fehlercodevertrag

Jede Phase liefert einen strukturierten Zustand für `config-build`, `static-preflight`, `candidate-preflight`, `staging-parity`, `backup-capabilities`, `backup`, `migration`, `bootstrap`, `deploy`, `swarm-convergence`, `external-smoke`, `digest-verification` und `evidence`.

Ein terminaler Fehler enthält mindestens:

- stabilen Code mit Präfix `PROMOTE_`,
- Phase,
- Zielumgebung,
- nicht-sensitive Zusammenfassung,
- `retryable: true|false`,
- konkrete `nextAction`,
- GitHub Run-ID und Attempt,
- Image-Digest und nicht-sensitive Config-Revision, soweit bereits bekannt.

Beispiele sind `PROMOTE_CONFIG_SOURCE_FORBIDDEN`, `PROMOTE_CONFIG_REQUIRED_KEY_MISSING`, `PROMOTE_PREFLIGHT_TENANT_SECRET_UNREADABLE`, `PROMOTE_PARITY_DIGEST_MISMATCH`, `PROMOTE_BACKUP_AGENT_INCOMPATIBLE`, `PROMOTE_SWARM_CONVERGENCE_TIMEOUT`, `PROMOTE_SMOKE_REALM_MISMATCH`, `PROMOTE_READINESS_NOT_READY` und `PROMOTE_LIVE_DIGEST_MISMATCH`. Unerwartete Fehler werden als `PROMOTE_INTERNAL_ERROR` redigiert, ohne interne Exceptiondetails im Step-Summary auszugeben.

GitHub-Annotations, Step-Summary und JSON-Evidenz verwenden denselben Fehlercode. Retryversuche werden pro Versuch aggregiert, damit eine große Tenant-Matrix keine Logflut erzeugt. Secret-Werte, Secret-Hashes, Wertlängen, vollständige Environment-Dumps, unredigierte Remote-Logs und PII sind ausgeschlossen.

### 9. Minimaler Recovery-Nachweis statt vollständiger Secret-Historisierung

Die Rollout-Evidenz erfasst vorherigen und neuen Image-Digest, Git-Grenzen, nicht-sensitive Config-Revision, externe Secret-Referenznamen, Backup-Agent-Vertrag und Ergebnisse der blockierenden Gates. Der Change führt keinen automatischen Rollback ein.

Ein App-Rollback verwendet den vorherigen Digest zusammen mit der zugehörigen versionierten nicht-sensitiven Config-Revision. Das verbleibende geschützte Override-Bundle muss rückwärtskompatibel bleiben. Eine inkompatible Secret-Rotation benötigt vorab einen separat geprüften Rollback- beziehungsweise Recovery-Plan.

### 10. Einmaliger Staging-Übergang für ein fehlendes Live-Config-Label

Der Legacy-Übergang ist kein allgemeiner Recovery- oder Seed-Pfad, sondern ein geschützter Zwei-Run-Handshake innerhalb desselben `Promote`-Workflows. Ein erster `workflow_dispatch` mit dem expliziten Vorbereitungsmodus `prepare-staging-live-config-label` läuft für Staging als `standard`, Same-Digest sowie mit Migration und Bootstrap jeweils `assert-none`; er akzeptiert noch keine Run-Referenz. Er verwendet den vor dem Source-Wechsel konservierten aktuellen Controller, baut das tatsächlich ausgewählte autoritative Deploy-Bundle und attestiert in einem eigenen H1-Gate einen atomaren Live-Snapshot mit exakt demselben Digest und Labelzustand `missing`. Ein gültiges oder ungültiges Label sowie ein Digestwechsel stoppen bereits dort. Nur danach endet der Lauf deterministisch mit `PROMOTE_RECOVERY_CONTEXT_INVALID`; Candidate, Backups, Deploy und Staging-Parität bleiben `skipped`. Seine redigierte Promote-Evidenz mit dem festen Preparation-Marker ist die einzige mögliche Autorisierungsquelle für den zweiten Lauf.

Der zweite Lauf verlangt den expliziten Modus `seed-staging-live-config-label` sowie die genaue Run-ID und den Attempt dieses unmittelbar vorherigen Fehlversuchs. Diese Eingaben existieren ausschließlich für `workflow_dispatch`; reusable Aufrufer können den Übergang nicht aktivieren. Der Controller liest außerdem den aktuell ausführenden Seed-Run über dessen GitHub-Run-ID, -Nummer, -Attempt und Workflow-SHA. Beide Runs müssen dieselbe Workflow-ID besitzen und die Run-Nummer des Prepare-Laufs muss exakt um eins kleiner sein; jeder intervenierende Promote blockiert. Der Controller akzeptiert ausschließlich einen abgeschlossenen fehlgeschlagenen `Promote`-Attempt aus `main`, dessen schema-strikte Evidenz Staging, Standardmodus, den festen Preparation-Marker, identische Git-Grenzen, denselben aktuellen Live- und Zieldigest, die aktuelle ausgewählte Config-Revision, kanonische Main-E2E-Evidenz, alle bereits erreichten Pre-Mutation-Gates und den exakten terminalen H3-STOP belegt. Backup-, Migration-, Deploy-, Konvergenz-, Smoke- und Digest-Gates des Vorlaufs müssen noch `skipped` sein; Cleanup muss bestanden sein. Run, Attempt, direkte Vorgängerbeziehung, einziges nicht abgelaufenes Artefakt und einzige Root-JSON-Datei werden nach dem Download erneut geprüft.

Der Live-Snapshot unterscheidet ein fehlendes Label von einem vorhandenen ungültigen oder gültigen Label, ohne den Rohwert auszugeben. Nur `missing` ist seedbar. Digest und Labelzustand werden vor und nach der Artefaktprüfung sowie unmittelbar vor dem Deploy erneut aus demselben Service-Snapshot gelesen. Ein Digestwechsel, ein inzwischen vorhandenes Label oder ein ungültiger Labelwert beendet den Übergang. Damit ist derselbe Seed nach einem erfolgreichen Lauf technisch nicht erneut zulässig.

Da der promotete Legacy-`change_head` das H3-Overlay und den gemeinsamen Digest-/Config-Readback noch nicht enthält, bewahrt der Workflow den vollständigen H4-Controller-Importgraph vor dem Source-Wechsel. Ein controller-eigenes Staging-only Compose-Overlay ergänzt ausschließlich `sva.config.revision=${SVA_CONFIG_REVISION}` am App-Service. Ein struktureller Rendervergleich lehnt jede weitere Stack-Abweichung ab. Dev und Production erhalten dieses Overlay nie. Der gemäß ADR-048 kanonische Backup-Executor wird bei fehlender Variable als `agent` normalisiert; `temporary` und unbekannte Werte sind für Prepare und Seed gesperrt. Candidate, Main-E2E, blockierende Backup-Capabilities, frische Studio-/Waste-Backups, Deploy, Swarm-Konvergenz, Runtime-Smoke und gemeinsamer finaler Digest-/Config-Readback bleiben unverändert blockierend.

Die H1-Evidenz erfasst den allowlisteten Preparation-Marker, die Seed-Autorisierung und eigene Gates, aber keine URL, keinen Actor, keinen Grund und keinen Labelrohwert. `config.previousRevision` und `rollback` bleiben `null`, weil der Übergang keine historische Config-Bindung erfindet. Prepare und Seed schreiben bewusst kein Production-fähiges Staging-Paritätsartefakt. Der historische erfolgreiche Staging-Run `32212677551` dient nur als read-only Cross-Check der bekannten Digest-, Source- und Config-Werte; er ist keine automatische Autorisierung und wird im Verifier nicht hardcodiert.

### 11. Einmaliger Production-Übergang mit vorgeschaltetem Shadow-Nachweis

Production erhält keinen direkten Label-Seed und verwendet nicht den Staging-Vertrag. Ein eigener, workflow-dispatch-only Zwei-Run-Handshake bindet den Legacy-Übergang an das geschützte `prod`-Environment. Der Prepare-Lauf ist `standard`, Same-Digest und verwendet `change_base=change_head` sowie Migration und Bootstrap jeweils `assert-none`. Er verlangt den Config-Builder im Shadow-Modus und Candidate- sowie Backup-Capability-Gates im Shadow-Modus. Der tatsächlich selektierte Legacy-Deploy-Bundle-Hash und die Candidate-Konfiguration müssen redigiert äquivalent sein. Der aktuelle Production-Service muss aus einem atomaren Snapshot denselben Digest, ein fehlendes Config-Label und erfolgreiche Readiness belegen.

Nach dem lokalen Shadow-Nachweis durchläuft Prepare die read-only Staging-Paritäts-, Candidate- und Backup-Capability-Prüfungen. Nur wenn alle beobachtenden Gates tatsächlich bestanden haben, erzeugt der Workflow einen festen Production-Preparation-Marker und stoppt deterministisch vor Backup, Migration, Bootstrap und Deploy. Ein fehlgeschlagenes beobachtendes Gate, ein vorhandenes oder ungültiges Label, ein Digestwechsel oder eine Config-Abweichung ist keine Seed-Autorisierung.

Vor dem Seed werden der Production-Builder auf `authoritative` und Main-E2E-/Candidate-/Backup-Capability-Gates auf `enforce` gesetzt. Der Seed muss der unmittelbar folgende Promote-Run desselben Workflows sein und referenziert Run-ID sowie Attempt des Prepare-Laufs. Run, Attempt, direkte Run-Nummernfolge, einziges nicht abgelaufenes Promote-Artefakt, einzelne Root-JSON-Datei, feste Gatematrix, Digest, Source-SHA, Config-Revision und Live-Snapshot werden vor sowie unmittelbar vor Deploy erneut geprüft. Ein controller-eigenes Production-only Overlay darf ausschließlich `sva.config.revision` ergänzen; ein struktureller Rendervergleich verbietet jede weitere Änderung. Frische Studio-/Waste-Backups, Agent-Capabilities, Candidate, Deploy, Konvergenz, Runtime-Smoke und gemeinsamer Digest-/Config-Readback bleiben blockierend. Der Seed erzeugt keine Staging-Parität und erfindet keine vorherige Config-Revision oder Rollback-Evidenz.

Erst nach dem erfolgreichen Same-Digest-Seed ist der normale Production-Promote des bereits erfolgreich in Staging geprüften Ziel-Digests zulässig. Dieser Lauf verwendet den unveränderten Digest aus der v2-Staging-Parität, `migration_mode=run` und `bootstrap_mode=run`, die geschützte Production-Freigabe und alle Enforce-Gates. Das nun vorhandene Live-Label bindet den vorherigen Production-Digest an seine Config-Revision und stellt den H3-Rollback-Vertrag wieder her.

## Risks / Trade-offs

- Neue Gates können zunächst legitime Promotes blockieren. Shadow-Modus und gestufte Aktivierung verschieben dieses Risiko vor Production.
- Der Candidate-One-shot greift read-only auf produktionsnahe Systeme zu. Minimale Berechtigungen, isolierter Temp-Stack und terminales Cleanup begrenzen den Einfluss.
- Das kompakte Secret-Override-Bundle bleibt vorerst monolithisch und nicht historisierbar. Der Change akzeptiert dies bewusst, solange Rückwärtskompatibilität gilt und inkompatible Rotationen einen eigenen Plan besitzen.
- Breite HTTP-Retries melden dauerhafte Infrastrukturfehler später. Das Warmup bleibt begrenzt; fachliche Vertragsfehler brechen sofort ab.
- Der neue Builder kann selbst fehlerhaft sein. Redigierte Äquivalenz, Dev und Staging müssen deshalb vor der Production-Aktivierung denselben erwarteten Rendervertrag nachweisen.

## Change-Grenze und Wiederaufnahme

`harden-studio-promote-contract` besitzt das generische Promote-Fundament: Phasen, Fehlercodes, Redaction, Annotation, Step-Summary, JSON-Evidenz und die garantierte Platzierung read-only arbeitender Gates vor der ersten Remote-Mutation. Der Change implementiert keine App-E2E-Trigger, keine E2E-Scope-Logik und keine E2E-spezifische Staging-Entscheidung. Diese fachliche Erweiterung gehört ausschließlich zu `accelerate-pr-failure-feedback`.

Die gemeinsame Umsetzung folgt zwingend dieser Reihenfolge:

1. **H1 – Promote-Evidenzfundament:** In diesem Change werden die Tasks 5.1, 5.2, 5.3 und 5.5 samt kleinstem relevanten Gate aus 7.6 abgeschlossen. Die vorhandene Pre-Mutation-Platzierung aus 2.1 bleibt der Integrationspunkt.
2. **A1 – Main-E2E-Producer:** Erst nach dem H1-Checkpoint implementiert `accelerate-pr-failure-feedback` seine Tasks 5.1 bis 5.4 ohne Änderung an `promote.yml`.
3. **A2 – Staging-Consumer:** Erst wenn der Producer auf dem gemeinsamen Branchstand verfügbar ist, implementiert `accelerate-pr-failure-feedback` die Tasks 6.1 und 6.2 durch Wiederverwendung des H1-Vertrags.
4. **A3 – Shadow und Aktivierung:** Der blockierende Staging-Preflight folgt ausschließlich über Task 7.3 des Accelerate-Changes. Die übrigen Live-/Konvergenzaufgaben dieses Changes bleiben davon unabhängig und dürfen A1 nicht unnötig blockieren.

Für jede Wiederaufnahme gelten `tasks.md`, der aktuelle Git-Diff und nachgewiesene Testergebnisse gemeinsam als Wahrheit. Ein Task wird erst nach vollständigem Code-, Test- und gegebenenfalls Dokumentationsnachweis abgehakt. Teilweise Arbeit bleibt unchecked. Nach jedem abgeschlossenen Block werden exakter HEAD, ausgeführte Gates, beide strikten OpenSpec-Validierungen und der nächste freigegebene Block festgehalten. Ein neuer Lauf beginnt mit dem ersten unchecked Task des aktiven Blocks und vergleicht vorhandene Änderungen gegen dessen vollständige Akzeptanzbeschreibung, statt frühere Sitzungsannahmen zu übernehmen.

## Migration Plan

1. Config-Schema, getrackte nicht-sensitive Remote-Profile, Builder, Redaction und Fehlercodes implementieren.
2. Builder im Shadow-Modus gegen den bestehenden Pfad ausführen; keinerlei Environment-Secret oder Deploy-Ausgabe verändern.
3. Dev- und Staging-Abweichungen redigiert analysieren und den neuen Pfad erst bei nachgewiesener Äquivalenz aktivieren.
4. Dev autoritativ auf den Builder umstellen und vollständigen Promote nachweisen.
5. Candidate-One-shot, digestbasierte Production-Parität, Backup-Capabilities und zweistufige Konvergenz in Staging blockierend aktivieren.
6. Staging erfolgreich mit demselben App-Digest und allen neuen Evidenzen promoten.
7. Production-Konfiguration im Shadow-Modus attestieren und erst danach den Builder sowie neue Gates über das geschützte `prod`-Environment aktivieren.
8. Production unabhängig auf Root, Liveness, Readiness, Release-Tenant-Realm, Callback, Unknown-Host-Fail-closed und Live-Digest prüfen.
9. Falls das Staging-Live-Label aus dem Legacy-Stand fehlt, zuerst einen ausdrücklich ausgewählten fail-closed Pre-Seed-Lauf erzeugen und danach genau einmal den evidenzgebundenen Staging-Seed ausführen; Production bleibt davon unberührt.
10. Falls das Production-Live-Label aus dem Legacy-Stand fehlt, einen eigenen Shadow-Prepare-Lauf ausführen, danach ohne intervenierenden Promote auf `authoritative/enforce` umschalten und genau einmal den evidenzgebundenen Production-Seed ausführen; erst anschließend den in Staging geprüften Zieldigest regulär promoten.

## Resolved Decisions

- Ein fokussierter Change statt Aufteilung oder breiter Secret-Migration.
- Getrackte nicht-sensitive Remote-Config plus kompaktes geschütztes Override-Bundle.
- Ein Workflow mit `standard` und `recovery`.
- Minimaler Rollback-Nachweis statt vollständiger Secret-Historisierung.
- Statischer plus read-only Candidate-Preflight.
- Geschützter Backup-Capability-Endpoint.
- Zweistufige Swarm-/HTTP-Konvergenz.
- Staging-Parität ausschließlich über exakt denselben erfolgreichen Image-Digest.
- Shadow- und Stufenrollout vor blockierender Production-Aktivierung.
