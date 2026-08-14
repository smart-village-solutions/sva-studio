# Change: Backup-Agent-Vertragsgrenzen entflechten

## Why

Die Request-Validierung des zentralen Backup-Agenten bündelt Form-, Ziel-, Zeit-, Objektpfad- und Importregeln in großen booleschen Funktionen. Dadurch sind unveränderte Sicherheitsregeln schwer einzeln nachzuweisen und Änderungen am produktiv ausgerollten Restore-Vertrag unnötig riskant.

## What Changes

- Die bestehende Backup- und Restore-Request-Validierung wird in kleine, reine und nach Verantwortlichkeit benannte Validatoren zerlegt.
- Die öffentlichen booleschen Fassaden und die kanonische Signaturbildung bleiben kompatibel.
- Eine Negativmatrix charakterisiert unbekannte Felder, Version und Aktion, Umgebung, Datenbank und Tenant, Ablaufzeit, SHA-256, Präfix, Pfadtraversal sowie den fest verdrahteten Waste-Import.
- Alle zur Laufzeit importierten Module werden mit expliziten `.mjs`-Pfadeinträgen in das Backup-Agent-Image übernommen.
- OIDC, Replay-Schutz, HMAC-Signaturen, Digest-/SHA-Prüfung, Bucket-/Präfixableitung und der geschützte Restore-Ablauf bleiben unverändert.

## Impact

- Affected specs: `deployment-topology`
- Affected code: `deploy/backup-agent/agent.mjs`, neue reine Validator-Module, `deploy/backup-agent/agent.test.ts`, `deploy/backup-agent/Dockerfile`
- Affected documentation: `docs/guides/swarm-deployment-runbook.md`
- Affected arc42 sections: `docs/architecture/05-building-block-view.md`, `docs/architecture/06-runtime-view.md`, `docs/architecture/08-cross-cutting-concepts.md`
- Security impact: Keine neue Request-Oberfläche und keine neue Aktion; die vorhandenen fail-closed Regeln werden lediglich als einzeln testbare Grenzen sichtbar gemacht.
