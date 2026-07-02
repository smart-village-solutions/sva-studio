# Umsetzungsplan für Content-List-Logging

> **Für Agenten:** Erforderlicher Sub-Skill: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans` verwenden, um diesen Plan Aufgabe für Aufgabe umzusetzen. Die Schritte nutzen Checkboxen (`- [ ]`) zur Nachverfolgung.

**Ziel:** Zielgerichtetes serverseitiges Fehler-Logging für `/api/v1/iam/contents` ergänzen, damit generische UI-Ladefehler mit dem tatsächlichen Backend-Fehler korreliert werden können.

**Architektur:** Den Response-Contract unverändert lassen und Logging nur an der serverseitigen Catch-Grenze ergänzen, an der der eigentliche Fehler aktuell verschluckt wird. Den vorhandenen Logger aus `@sva/server-runtime` verwenden und die Änderung mit fokussierten Vitest-Assertions absichern.

**Technik-Stack:** TypeScript, Vitest, `@sva/server-runtime`

---

### Aufgabe 1: Logging im API-Catch

**Dateien:**
- Anpassen: `apps/sva-studio-react/src/lib/iam-content-list-api.server.ts`
- Anpassen: `apps/sva-studio-react/src/lib/iam-content-list-api.server.test.ts`

- [ ] **Schritt 1: Fehlenden Test ergänzen**

Die bestehende Testprüfung `"returns a deterministic list error when the projected list handler throws"` um eine Assertion erweitern, die `logger.error(...)` mit Request-ID und normalisiertem Kontext erwartet.

- [ ] **Schritt 2: Test rot laufen lassen**

Ausführen: `pnpm nx run sva-studio-react:test:unit --testFiles=src/lib/iam-content-list-api.server.test.ts`
Erwartung: FEHLER, weil bisher kein Logger-Aufruf existiert.

- [ ] **Schritt 3: Minimale Implementierung umsetzen**

Einen modul-lokalen Logger mit `createSdkLogger({ component: 'iam-content-list-api' })` anlegen und innerhalb des GET-Catch loggen, bevor das bestehende `createListErrorResponse(...)` zurückgegeben wird.

- [ ] **Schritt 4: Test erneut laufen lassen**

Ausführen: `pnpm nx run sva-studio-react:test:unit --testFiles=src/lib/iam-content-list-api.server.test.ts`
Erwartung: ERFOLG.

- [ ] **Schritt 5: Commit**

```bash
git add apps/sva-studio-react/src/lib/iam-content-list-api.server.ts apps/sva-studio-react/src/lib/iam-content-list-api.server.test.ts docs/superpowers/plans/2026-07-02-content-list-logging.md
git commit -m "fix: log content list load failures"
```
