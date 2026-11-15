# Change: Gemeinsamer Abgleich für App-Konfiguration

## Why

Die App-Konfigurationseditoren benötigen einen gemeinsamen, verlustfreien Mainserver-Abgleich. Der vorhandene Waste-Writer kennt weder eine freie Variantenverwaltung noch feldbezogene Änderungen und unabhängigen Readback. Eigene Abgleichverfahren je Plugin würden Konflikt-, Rechte- und Datenverlustregeln vervielfachen.

## Freigabe und Status

Der Gesamtentwurf ist freigegeben. Dieser PR sichert ausschließlich den bestehenden Static-Content-Writer gegen automatische Mutationswiederholungen und dokumentiert die weitere Umsetzung. Leseadapter, Abgleich, Versionskopie und Readback werden gemeinsam mit ihrem ersten tatsächlichen autorisierten Host-Verbraucher eingeführt; isolierte öffentliche APIs ohne Verbraucher sind nicht Teil dieses PRs. Der technische Zugriff für vollständige Variantenverwaltung und identitätserhaltende Writes bleibt offen, siehe [Design](design.md#technischer-zugriff-mit-unverändertem-mainserver).

## What Changes

- Gemeinsamer serverseitiger Abgleich im bestehenden `@sva/sva-mainserver`; Host-Prüfung und öffentliche SDK-Verträge statt pluginseitiger GraphQL-Aufrufe.
- Vor dem Write frisch lesen, erkannte Konflikte feldbezogen auflösen, nur eigene Änderungen anwenden, danach unabhängig zurücklesen.
- Der Redakteur wählt bestehende und unversionierte Varianten, legt neue Versionen als vollständige Kopie einer gewählten Variante an und löscht gezielt Varianten.
- Eigene Konfigurationsrechte je Plugin; zusätzliches übergreifendes Recht für das Anlegen und Löschen ganzer Dokumentvarianten.
- Speichern nach Änderungsvorschau unmittelbar im Mainserver; keine dauerhaften Studio-Entwürfe oder separate Veröffentlichung.
- Erster Lieferabschnitt: je eine kleine Feldgruppe aus „Allgemein“ und „Design“ auf `globalSettings`, einschließlich Versionsverwaltung und Readback. Als belegte erste Felder sind `settings.locationService.showAlternativeLocationButton` und `appDesignSystem.serviceTiles.numberOfLines` vorgesehen.

## Grenzen

- GraphQL bleibt der Integrationsweg zum Mainserver; Admin-REST, zusätzliche Admin-Sessions und DB-Direktzugriffe sind ausgeschlossen.
- Keine Änderung am Mainserver oder an der App. [SVA-1787](https://tpwd.atlassian.net/browse/SVA-1787) ist eine separate Verbesserungsidee und keine Lieferabhängigkeit.
- Das Risiko externer Änderungen zwischen Fresh Read und Write ist ausdrücklich akzeptiert. Studio verspricht keinen atomaren Überschreibeschutz.
- Keine automatische Neuanlage aufgrund einer leeren Fallback-Antwort, keine stillen Namensänderungen, kein DB-Direktzugriff und keine automatische Rechteerhöhung.
- Keine weiteren Modulformulare, automatische Altlastenbereinigung, zweite Konfigurationspersistenz oder neuer Sync-Dienst. Parser-/Duplikatfälle werden nicht als eigener Bereinigungsauftrag aufgenommen.
- Dieser PR liefert den Retry-Schutz im bestehenden Writer. Host-/Plugin-Anbindung und vollständige Variantenverwaltung bleiben offen. Merge, Deployment und produktive Konfigurationswrites sind nicht beauftragt.

## Impact

- Betroffene Specs: `sva-mainserver-integration`, `plugin-platform`.
- Maximal betroffene Runtime-Bereiche des ersten Abschnitts: `packages/sva-mainserver`, öffentliche Verträge in `packages/plugin-sdk`, bestehende Auth-/Plugin-Host-Anbindung, die zuständigen Plugins „Allgemein“ und „Design“ sowie dünne App-Adapter und gemeinsame vorhandene UI. Der vorhandene Waste-Verbraucher wird am gemeinsamen Schreibpfad regressionssicher berücksichtigt; die Waste-Fachlogik wird nicht umgestaltet.
- Keine neue DB-Struktur geplant. Bestehende Kontextbindung, Idempotenz-, Audit- und Lock-Primitiven werden vor Eigenlogik auf Eignung geprüft.
- arc42: [Bausteinsicht](../../../docs/architecture/05-building-block-view.md), [Querschnittliche Konzepte](../../../docs/architecture/08-cross-cutting-concepts.md#gemeinsamer-abgleich-der-app-konfiguration), bei Umsetzung die betroffenen Sicherheits- und Laufzeitsichten fortschreiben.
- Grundlage: [#2180](https://github.com/smart-village-solutions/sva-studio/issues/2180), [#2181](https://github.com/smart-village-solutions/sva-studio/issues/2181), [#2182](https://github.com/smart-village-solutions/sva-studio/issues/2182).
