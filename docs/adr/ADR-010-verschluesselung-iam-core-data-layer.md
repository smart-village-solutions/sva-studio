# ADR-010: Verschlüsselungsstrategie für IAM Core Data Layer

**Status:** Proposed
**Entscheidungsdatum:** 2026-02-27
**Entschieden durch:** IAM/Core Team
**GitHub Issue:** TBD
**GitHub PR:** TBD

---

## Kontext

Mit `add-iam-core-data-layer` werden sensible IAM-Daten (`Credentials`, PII, Audit-Daten mit PII-Anteilen) in Postgres persistiert. Für Child B ist gefordert, dass diese Daten at Rest verschlüsselt sind und der Schlüssel nicht in der Datenbank liegt.

Zusätzliche Randbedingungen:
- Lokale Entwicklung erfolgt über Docker-basiertes Postgres
- RLS schützt Mandantengrenzen, ersetzt aber keine Verschlüsselung
- Security-Review fordert direkte SQL-Prüfbarkeit: sensible Felder dürfen nicht im Klartext lesbar sein
- Schlüsselmanagement muss produktionsfähig erweiterbar sein (KMS/HSM)

## Entscheidung

Für sensible IAM-Felder wird **Application-Level Column Encryption (Envelope Encryption)** eingesetzt.

Konkret:
- Verschlüsselung/Entschlüsselung erfolgt in der Anwendung vor dem Schreiben bzw. nach dem Lesen
- Pro Feldtyp werden verschlüsselte Payloads als Ciphertext in Postgres gespeichert
- Datenverschlüsselungsschlüssel (DEK) werden mit einem Key-Encryption-Key (KEK) geschützt
- KEK liegt außerhalb der Datenbank (lokal: Env/Secret-Store; Produktion: KMS/HSM)

## Begründung

1. **Klare Trennung von Daten und Schlüsseln:** Schlüsselmateral bleibt außerhalb der DB und erfüllt die Non-Negotiable-Anforderung.
2. **Unabhängigkeit vom DB-Provider:** Gleiches Sicherheitsmodell in lokalem Docker-Postgres und späteren Betriebsumgebungen.
3. **Prüfbare At-Rest-Eigenschaft:** Direkte SQL-Abfragen liefern nur Ciphertext.
4. **Rotationsfähigkeit:** KEK/DEK-Rotation kann kontrolliert über die Applikationslogik erfolgen.
5. **Kompatibel mit RLS/Audit:** RLS bleibt für Isolation zuständig; Verschlüsselung schützt Daten zusätzlich bei Fehlkonfiguration oder Snapshot-Zugriff.

## Alternativen

### Alternative A: `pgcrypto` in der Datenbank

**Vorteile:**
- ✅ Nahe an SQL und Migrationen
- ✅ Keine zusätzliche App-Serialisierung nötig

**Nachteile:**
- ❌ Risiko, dass Schlüsselmaterial oder Entschlüsselungsfunktion zu nah an der DB landet
- ❌ Enge Kopplung an Postgres-Funktionen
- ❌ Schwerer konsistent über unterschiedliche Laufzeitumgebungen abzusichern

**Warum verworfen:**
Erhöht das Risiko unklarer Schlüsselgrenzen zwischen Anwendung und Datenbank.

### Alternative B: Nur Volume-/Disk-Encryption (TDE/Storage)

**Vorteile:**
- ✅ Geringer Implementierungsaufwand
- ✅ Transparent für Anwendungen

**Nachteile:**
- ❌ Schützt nicht gegen Klartextzugriff über SQL-Rollen
- ❌ Erfüllt die direkte SQL-Nichtlesbarkeit pro Feld nicht

**Warum verworfen:**
Nicht ausreichend für die geforderte feldbezogene Schutzwirkung.

## Konsequenzen

### Positive Konsequenzen
- ✅ Sensible IAM-Daten sind auch bei direktem DB-Lesezugriff nicht im Klartext sichtbar
- ✅ Schlüsselverwaltung ist sauber von Persistenz getrennt
- ✅ Einheitliches Sicherheitsmodell für Dev/CI/Prod

### Negative Konsequenzen
- ❌ Mehr Implementierungsaufwand in Repository-/Service-Schicht
- ❌ Zusätzlicher Testaufwand für Roundtrip, Fehlerfälle und Rotation
- ❌ Potenzielle Performancekosten bei häufigem De-/Encrypt

### Mitigationen
- Kryptografie in einem zentralen Core-Modul kapseln (kein Copy/Paste je Repository)
- Feldweise nur dort verschlüsseln, wo Schutzlevel „Vertraulich“ gilt
- Benchmarking für Hot Paths und ggf. selektives Caching entschlüsselter Werte im Request-Kontext

## Implementierungs-Roadmap

- [ ] Verschlüsselungsmodul in `packages/core` bereitstellen (AES-256-GCM, versioniertes Payload-Format)
- [ ] Persistenzfelder für „Vertraulich“-Daten auf Ciphertext-Storage umstellen
- [ ] Key-Provider-Interface definieren (Dev-Provider + KMS-Provider)
- [ ] Migration/Backfill-Strategie für bestehende Klartextdaten dokumentieren
- [ ] Tests ergänzen: SQL-Klartextverbot, Roundtrip, Key-Rotation, Fehlerpfade

## Verwandte ADRs

- ADR-009: Keycloak als zentraler Identity Provider
- Geplant: ADR zu `instanceId` als kanonischer Mandanten-Scope

## Gültigkeitsdauer

Diese ADR bleibt gültig, bis eine neue Sicherheits- oder Compliance-Anforderung ein anderes Verschlüsselungsmodell erzwingt.

**Nächste Überprüfung:** 2026-08-27
