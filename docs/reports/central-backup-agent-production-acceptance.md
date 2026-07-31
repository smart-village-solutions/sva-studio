# Production-Abnahme des zentralen Backup-Agenten

> **Historischer Zwischenstand:** Die hier noch als offen bezeichnete vollständige Promote-Abnahme wurde am 31. Juli 2026 abgeschlossen. Maßgeblich sind der [finale Rollout-Nachweis](./backup-agent-rollout-abnahme-2026-07-31.md) und der [kanonische Studio-Rollout](../guides/studio-rollout-process.md).

## Ergebnis

Der zentrale Backup-Agent wurde am 31. Juli 2026 nach expliziter
Production-Freigabe erfolgreich für die Produktionsdatenbank abgenommen. Der
GitHub-Actions-Lauf
[30586702874](https://github.com/smart-village-solutions/sva-studio/actions/runs/30586702874)
endete erfolgreich.

Der Auftrag `gha-30586702874-1` erzeugte im Bucket
`studio-db-backup-production` einen PostgreSQL-Custom-Dump mit 1.771.009 Byte.
Der Agent lud das Objekt erneut herunter und bestätigte:

- Größenübereinstimmung und SHA-256-Prüfsumme,
- ein separat persistiertes `.sha256`-Objekt,
- ein mit `pg_restore` lesbares Archiv,
- ein terminales, redigiertes Ergebnisobjekt mit Status `succeeded`.

Der geprüfte Dump liegt unter dem Präfix `prod/2026-07-30T22-20-55-899Z/`.
Request, Ergebnis, Dump und Prüfsummen-Sidecar wurden unabhängig über den
S3-kompatiblen MinIO-Endpunkt verifiziert. Es handelt sich damit nicht um
temporäre GitHub-Runner-Artefakte.

## Verwendete unveränderliche Images

- Anwendungs-Digest:
  `sha256:753275384b5943c19a5e78eab1ff33adb6ad02c6f0412e43c04ecf726a170f0f`
- Backup-Agent:
  `ghcr.io/smart-village-solutions/sva-studio-backup-agent@sha256:65ab2ce1fc613ccdb33b7eff3955efd470d2fc4c302effd39b6b29e6e209b6b4`

## Operative Korrektur

Vor der erfolgreichen Abnahme wurde festgestellt, dass das eingebundene
Production-Datenbank-Secret nicht dem laufenden Fileserver entsprach. Der Wert
wurde ohne Ausgabe oder Protokollierung als versioniertes Swarm-Secret
`backup_prod_postgres_password_v2` angelegt und unter dem unveränderten
Dateinamen des Agenten eingebunden. DNS-Ziel, Datenbankname und Datenbankbenutzer
wurden separat gegen den laufenden Production-Stack geprüft.

Zugangsdaten, signierte Requests und Datenbankinhalte wurden weder in GitHub
Actions noch in diese Dokumentation übernommen.

## Noch offene Abgrenzung

Diese Abnahme erfüllt Task 5.3 von `add-central-backup-agent`. Der vollständige
Production-Promote aus Task 4.3 von `add-promote-backup-production-parity`
bleibt separat offen; ein erfolgreicher Backup-Drill allein belegt noch keinen
Promote einschließlich Migration, Bootstrap, Deployment und Smoke-Evidenz.
