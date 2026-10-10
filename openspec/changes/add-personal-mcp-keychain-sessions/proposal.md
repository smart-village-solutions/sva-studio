# Change: Persönliche MCP-Sitzungen im macOS-Schlüsselbund

## Why

Der persönliche MCP verliert nach Prozessende seine Anmeldung. Der Benutzer hat die sichere lokale Wiederverwendung von Refresh-Tokens ausdrücklich zur Implementierung freigegeben.

## What Changes

- Opt-in `SVA_STUDIO_MCP_PERSONAL_SESSION_STORAGE=keychain`, Standard bleibt `memory`.
- Bestehender Context-Manager speichert ausschließlich Refresh-Token, Subject, Account und eine vollständige Kontextbindung im macOS-Schlüsselbund.
- API-Zugriff restauriert die Sitzung durch OIDC-Refresh und Subject-Readback; ein interaktiver Login bleibt ein ausdrücklicher Benutzerwechsel.
- Logout löscht und widerruft; Shutdown erhält nur im Keychain-Modus die gespeicherte Sitzung.

## Scope und Nicht-Ziele

Ausschließlich `packages/studio-mcp`, Tests und bestehende Betriebs-/Architekturdokumentation. Keine neuen Dienste, Dependencies, Server-Rechte, Offline-Tokens, Passworteingaben, API-Routen oder Speicherung unter anderen Betriebssystemen.

## Sicherheitsinvarianten und Nachweise

1. Bindung an Kontext-ID, Art, Studio-Origin, Issuer, Client und Tenant; gespeichertes Subject muss beim Provider erneut bestätigt werden. Negative Binding-/Subject-Tests.
2. Kein Token in argv, Environment, Dateien, Ausgaben oder Fehlern; native `security -i` erhält den Base64-Record ausschließlich über stdin. Adaptertest und synthetischer macOS-Save/Load/Delete-Smoke.
3. Rotation wird vor Token-Rückgabe gespeichert; fehlende/ungültige Tokens und Speicherfehler sperren den API-Zugriff. Unit-Tests.
4. Kontextoperationen werden im vorhandenen Manager serialisiert. Logout kann eine laufende Wiederherstellung nicht wiederbeleben; während Browser-Login ist Restore gesperrt. Race-Tests.
5. Ein neuer interaktiver Login entfernt bereits vor dem Browserstart den alten Eintrag; ohne Refresh-Token bleibt kein alter Account restaurierbar. Ein Kontext speichert genau seine zuletzt ausdrücklich angemeldete Identität. Account-Wechsel-Test.

Ein konfigurierter Kontext wird durch genau einen aktiven MCP-Prozess verwendet; parallele Prozesse mit demselben Kontext und rotierenden Tokens werden nicht unterstützt. Ein gesperrter Schlüsselbund wird nicht automatisch entsperrt. OIDC-Sessionlaufzeiten und Fresh-Reauth bleiben Provider-/API-Verträge.

## Impact

- Affected specs: `iam-access-control`
- Affected code: bestehender persönlicher Auth-Pfad in `studio-mcp`
- Affected arc42: Abschnitt 08; bestehende ADR-067 wird fortgeschrieben.
