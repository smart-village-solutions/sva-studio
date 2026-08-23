# Change: Pluginübergreifende Inhaltshistorie standardisieren

## Why

Das Studio besitzt bereits eine hostseitige Inhaltshistorie und die Berechtigung `content.readHistory`, die vorhandenen Plugins nutzen diesen Vertrag jedoch uneinheitlich. Einige Editoren zeigen echte Einträge, andere nur Platzhalter; bei Mainserver-basierten Inhalten ist außerdem nicht eindeutig erkennbar, dass ausschließlich über das Studio ausgeführte Änderungen erfasst werden.

## What Changes

- Alle vorhandenen Plugins mit redaktionell veränderbaren Datensätzen werden inventarisiert und an einen gemeinsamen hostseitigen Historienvertrag angebunden.
- Die Content-Plugins für Featured Projects, News, Events, POI, Generic Items, FAQ, Cockpit Cards und Surveys erhalten eine funktionsfähige, einheitliche Historienansicht; bestehende Platzhalter werden entfernt und Featured Projects erhalten erstmals den bewusst nachgelagerten Historien-Tab.
- Bei Mainserver-basierten Inhalten erfasst die Historie ausschließlich Mutationen, die über das Studio ausgelöst wurden. Änderungen außerhalb des Studios werden weder synthetisch ergänzt noch als vollständig erfasst dargestellt.
- Die Waste-Management-Historie bleibt fachlich eigenständig, erfüllt aber dieselben verbindlichen Anforderungen an Autorisierung, Mandantenisolation, Herkunft, Zustände und barrierefreie Darstellung.
- Plugins ohne eigene veränderbare redaktionelle Datensätze, insbesondere reine Infrastruktur-, SDK- oder Auswahlbeiträge, werden explizit als nicht historienpflichtig klassifiziert statt mit einer leeren Schein-Historie versehen.
- Der Plugin-Vertrag und blockierende Validierungen verankern die Historienfähigkeit für zukünftige Plugins. Eine Ausnahme ist nur als deklarative, begründete und hostvalidierte Klassifikation zulässig.
- Die durch `add-featured-projects-plugin` eingeführte allgemeine External-Content-Referenz, stabile `externalId`, bestehende Idempotenz und Reconciliation werden als verbindliche Vorleistung wiederverwendet und nicht durch eine zweite History-Identität oder ein paralleles Journal ersetzt.
- Snapshot-Vergleich, Feld-Diff und Wiederherstellung früherer Versionen bleiben außerhalb dieses Changes.

## Impact

- Affected specs: `content-management`, `iam-auditing`, `iam-access-control`, `plugin-platform`, `architecture-documentation`
- Affected code: `packages/plugin-*`, `packages/plugin-sdk`, Host-Registry und deren Validierungen, `packages/auth-runtime`, gemeinsame Content-History-Clients und Studio-UI-Primitiven
- Affected data: bestehende `iam.content_history` und die aus `add-featured-projects-plugin` übernommene External-Content-Referenz; keine zweite Referenzabbildung und keine Historienübernahme aus dem Mainserver
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`
