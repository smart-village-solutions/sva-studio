# Change: Mainserver-Schnittstellen zentral im Studio-Root verwalten

## Why

Das Studio speichert `sva_mainserver`-Schnittstellen bereits instanzbezogen in der zentralen External-Interface-Registry. Die Root-Instanzverwaltung und ihr MCP können diesen Bestand jedoch weder vollständig prüfen noch für eine gewählte Instanz pflegen. Nach der Neueinrichtung blieben dadurch fehlende Einträge bei aktiven Mandaten zunächst unentdeckt; die vorhandene Tenant-Verwaltung erfordert einen eigenen Zugriff pro Tenant.

## What Changes

- Die Root-Instanzverwaltung zeigt für aktive Instanzen einen lesenden Mainserver-Konfigurationsstatus: `missing`, `disabled`, `configured` oder `error` bei fehlgeschlagener Erhebung. `configured` sagt nichts über Provider-Erreichbarkeit oder fachliche Berechtigungen aus.
- Root-Administratoren können die öffentliche Mainserver-Konfiguration einer ausdrücklich gewählten Instanz lesen und über den bestehenden Mainserver-Speicherpfad anlegen oder ändern. Die vorhandene URL- und SSRF-Validierung bleibt maßgeblich.
- Das zentrale Studio-MCP erhält schmale Lese- und Speichertools über dieselben Root-APIs. Nach einer Änderung wird der Zielzustand erneut gelesen; ein erfolgreicher Save allein ist keine Readiness-Evidenz.
- Die Tenant-Verwaltung über `/interfaces` und den persönlichen Tenant-MCP behält ihre bisherigen Rechte und schreibt denselben kanonischen Eintrag.

## Grenzen

- Erster Lieferabschnitt ausschließlich für `sva_mainserver`; keine zentrale Bearbeitung anderer Interface-Typen oder pluginverwalteter Interfaces.
- Keine automatische Konfiguration aller aktiven Instanzen, keine Massenmutation und keine Pflicht zur Mainserver-Anbindung für jeden Tenant.
- Keine neue Tabelle, keine Kopie der Konfiguration und keine Umdeutung von `mainserverConfigRef` zur Runtime-Wahrheit.
- Keine Verwaltung von Organisations- oder Benutzer-Credentials und keine Aussage über Provider-Readiness allein aus dem Konfigurationsstatus.
- Kein alternativer Rollout- oder direkter Datenbank-Operatorpfad.

## Abhängigkeiten und Auswirkungen

- Der bestehende Tenant-Vertrag aus `add-personal-mcp-mainserver-settings` bleibt erhalten. Dieser Change ergänzt einen gesondert autorisierten Root-Zugriff; der persönliche MCP wird nicht zur instanzübergreifenden Verwaltung umfunktioniert.
- Betroffene Fähigkeiten: `external-interface-registry`, Root-Instanzverwaltung und zentrales Studio-MCP. Die kanonischen Runtime- und Speicherfunktionen von `@sva/sva-mainserver` bleiben zuständig.
- Die Root- und Tenant-Grenzen, Fehlerzustände und Nachweise stehen in `design.md`. Die Umsetzung aktualisiert die betroffenen arc42-Abschnitte [05](../../../docs/architecture/05-building-block-view.md), [06](../../../docs/architecture/06-runtime-view.md), [08](../../../docs/architecture/08-cross-cutting-concepts.md) und [10](../../../docs/architecture/10-quality-requirements.md) sowie die MCP-Betriebsanleitung.
