# ADR-048: Zentraler Backup-Agent mit gehärtetem HTTPS-Trigger

## Status

Angenommen

## Kontext

Der bisherige Promote-Pfad erzeugt pro Backup einen temporären Swarm-Stack. Der Pfad ist fail-closed, seine Task- und Log-Evidenz ist jedoch flüchtig. Ein dauerhafter Ausführungspunkt soll Backups für Staging und Production übernehmen, ohne eine allgemeine Remote-Shell einzuführen.

## Entscheidung

Ein einzelner `studio-backup-agent` wird als bewusst breite Vertrauenszone betrieben. Er ist mit den internen Staging- und Production-Netzen sowie dem bestehenden Traefik-Netz verbunden. Zwei exakte HTTPS-`POST`-Routen auf den vorhandenen Hosts lösen ausschließlich `backup-and-verify` aus.

GitHub authentisiert sich mit einem kurzlebigen OIDC-Token. Der Agent bindet dessen Claims an Repository, Environment und eine Allowlist der Workflows auf `main`. Zusätzlich signieren getrennte HMAC-Schlüssel die Requests für Staging und Production. Datenbankziele, Buckets und Credentials stammen ausschließlich aus der internen Umgebungs-Allowlist.

Der Agent persistiert den Request vor `202 Accepted`, verarbeitet global genau einen Auftrag und schreibt das terminale Ergebnis nach MinIO. Request-ID, Ablaufzeit, Digest und Production-Wartungsfenster werden fail-closed geprüft. Der bisherige temporäre Stack bleibt bis zur Betriebsabnahme über `BACKUP_EXECUTOR=temporary` verfügbar.

## Konsequenzen

- Der gemeinsame Agent vergrößert den möglichen Blast Radius und benötigt getrennte Secrets sowie strenge Request-Validierung.
- Der HTTPS-Ingress erweitert die Angriffsfläche, ist aber auf zwei Hosts, einen exakten Pfad und `POST` begrenzt.
- MinIO-Evidenz ersetzt flüchtige Task-Logs als autoritativen Erfolgskanal.
- Ein automatischer Restore bleibt ausgeschlossen.

## Alternativen

- Polling von MinIO wurde wegen unnötiger Latenz und Last verworfen.
- MinIO-Webhooks wurden verworfen, weil keine belastbare interne MinIO-zu-Swarm-Route nachgewiesen ist.
- `quantum-cli exec` wurde verworfen, weil es eine allgemeine Remote-Kommandoausführung statt eines engen Backup-Vertrags eröffnet.
