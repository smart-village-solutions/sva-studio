# Change: Gemeinsamer Abgleich für App-Konfiguration

## Why

Die App-Konfigurationseditoren benötigen einen gemeinsamen, verlustfreien Mainserver-Abgleich. Der vorhandene Waste-Writer kennt weder eine freie Variantenverwaltung noch feldbezogene Änderungen und unabhängigen Readback. Eigene Abgleichverfahren je Plugin würden Konflikt-, Rechte- und Datenverlustregeln vervielfachen.

## Freigabe und Status

Der Gesamtentwurf bleibt freigegeben. Der erste schreibende Lieferabschnitt nutzt die Seite **Anwendungen → App → App-Konfiguration** für die JSON-Dateiliste, die exakte Versionswahl und den feldbezogenen Abgleich der zwei Felder aus „Allgemein“ und „Design“. Die Variantenaktionen nutzen denselben Abgleich. Die Neuanlage ist auf Namen begrenzt, die der Mainserver unverändert übernimmt. Weitere Fachformulare folgen getrennt.

## What Changes

- Gemeinsamer serverseitiger Abgleich im bestehenden `@sva/sva-mainserver`; Host-Prüfung und öffentliche SDK-Verträge statt pluginseitiger GraphQL-Aufrufe.
- Vor dem Write frisch lesen, erkannte Konflikte feldbezogen auflösen, nur eigene Änderungen anwenden, danach unabhängig zurücklesen.
- Der Redakteur wählt bestehende und unversionierte Varianten, legt neue Versionen als vollständige Kopie einer gewählten Variante an und löscht gezielt Varianten.
- Eigene Konfigurationsrechte je Plugin; zusätzliches übergreifendes Recht für das Anlegen und Löschen ganzer Dokumentvarianten.
- Speichern nach Änderungsvorschau unmittelbar im Mainserver; keine dauerhaften Studio-Entwürfe oder separate Veröffentlichung.
- Erster Lieferabschnitt: je eine kleine Feldgruppe aus „Allgemein“ und „Design“ auf `globalSettings`, mit exakter Versionsauswahl und Readback. Als belegte erste Felder sind `settings.locationService.showAlternativeLocationButton` und `appDesignSystem.serviceTiles.numberOfLines` vorgesehen.

## Grenzen

- GraphQL bleibt der Integrationsweg zum Mainserver; Admin-REST, zusätzliche Admin-Sessions und DB-Direktzugriffe sind ausgeschlossen.
- Keine Änderung am Mainserver oder an der App. [SVA-1787](https://tpwd.atlassian.net/browse/SVA-1787), [SVA-1788](https://tpwd.atlassian.net/browse/SVA-1788), [SVA-1789](https://tpwd.atlassian.net/browse/SVA-1789) und [SVA-1792](https://tpwd.atlassian.net/browse/SVA-1792) sind abgenommen und liefern den vorhandenen GraphQL-Vertrag.
- Für Updates bestehender Varianten prüft der Mainserver die erwartete Revision atomar.
- Keine automatische Neuanlage aufgrund einer leeren Fallback-Antwort, keine stillen Namensänderungen, kein DB-Direktzugriff und keine automatische Rechteerhöhung.
- Keine weiteren Modulformulare, automatische Altlastenbereinigung, zweite Konfigurationspersistenz oder neuer Sync-Dienst. Parser-/Duplikatfälle werden nicht als eigener Bereinigungsauftrag aufgenommen.
- Der erste schreibende Lieferabschnitt integriert die Dateiliste und exakte Versionswahl, den Feldabgleich für `globalSettings` und den abgesicherten Mainserver-Write mit Readback auf der Seite **Anwendungen → App → App-Konfiguration**. Die vollständige Variantenverwaltung bleibt offen.

## Impact

- Betroffene Specs: `sva-mainserver-integration`, `plugin-platform`.
- Maximal betroffene Runtime-Bereiche des ersten Abschnitts: `packages/sva-mainserver`, öffentliche Verträge in `packages/plugin-sdk`, bestehende Auth-/Plugin-Host-Anbindung, die zuständigen Plugins „Allgemein“ und „Design“ sowie dünne App-Adapter und gemeinsame vorhandene UI. Der vorhandene Waste-Verbraucher wird am gemeinsamen Schreibpfad regressionssicher berücksichtigt; die Waste-Fachlogik wird nicht umgestaltet.
- Keine neue DB-Struktur geplant. Bestehende Kontextbindung, Idempotenz-, Audit- und Lock-Primitiven werden vor Eigenlogik auf Eignung geprüft.
- arc42: [Bausteinsicht](../../../docs/architecture/05-building-block-view.md), [Querschnittliche Konzepte](../../../docs/architecture/08-cross-cutting-concepts.md#gemeinsamer-abgleich-der-app-konfiguration), bei Umsetzung die betroffenen Sicherheits- und Laufzeitsichten fortschreiben.
- Grundlage: [#2180](https://github.com/smart-village-solutions/sva-studio/issues/2180), [#2181](https://github.com/smart-village-solutions/sva-studio/issues/2181), [#2182](https://github.com/smart-village-solutions/sva-studio/issues/2182).
