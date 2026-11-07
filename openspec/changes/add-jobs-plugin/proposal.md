# Change: Stellenanzeigen im Studio erstellen und bearbeiten

## Why

Das alte CMS bietet eine eigene Stellenanzeigenmaske. Im Studio fehlt die fachliche Oberfläche für Anstellungsart, Arbeitgeber und Ansprechpartner; die technische GenericItem-Maske bildet insbesondere die Firmenangaben nicht ab. Ein optionales Fachplugin soll neue und bestehende Mainserver-Stellenanzeigen über denselben Datenvertrag verwalten.

Der Nutzer hat den Entwurf am 07.11.2026 als Grundlage dieses OpenSpec-Changes freigegeben und einen eigenen Worktree beauftragt. Dieser schriftliche Entwurf steht zur Prüfung; eine Implementierung, ein PR oder eine Bereitstellung ist damit noch nicht erfolgt.

## What Changes

- Ergänzt das optionale Plugin `jobs`, Package `@sva/plugin-jobs`, Content-Type `jobs.job` und die exakte Mainserver-Zuständigkeit `genericType: "Job"`.
- Bietet Übersicht, Anlage auf einer Seite, Bearbeitung, Studio-Historie, ausdrückliche Sichtbarkeitsänderung und bestätigtes endgültiges Löschen.
- Übernimmt Titel, externe ID, Anstellungsart, HTML-Inhalt, Medien, Arbeitgeber einschließlich Kontakt und Adresse, Ansprechpartner sowie Veröffentlichungs- und Ablaufdatum aus dem alten CMS.
- Verwendet das Gutschein-Plugin als Vorbild für redaktionellen Aufbau und gemeinsame Medienoberfläche. Direkte GenericItem-Writes folgen dem vorhandenen Baustellen-/Mainserver-Pfad; das Modul benötigt keine POI-Aktivierung.
- Nutzt `jobs.read`, `jobs.create`, `jobs.update` und `jobs.delete` sowie die bestehenden Host-Rechte für Sichtbarkeitsänderungen. Konto, Organisation, Provider, Objektzugriff und CSRF bleiben im vorhandenen Host-Vertrag.
- Erweitert den bestehenden Kategorie-Lesepfad gezielt für Anstellungsarten mit exakt dem Tag `generic_item_job`. Gespeichert wird weiterhin der Name unter `payload.employmentType`, keine Kategorie-ID.
- Verlangt vollständige Bestandsprüfung, Erhalt unberührter Daten, Konflikterkennung, unabhängigen Readback und Ergebnisprüfung ohne automatische Wiederholung unklarer Writes.
- Verhindert vorab erkennbare typübergreifende externe-ID-Kollisionen sowie generische Job-Neuanlagen und Umtypisierungen als Umgehung des Fachschutzes.

## Nicht-Ziele und Scope-Grenze

- Keine Änderungen am externen Mainserver, alten CMS oder an der App; keine Bestandsmigration und keine eigene fachliche Stellenanzeigentabelle.
- Keine Bewerbungsverwaltung, Bewerberdaten, zusätzlichen Freigabeprozesse, Importe, Benachrichtigungen, Massenaktionen oder neue Veröffentlichungsplanung.
- Veröffentlichungs- und Ablaufdatum lösen in diesem Lieferumfang keine automatische Veröffentlichung, Ausblendung, Archivierung oder Löschung aus.
- Keine POI-Verknüpfung, Rabatt-/Kontingentfunktionen, neuen Hintergrundjobs oder generische Formular-/Adapterplattform.
- Keine Übernahme der speziell für Baustellen akzeptierten Ausnahme zum Verlust deaktivierter Kategoriezuordnungen. Nicht sicher erhaltbarer Bestand sperrt Updates vor dem Provider-Write.

Maximal betroffene Bereiche sind das neue Fachplugin, vorhandene Plugin-/Distributions-/Routenkataloge, der zuständige Studio-Mainserver-Adapter einschließlich Kategorie-Lookup und notwendiger Schutz generischer Schreibwege sowie unmittelbar zugehörige Tests, Übersetzungen und Dokumentation. Gemeinsame Packages werden nur über bestehende öffentliche Verträge genutzt; eine Erweiterung dieser Verträge oder eine neue Infrastruktur ist nicht pauschal freigegeben.

## Impact

- Affected specs: `content-management`, `plugin-platform`, `sva-mainserver-integration`.
- Affected code: `packages/plugin-jobs/` (neu), bestehende Adapterpfade in `packages/sva-mainserver/`, Plugin-/Distributionskataloge und notwendiges Host-Wiring in `apps/sva-studio-react/` sowie bestehende Registry-/Routing-Verbraucher. Runtime-Imports des Plugins erfolgen ausschließlich über `@sva/plugin-sdk` und `@sva/studio-ui-react`.
- Affected arc42 sections: 04 (Anwendung vorhandener Strategie/IAM), 05 (Baustein und Zuständigkeit), 06 (Read-/Write-Fluss), 08 (IAM, Medien, Bestandserhalt, i18n, Accessibility), 10 (Nachweise). Die Ist-Dokumentation wird zusammen mit der späteren Implementierung aktualisiert.
- Bestehende Grundlage: `add-vouchers-plugin`, `add-construction-sites-plugin`, Kategorieverwaltung und GenericItem-Ownership. Deren offene Live-Abnahmen werden weder übernommen noch als erledigt behauptet.
- Keine geplante Datenbankänderung. Eine notwendige neue Host-Fähigkeit oder nicht erfüllbare Datenintegritätsanforderung führt vor Codeausbau zur Neubewertung des Lieferumfangs.

## Unterlagen und Status

- [Design und Vertragsgrenzen](./design.md)
- [Aufgaben und Nachweise](./tasks.md)
- [Redaktionelle Anforderungen](./specs/content-management/spec.md)
- [Plugin- und Zugriffsvertrag](./specs/plugin-platform/spec.md)
- [Mainserver-Vertrag](./specs/sva-mainserver-integration/spec.md)

Stand: schriftlicher Entwurf zur Prüfung. Die Freigabe dieses Entwurfs ist Voraussetzung für die anschließende Implementierungsplanung. Externe Schreibtests, Push, PR, Merge und Rollout sind nicht beauftragt. Für reguläre Rollouts bleibt ausschließlich `docs/guides/studio-rollout-process.md` maßgeblich.
