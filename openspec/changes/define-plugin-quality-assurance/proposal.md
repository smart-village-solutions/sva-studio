# Change: Gemeinsamen QS-Vertrag für Studio-Plugins definieren

## Why

Externe Plugins gehören nicht zum Nx-Projektgraphen des Studios. Deshalb führen die Studio-Gates ihre eigenen Tests, Coverage und Quellcodeprüfungen nicht automatisch aus. Ein erfolgreicher Studio-Build und lokale Plugin-Tests ersetzen weder eine automatische Plugin-QS noch eine belegte Host-Kompatibilität.

Das Repository `smart-village-solutions/sva-studio_plugin-application-overview` wird der erste Referenzverbraucher dieses Vertrags. Es ist derzeit ein Musterkandidat, keine bereits abgenommene QS-Musterlösung.

## What Changes

- Einen gemeinsamen, messbaren QS-Vertrag für Workspace- und externe Plugins im bestehenden [Plugin-Guide](../../../docs/development/plugin-development.md) definieren; fachlich gleiche Regeln unabhängig vom Repository durchsetzen.
- Eigenständige Plugin-Prüfungen, Host-Kompatibilität und Artefaktfreigabe als getrennte Nachweise verlangen. Der Host bleibt für eigene Rechte-, Sitzungs-, Datenbank- und Auslieferungsgrenzen verantwortlich.
- Neue Plugins mit mindestens 85 % Lines, Statements, Functions und Branches sowie den bestehenden Studio-Regeln für Regression, New Code und Komplexität absichern. Keine ungeprüfte Übernahme alter, niedrigerer projektspezifischer Floors als Musterstandard.
- Einen sauberen Paket-Consumer außerhalb des Studio-Verzeichnisbaums prüfen; keine zufällige Abhängigkeitsauflösung über Elternverzeichnisse oder lokale Symlinks als CI-Nachweis akzeptieren.
- Das Anwendungsübersicht-Repository als ersten überprüfbaren Nachweis des Vertrags ausbauen; Ist-Zustand und fehlende Nachweise ausdrücklich dokumentieren.

## Scope und Nicht-Ziele

Ziel ist ein gemeinsamer Vertrag und anschließend dessen vollständiger Nachweis an genau einem externen Plugin. Maximal betroffen sind Plugin-Entwicklungsdokumentation, vorhandene Studio-QS-/Paket-/Integrationspfade und deren kleinste nötige Erweiterung für externe Projektwurzeln sowie das benannte Referenz-Repository.

Der Nutzer hat die technische Einführung am Referenz-Repository beauftragt. Sie umfasst die nötigen vorhandenen Prüfer, reproduzierbare Paket-/Host-Tests und CI-/Merge-Nachweise. Neue externe Analyse-Anbindungen benötigen das konkret abgestimmte Konto/Ziel; Registry-Veröffentlichung und produktive Deployments bleiben ausgeschlossen. Keine neue CI-Plattform, Meta-Pipeline, allgemeine Plugin-Verwaltung, eigenständige Core-Nachbildung oder flächige Migration aller Bestandsplugins einführen. Keine Review-Agents oder Prüfregeln je Plugin kopieren.

## Impact

- Affected specs: `plugin-platform`.
- Affected docs: `docs/development/plugin-development.md`, später relevante arc42-Abschnitte 08 und 10; README des Referenz-Plugins.
- Bestehende Vorgaben: `DEVELOPMENT_RULES.md` Abschnitte 5, 5.1, 5.2, Security, i18n und Accessibility; `tooling/testing/coverage-policy.json`; `scripts/ci/sonar-new-code-gate.ts`; `tooling/quality/complexity-policy.json`; bestehende Review-Governance.
- Führender Zusammenhang: `add-application-workspace-plugin` liefert die benötigten Host-Verträge, ersetzt aber nicht diesen repositoryübergreifenden QS-Vertrag.

## Status und Freigabe

Entwurf vom 8. November 2026 auf Studio-Basis `5bb66e5fa`. Referenz-Plugin: `66e3e9b`. Der QS-Vertrag und seine technische Einführung sind vom Nutzer freigegeben. Die Implementierung läuft; terminale Remote-Gates, konkrete externe Dienstanbindungen und manuelle Musterabnahme sind getrennt nachzuweisen. Eine vollständige Musterfreigabe ist noch nicht erteilt.
