# Mainserver-Schnittstelle löschen Design

**Ziel:** Auf der Seite `/interfaces` soll die SVA-Mainserver-Schnittstelle wie andere Schnittstellen löschbar sein. Nach dem Löschen verschwindet der Eintrag vollständig aus der Liste.

**Kontext:** Die Oberfläche verwaltet Mainserver-Schnittstellen derzeit getrennt von generischen Schnittstellen. In der UI wird die Löschaktion für `mainserver` ausgeblendet, und der generische Delete-Pfad blockiert `sva-mainserver:<instanceId>` serverseitig ausdrücklich.

## Anforderungen

- Die Tabellenzeile für `SVA Mainserver` zeigt ebenfalls die Aktion `Löschen`.
- Die bestehende Bestätigungsdialog-Interaktion bleibt erhalten.
- Das Löschen entfernt die gespeicherte Mainserver-Konfiguration vollständig.
- Der generische Delete-Pfad bleibt für normale Schnittstellen unverändert.

## Architekturentscheidung

Die Löschung des Mainservers bleibt ein dedizierter Pfad. Statt die generische `deleteStoredInterface`-Logik für Mainserver zu öffnen, wird im Mainserver-Settings-Modul eine eigene Löschfunktion ergänzt und in `interfaces-api` für die Mainserver-ID speziell verdrahtet.

## Betroffene Dateien

- `apps/sva-studio-react/src/routes/interfaces/-interfaces-page.tsx`
- `apps/sva-studio-react/src/routes/interfaces/-interfaces-page.test.tsx`
- `apps/sva-studio-react/src/lib/interfaces-api.ts`
- `apps/sva-studio-react/src/lib/interfaces-api.test.ts`
- `packages/sva-mainserver/src/server/settings.ts`
- `packages/sva-mainserver/src/server/settings.test.ts`

## Tests

- UI-Test für die Löschaktion des Mainservers ergänzen.
- API-Test für das Routing auf den dedizierten Mainserver-Delete-Pfad ergänzen.
- Package-Test für die tatsächliche Löschung des gespeicherten Mainserver-Records ergänzen.
