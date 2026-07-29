## Context

Der aktuelle Backup-Mechanismus erzeugt für jeden mutierenden Promote einen temporären Swarm-Stack. Der Container ist nach dem Lauf entfernt; dessen Logs können abhängig vom Remote-Logkanal unvollständig sein. Der zentrale Agent schafft einen dauerhaften, überprüfbaren Ausführungspunkt für beide Umgebungen.

## Goals / Non-Goals

### Goals

- Ein zentraler Agent führt nur definierte Backup- und Validierungsaufträge für `staging` oder `prod` aus.
- Der Auftrags-, Ausführungs- und Ergebnisnachweis ist unabhängig von flüchtigen Swarm-Logs dauerhaft in MinIO vorhanden.
- Der Promote-Pfad bleibt fail-closed und nutzt ausschließlich erfolgreiche, zum Request passende Ergebnisobjekte.
- Production bleibt manuell, imagegebunden und freigabegeschützt.

### Non-Goals

- Keine allgemeine Job- oder Queue-Plattform für beliebige Betriebsaufgaben.
- Keine parallele Einführung eines zweiten Backup-Systems oder eines Restore-Automaten.
- Keine Aufweichung der getrennten Staging-/Production-Buckets oder der bestehenden Aufbewahrung.

## Decisions

### Ein zentraler Agent als explizite Vertrauenszone

Es gibt genau einen `studio-backup-agent` mit einer Replica. Er ist kein Teil des langlebigen Studio-App-Stacks, hat keine öffentlichen Ports und wird auf einem für operative Dienste vorgesehenen Swarm-Node platziert. Der Agent ist mit den internen Staging- und Production-Netzen verbunden und erhält getrennte Secrets für beide Datenbanken und beide Buckets.

Diese breite Berechtigung ist bewusst: Der Dienst ist der zentrale operative Backup-Ausführer. Die Umgebung wird als vertrauenswürdig vorausgesetzt; dennoch darf der Prozess nur aus einem kleinen, getesteten Befehlssatz bestehen und darf niemals Credentials oder Datenbankinhalte in Logs oder Ergebnisobjekte schreiben.

### Signierter, ereignisgetriebener Auftragskanal

GitHub sendet einen signierten, unveränderlichen Backup-Auftrag an den dedizierten HTTPS-Endpoint der Zielumgebung: `https://studio-staging.smart-village.app/_ops/backup/v1/requests` für Staging und `https://studio.smart-village.app/_ops/backup/v1/requests` für Production. Ein separater Traefik-Router akzeptiert ausschließlich `POST` für diesen exakten Pfad und leitet ihn an den Agenten weiter. Der Agent validiert GitHub-OIDC-Identität, Request-Signatur, Schema, Ablaufzeit, Request-ID, Zielumgebung und Ziel-Digest, persistiert den Auftrag im MinIO-Control-Präfix und antwortet erst dann mit `202 Accepted`. GitHub wartet auf das terminale Ergebnisobjekt. Der Endpoint erlaubt keine beliebigen Shell-Kommandos und liefert keine operativen Details nach außen.

Der Auftrag erlaubt ausschließlich `backup-and-verify`. Er enthält keine Zugangsdaten und keine frei interpretierbaren Kommandozeilen. GitHub-OIDC-Claims werden auf Repository, Workflow, Ref und Zielumgebung gebunden. Ungültige, abgelaufene oder wiederverwendete Requests werden abgelehnt und als redigierter Fehlernachweis festgehalten. Staging und Production verwenden getrennte Signaturschlüssel.

### Strikte Umgebungsbindung im Agenten

Die Zielumgebung ist eine geschlossene Allowlist (`staging`, `prod`). Erst nach ihrer Validierung löst der Agent daraus alle folgenden Werte ab: PostgreSQL-Host, Datenbank-Credentials, Zielbucket, Objektpräfix und Signatur-/Freigabekontext. Ein Auftrag für Staging kann daher weder Production-Postgres noch den Production-Bucket auswählen und umgekehrt.

### Evidenz als autoritativer Erfolgskanal

Pro Request schreibt der Agent mindestens einen Status, redigierte Schritt-Ereignisse, Objektpfad, Größe, SHA-256-Wert und Archivvalidierung. Der Ablauf bleibt: Custom-Dump → Upload → Download → Größen-/SHA-256-Vergleich → `pg_restore --list`. Ein Agent-Worker verarbeitet global nur einen Auftrag gleichzeitig. GitHub akzeptiert nur ein erfolgreiches Ergebnis mit derselben Request-ID, Umgebung und demselben Digest; sonst endet der Promote vor jeder Datenmutation.

### Production-Freigabe bleibt im Kontrollpunkt

Der Agent ersetzt keine GitHub-Environment-Freigabe. Der Promote-Workflow kann einen Production-Auftrag nur nach der dortigen Freigabe, mit Wartungsfenster-Verweis und nach erfolgreicher Staging-Parität erzeugen. Der Agent protokolliert den nicht-sensitiven Wartungsfenster-Verweis im Ergebnis, trifft aber keine menschliche Freigabeentscheidung.

## Risks / Trade-offs

- Ein zentraler Agent besitzt Zugriff auf beide Umgebungen. Die Blast-Radius-Grenze liegt daher beim Agenten statt bei zwei getrennten Services. Gegenmaßnahme sind minimales Image, kein öffentlicher Port, enge Request-Validierung, getrennte Secrets und vollständige Evidenz.
- Der neue Ingress erweitert die Angriffsfläche. Gegenmaßnahmen sind ein exakt eingeschränkter Pfad und Methode, TLS, GitHub-OIDC-Claim-Validierung, getrennte Signaturen, Ablaufzeit, Replay-Schutz, Rate-Limits und redigierte Antworten.
- Der Agent selbst wird zu einer kritischen Betriebsabhängigkeit. Healthcheck, Image-/Tool-Preflight, deterministisches Placement und ein dokumentierter kontrollierter Neustart sind deshalb Pflicht.
- Bis der Agent in beiden Umgebungen abgenommen ist, muss der bestehende temporäre Backup-Pfad erhalten bleiben.

## Migration Plan

1. Minimalen Agenten, Swarm-Service-Spec mit gehärtetem Traefik-Ingress und signierten Request-/Result-Vertrag implementieren.
2. Lokalen PostgreSQL-/MinIO-End-to-End-Test und Sicherheits-/Redaction-Tests etablieren.
3. Agent in Staging bereitstellen, dessen Laufzeitvertrag prüfen und einen Staging-Backup-Drill erfolgreich durchführen.
4. `Promote` und den Staging-Backup-Drill auf den Agenten umstellen; den temporären Pfad zunächst als kontrollierten Fallback behalten.
5. Nach erfolgreichem, freigegebenem Staging-Nachweis Production anschließen und denselben Drill durchführen.
6. Erst dann Task 4.3 von `add-promote-backup-production-parity` abschließen und den temporären Backup-Pfad in einem separaten Change entfernen.

## Aufbewahrung

Request-, Ereignis- und Ergebnisobjekte liegen getrennt unter einem `control/`-Präfix und unterliegen derselben 180-Tage-Lifecycle-Regel wie die Backup- und Diagnoseobjekte. Der Agent löscht keine Evidenzobjekte selbst.
