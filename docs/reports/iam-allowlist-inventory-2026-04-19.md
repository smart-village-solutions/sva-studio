# Inventur: `SVA_ALLOWED_INSTANCE_IDS` nach Registry-Cutover

**Datum:** 2026-04-19
**Zuordnung:** `openspec/changes/refactor-iam-runtime-diagnostics-contract`

## Ziel

Diese Inventur grenzt die verbleibende Nutzung von `SVA_ALLOWED_INSTANCE_IDS` nach dem Registry-Cutover ein und markiert, welche Pfade bereits auf registrygeführtes Verhalten umgestellt wurden und wo die Variable nur noch als lokaler oder migrationsbezogener Fallback bestehen bleibt.

## Befund

- **Produktive Tenant-Freigabe:** nicht mehr env-basiert. Tenant-Hosts werden in der Laufzeit gegen die zentrale Instanz-Registry validiert.
- **SDK-Fallback:** `packages/sdk/src/instance/config.server.ts` nutzt `SVA_ALLOWED_INSTANCE_IDS` weiter für Host-Parsing-Hilfen und Multi-Host-Konfiguration außerhalb des registrygeführten Serverpfads.
- **Ops-/Doctor-/Smoke-Pfade:** wurden in diesem Change für Remote-Profile auf registrygeführte Tenant-Targets umgestellt.
- **Lokale Hilfen:** `scripts/ops/runtime/local-instance-registry.ts` und lokale Runtime-Profile dürfen die Allowlist weiter als expliziten Bootstrap-/Kompatibilitätspfad verwenden.

## Verbleibende Stellen

### 1. SDK-Kompatibilitätspfad

- Datei: `packages/sdk/src/instance/config.server.ts`
- Rolle: Multi-Host-Helfer für `parseInstanceIdFromHost(...)` und kanonischen Auth-Host
- Bewertung: **bewusst verbleibender Fallback**
- Begründung: Dieser Pfad ist nicht mehr die autoritative Tenant-Freigabe für produktiven Traffic, bleibt aber als lokaler und migrationsbezogener Hilfsmechanismus bestehen.

### 2. Lokaler Registry-Bootstrap

- Datei: `scripts/ops/runtime/local-instance-registry.ts`
- Rolle: idempotente SQL-Erzeugung für lokale Registry-/Hostname-Basisdaten
- Bewertung: **bewusst lokal**
- Begründung: Der Zweck ist lokales Reproduzieren und Bootstrap, nicht produktive Freigabe.

### 3. Remote-Ops-Scopes

- Datei: `scripts/ops/runtime-env.ts`
- Vorher: Tenant-Auth-Proof, Hostname-Checks und externe Tenant-Smokes leiteten ihren Scope direkt aus `SVA_ALLOWED_INSTANCE_IDS` ab.
- Jetzt: Remote-Profile lesen Tenant-Targets bevorzugt aus `iam.instances` inklusive `primary_hostname` und `auth_realm`.
- Fallback: `SVA_ALLOWED_INSTANCE_IDS` bleibt nur bestehen, wenn Registry-Ziele nicht lesbar sind oder der Lauf bewusst lokal/übergangsweise erfolgt.

### 4. Runtime-Doku und Beispielprofile

- Dateien:
  - `docs/guides/swarm-deployment-runbook.md`
  - `docs/development/runtime-profile-betrieb.md`
  - `config/runtime/studio.vars.example`
- Bewertung: **auf lokalen/migrationsbezogenen Fallback eingegrenzt**

## Operative Leitplanken

- Remote-Doctor, Tenant-Auth-Proof und externe Deploy-Smokes sollen ohne expliziten Override aus der Registry arbeiten.
- Für gezielte Operator-Läufe steht `SVA_TENANT_SCOPE_INSTANCE_IDS` als expliziter Scope-Override zur Verfügung.
- Für tiefe Actor-Diagnose ist `SVA_DOCTOR_INSTANCE_ID` jetzt bewusst verpflichtend; es gibt keinen impliziten Fallback auf den ersten Allowlist-Eintrag mehr.

## Restschuld

- Der SDK-Fallback in `packages/sdk/src/instance/config.server.ts` bleibt vorerst bestehen und sollte in einem separaten Folgeblock nur dann weiter reduziert werden, wenn der verbleibende lokale Multi-Host-Bedarf sauber ersetzt ist.
- Architekturtexte, die `SVA_ALLOWED_INSTANCE_IDS` noch als autoritative Freigabequelle darstellen, müssen separat vollständig bereinigt werden.
