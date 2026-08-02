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

## Risks / Trade-offs

- Neue Gates können zunächst legitime Promotes blockieren. Shadow-Modus und gestufte Aktivierung verschieben dieses Risiko vor Production.
- Der Candidate-One-shot greift read-only auf produktionsnahe Systeme zu. Minimale Berechtigungen, isolierter Temp-Stack und terminales Cleanup begrenzen den Einfluss.
- Das kompakte Secret-Override-Bundle bleibt vorerst monolithisch und nicht historisierbar. Der Change akzeptiert dies bewusst, solange Rückwärtskompatibilität gilt und inkompatible Rotationen einen eigenen Plan besitzen.
- Breite HTTP-Retries melden dauerhafte Infrastrukturfehler später. Das Warmup bleibt begrenzt; fachliche Vertragsfehler brechen sofort ab.
- Der neue Builder kann selbst fehlerhaft sein. Redigierte Äquivalenz, Dev und Staging müssen deshalb vor der Production-Aktivierung denselben erwarteten Rendervertrag nachweisen.

## Migration Plan

1. Config-Schema, getrackte nicht-sensitive Remote-Profile, Builder, Redaction und Fehlercodes implementieren.
2. Builder im Shadow-Modus gegen den bestehenden Pfad ausführen; keinerlei Environment-Secret oder Deploy-Ausgabe verändern.
3. Dev- und Staging-Abweichungen redigiert analysieren und den neuen Pfad erst bei nachgewiesener Äquivalenz aktivieren.
4. Dev autoritativ auf den Builder umstellen und vollständigen Promote nachweisen.
5. Candidate-One-shot, digestbasierte Production-Parität, Backup-Capabilities und zweistufige Konvergenz in Staging blockierend aktivieren.
6. Staging erfolgreich mit demselben App-Digest und allen neuen Evidenzen promoten.
7. Production-Konfiguration im Shadow-Modus attestieren und erst danach den Builder sowie neue Gates über das geschützte `prod`-Environment aktivieren.
8. Production unabhängig auf Root, Liveness, Readiness, Release-Tenant-Realm, Callback, Unknown-Host-Fail-closed und Live-Digest prüfen.

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
