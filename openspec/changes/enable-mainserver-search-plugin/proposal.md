# Change: Mainserver-Suche im bestehenden Suchplugin aktivieren

## Why

Das vorhandene Paket `packages/plugin-search` enthält nur einen inaktiven Descriptor und die frühere Header-Vorschau. Redakteure benötigen einen gemeinsamen Sucheinstieg und eine Ergebnisseite für die bereits öffentlich indexierten Mainserver-Inhalte unter Beibehaltung der Studio-Leserechte.

## What Changes

- Das bestehende optionale Plugin `search` erhält eine hostmaterialisierte Ergebnisseite, einen serverseitigen Suchpfad und die eigene Permission `search.read`.
- Der vorhandene Header-Entwurf wird zu einem bedienbaren, aktivierungs- und berechtigungsabhängigen Sucheinstieg weiterentwickelt; mobil führt ein Suchsymbol zur Suche.
- Die Ergebnisseite bietet Suchbegriff, Mehrfachfilter für Inhaltstyp und Kategorie sowie einen Datenanbieterfilter, entfernbare Filtermarkierungen und Zurücksetzen. Zustand und Paging werden über typisierte URL-Parameter abgebildet.
- Die bestehende Meilisearch-Instanz liefert Kandidaten; aktuelle Studio-Leseregeln und der Mainserver-Zugriffskontext entscheiden serverseitig über die Ausgabe.
- Nach vollständiger Prüfung wird etwa „20 Ergebnisse (+ 30 ohne passende Berechtigung)“ angezeigt. Ungeprüfte, nicht zuordenbare oder technisch nicht erreichbare Kandidaten zählen nicht als Berechtigungsablehnung.

## Abgrenzung

Ziel des Lieferabschnitts ist eine berechtigungskonforme Suche über bereits öffentlich indexierte Mainserver-Inhalte mit bestehendem Header-Einstieg und eigener Plugin-Ergebnisseite.

Nicht-Ziele sind die Aufnahme unsichtbarer Inhalte oder Entwürfe, Studio-eigene Inhalte, Änderungen an Mainserver oder Meilisearch-Indizes, neue Detailseiten für bislang nicht unterstützte Inhaltstypen, Autocomplete, Suche über sämtliche Organisationsmitgliedschaften und ein Production-Rollout.

Maximal betroffen sind `packages/plugin-search`, dessen bestehendes Host-/Katalog-/Routing-/Server-Wiring, die wiederverwendeten Mainserver-Lese- und Autorisierungspfade sowie die zugehörige aktuelle Dokumentation und Tests. Neue allgemeine SDK-Erweiterungspunkte, Autorisierungsmodelle, persistente Suchzustände oder weitere Services sind nicht Teil dieses Abschnitts. Sollte eine Umsetzung solche Änderungen benötigen, wird der Entwurf vor einer Scope-Erweiterung erneut geprüft.

## Impact

- Affected specs: `mainserver-search` (neue konkrete Fähigkeit); bestehende Verträge von `plugin-platform`, `routing`, `ui-layout-shell` und `sva-mainserver-integration` bleiben maßgeblich.
- Affected code: bestehendes Suchplugin, Header, Plugin-Katalog, Host-Routen-/Handler-Wiring und vorhandene Mainserver-/Content-Lesepfade.
- Affected arc42 sections: 03 Kontext, 05 Bausteine, 06 Laufzeit, 07 Verteilung und Secret-Zuführung, 08 Berechtigungen/i18n/Accessibility/Logging; 04 wird auf unveränderte IAM-Leitentscheidungen geprüft.
- Bezug: `prepare-inactive-shell-plugins` hat das Paket vorbereitet. Nur `search` verlässt nach vollständiger Implementierung den Entwicklungsstatus; die anderen Shell-Plugins bleiben unverändert.

## Status

Der fachliche Umfang und der schriftliche Entwurf wurden im Gespräch ausdrücklich freigegeben. Die Implementierung erfolgt im Worktree `.worktrees/mainserver-search-plugin` auf `feature/mainserver-search-plugin`; produktive Aktivierung, Schlüsselbereitstellung und Deployment sind nicht beauftragt. Zugangswerte und Dokumentinhalte werden hier nicht festgehalten.
