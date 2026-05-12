# ADR-042: Externe Schnittstellen als host-owned Registry

**Status:** Akzeptiert
**Entscheidungsdatum:** 2026-05-12
**Entschieden durch:** Studio/Architektur Team
**GitHub Issue:** n/a
**GitHub PR:** n/a

## Kontext

SVA Studio kommuniziert bereits heute mit mehreren externen Systemen und wird künftig noch deutlich mehr davon anbinden. Dazu gehören der SVA Mainserver, S3-kompatible Speicher, Supabase-basierte Datenquellen sowie perspektivisch weitere APIs, RSS-Feeds, urbane Datenplattformen und angebundene Websites. Vor diesem Change existierten dafür jedoch verschiedene, nicht ausreichend vereinheitlichte technische Pfade.

Die Mainserver-Konfiguration war in `iam.instance_integrations` als Spezialfall modelliert. Zusätzliche Schnittstellen wie S3 und Supabase waren im Studio nur als vorläufige App-Logik angelegt und serverseitig noch nicht auf denselben Persistenz- und Security-Backbone gezogen. Gleichzeitig verlangt die Plugin-Plattform zunehmend host-owned Runtime-Grenzen: Plugins sollen externe Systeme fachlich nutzen können, aber weder eigene Secret-Stores noch konkurrierende Verbindungsregister aufbauen.

Ohne eine zentrale Registry würde jede neue Integrationsart eigene Tabellen, eigene Update-Semantiken und eigene Sicherheitsannahmen etablieren. Das wäre für Betrieb, Audit, Secret-Schutz und künftige Plugin-Nutzung zu fragmentiert.

## Entscheidung

- Externe technische Schnittstellen werden als host-owned Capability zentral verwaltet.
- Die kanonische Persistenz liegt in zwei Tabellen:
  - `iam.external_interface_types`
  - `iam.instance_external_interfaces`
- Der Host bleibt führend für:
  - Typkatalog und Instanzdatensätze
  - Secret-Verschlüsselung
  - Default-Auflösung und Statusprojektion
  - Runtime-Resolver und Health-Check-Wiring
  - Audit- und Berechtigungsgrenzen
- Der erste produktive Scope umfasst `sva_mainserver`, `s3` und `supabase`.
- Bestehende Mainserver-Konfigurationen werden in denselben Registry-Pfad migriert.
- Plugins dürfen zusätzliche Interface-Typdefinitionen deklarativ beisteuern, aber keine parallelen Secret-, Persistenz- oder Connection-Stores am Host vorbei etablieren.

## Begründung

### Positive Konsequenzen

- Alle externen Zugänge folgen demselben Sicherheits- und Persistenzmodell.
- `sva_mainserver`, `s3` und `supabase` teilen sich denselben technischen Backbone statt konkurrierender Sonderpfade.
- Die Verwaltungsseite `/interfaces` wird zur echten zentralen Host-Oberfläche.
- Künftige Plugin-Nutzung externer Systeme kann auf einen klaren Host-Vertrag aufsetzen.
- Secret-Auflösung bleibt vollständig serverseitig und fail-closed.

### Negative Konsequenzen

- Das Datenmodell wird breiter und braucht zusätzliche Migrationen, Tests und Doku.
- Edit-Flows mit verdeckten Secrets benötigen die Semantik „leer = bestehenden Secretwert behalten“.
- Legacy-Pfade wie `iam.instance_integrations` müssen während der Übergangsphase bewusst als Altbestand behandelt werden.

## Verworfene Alternativen

### 1. Jede Integration behält ihren eigenen Store

Verworfen, weil das zu mehreren konkurrierenden Wahrheiten für Secrets, Status und Default-Auflösung geführt hätte.

### 2. Plugins dürfen eigene Secret- und Connection-Stores einführen

Verworfen, weil dies das host-owned Runtime- und Security-Modell der Plattform unterlaufen würde.

### 3. Nur S3/Supabase ergänzen, Mainserver separat lassen

Verworfen, weil dann genau der unerwünschte Zustand von zwei kanonischen Persistenzpfaden für externe Instanzschnittstellen bestehen bliebe.

## Konsequenzen für Umsetzung und Betrieb

- `@sva/core`, `@sva/data-repositories`, `@sva/server-runtime`, `@sva/sva-mainserver` und `apps/sva-studio-react` teilen einen gemeinsamen External-Interface-Vertrag.
- Das DB-Schema trägt einen globalen Typkatalog und instanzgebundene Records mit Status- und Secret-Feldern.
- Mainserver-Settings lesen und schreiben nicht mehr über eine Spezialtabelle, sondern über dieselbe Registry wie S3 und Supabase.
- Architektur- und OpenSpec-Dokumentation müssen die Capability explizit als host-owned und plugin-konsumierbar beschreiben.

## Verwandte ADRs

- [ADR-021](ADR-021-sva-mainserver-delegation.md)
- [ADR-034](ADR-034-plugin-sdk-vertrag-v1.md)
- [ADR-039](ADR-039-medienmanagement-host-capability-und-storage-vertrag.md)
- [ADR-041](ADR-041-plugin-plattform-v2-fuer-externe-distribution.md)
