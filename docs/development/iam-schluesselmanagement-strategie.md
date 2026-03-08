# IAM-Schlüsselmanagement-Strategie

## Ziel

Diese Strategie beschreibt das Schlüsselmanagement für Application-Level Encryption im IAM Core Data Layer.

## Grundprinzipien

- **Kein Schlüssel in der DB:** Schlüsselmaterial wird ausschließlich außerhalb von Postgres gehalten.
- **Keyring-Ansatz:** Mehrere Schlüsselversionen parallel erlaubt (Rotation ohne Downtime).
- **Aktiver Schlüssel:** Neue Verschlüsselungen verwenden immer den aktiven Key.
- **Rückwärtslesbarkeit:** Bestehende Ciphertexte bleiben mit älteren Key-IDs entschlüsselbar.

## Konfiguration (lokal/CI)

- `IAM_PII_ACTIVE_KEY_ID`: aktive Schlüssel-ID, z. B. `k1`
- `IAM_PII_KEYRING_JSON`: JSON-Objekt `{"k1":"<base64-32-byte-key>", "k2":"..." }`

Beispiel:

```env
IAM_PII_ACTIVE_KEY_ID=k1
IAM_PII_KEYRING_JSON={"k1":"MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="}
```

## Rotation

1. Neuen Schlüssel `k2` im Keyring ergänzen.
2. `IAM_PII_ACTIVE_KEY_ID` auf `k2` umstellen.
3. Optionalen Re-Encryption-Backfill für Bestandsdaten ausführen.
4. Alten Schlüssel erst entfernen, wenn alle relevanten Daten migriert sind.

## Produktionsanforderungen

- Schlüssel aus Secret-Manager/KMS beziehen (nicht aus statischer Datei).
- Zugriffe auf Key-Material auditieren.
- Schlüsselrotation mindestens halbjährlich oder bei Security-Incident.
- Staging/Prod-Schlüssel strikt trennen.

## Verifikation

- `pnpm nx run data:db:test:encryption` bestätigt, dass sensible PII-Felder bei direktem SQL-Zugriff nicht im Klartext erscheinen.
