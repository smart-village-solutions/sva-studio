# Change: Refactor Waste Schedule Rules and Materialization

## Why
Die bisherige Übertragung zum Mainserver nutzt eine implizite und teils widersprüchliche Verschiebungslogik.
In der Praxis werden auf Basis von Regeln häufig keine konkreten Termine materialisiert, wodurch Mainserver-Synchronisationen leer bleiben trotz vorhandener Tour- und Standortdaten.

## What Changes
- Das bestehende Terminmodell wird auf ein explizites Regelmodell für Serienabweichungen umgestellt.
- Es wird ein neuer fachlicher Rule-Layer eingeführt, der Abweichungen von Wiederkehrterminen als regulierte Entitäten abbildet.
- Für den laufenden und den folgenden Jahrgang werden daraus konkrete Tour-Termine materialisiert und in einer persistenten Tabelle abgelegt.
- Die Mainserver-Synchronisation verarbeitet ausschließlich materialisierte Termine.
- Alte Felder- und Tabellenkonzepte für Verschiebungslogik, die nicht explizit abbildbar sind, werden ersetzt und migriert.

## Impact
- Affected specs: `waste-management`, bei Bedarf `plugin-operations-platform` für Job-Orchestrierung.
- Affected code:
  - `apps/sva-studio-react/src/lib/waste-management-*`
  - `packages/data-repositories/src/waste-management/*`
  - `packages/data/src/waste-management/*`
  - Datenmigrationen im zentralen und instanzbezogenen Waste-DB-Schema
- Architektur-/Schnittstellenwirkung:
  - Mainserver-Sync wird deterministisch vom Materialisierungsstand abhängig
  - Alte und uneindeutige Terminabweichungskonzepte werden ersetzt
- Rollback:
  - Alte Rules werden vor Migration vollständig in das neue Modell übernommen
  - Bei Ausfällen kann der Sync vorübergehend deaktiviert und manuell auf historische Materialisierungstabelle zurückgestellt werden

## Scope
- Nicht enthalten: neue fachliche Kalender-Features außerhalb Waste-Management.
- Nicht enthalten: automatische Nachrechnung über mehr als ein Folgejahr hinaus.
