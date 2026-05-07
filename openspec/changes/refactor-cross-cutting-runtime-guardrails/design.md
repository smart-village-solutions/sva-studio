## Context

Die Befunde konzentrieren sich nicht auf einzelne Defekte, sondern auf Vertragsluecken zwischen Auth-Runtime, Plugin-SDK, Host-Routing und CI-Governance. Das gemeinsame Muster ist, dass Konventionen bereits existieren, aber nicht deterministisch zur Build- oder Boot-Zeit erzwungen werden.

## Goals / Non-Goals

- Goals:
  - Serielle, deterministische Token-Refresh-Semantik fuer geteilte Redis-Sessions
  - Ein expliziter, hostvalidierter Plugin-Vertrag fuer Routen, Permissions, Uebersetzungen und SDK-Versionen
  - Harte Architektur-Gates fuer cross-cutting Regeln, die heute nur dokumentiert oder implizit getestet sind
  - Schwaechere Qualitaetszonen in Auth- und Registry-Pfaden messbar und schrittweise auf Zielniveau anheben
- Non-Goals:
  - Vollstaendige Runtime-Nachladung externer Plugins ohne App-Build
  - Eine neue IAM-Engine oder ein neues Routing-System einfuehren
  - Saemtliche Komplexitaetshotspots in einem einzigen Delivery-Slice beseitigen

## Decisions

- Decision: Session-Refresh bleibt serverseitig und Redis-basiert, wird aber pro `sessionId` serialisiert, sodass fuer parallele Requests genau ein Refresh-Schreiber gewinnt und konkurrierende Requests das Ergebnis wiederverwenden.
- Decision: `/auth/me` bleibt der kanonische Auth-Read, gibt aber nur eine explizite Allowlist stabiler Felder aus; neue interne Session- oder Profilfelder werden nicht per Object-Spread exponiert.
- Decision: Der Host validiert Plugin-Beitraege vor Snapshot-Publikation gegen einen kanonischen Preflight-Vertrag fuer Namespace, SDK-SemVer, Routen, Permission-Referenzen, Translation-Ownership und Aktivierungsstatus.
- Decision: Build-linked Plugins bleiben Teil des Host-Builds, muessen aber ueber hostkontrollierte Aktivierungsflags pro Instanz oder Umgebung deaktivierbar sein, damit Canary- und Rollback-Slices ohne Code-Fork moeglich werden.
- Decision: Typsichere Plugin-Routen werden ueber einen deklarativen Vertrag fuer Search-Params, Path-Params und Route-Component-Bindings beschrieben; der Host behaelt Parsing-, Guard- und Route-Ownership.
- Decision: Mutationen emittieren hostvalidierte Invalidation-Tags, damit Core-App und Plugins denselben Cache-Invalidierungsvertrag nutzen koennen.
- Decision: Produktionsnahe Boots und Releases failen vor dem ersten Traffic bei OTEL-Unreadiness, Architekturdrift oder Migrationsdrift.
- Decision: Kritische Module duerfen bei offenen Hotspots weder Coverage-Floors absenken noch Komplexitaet weiter steigern; stattdessen gilt Ratcheting plus dokumentierter Refactoring-Backlog.

## Workstreams

1. Auth- und Runtime-Haertung
   - Session-Refresh serialisieren
   - `/auth/me` minimieren
   - Session-Store-Adapter auf denselben Codec- und Konkurrenzvertrag bringen
   - OTEL vor Request-Annahme initialisieren
   - Boot- und Readiness-Pruefung auf Migrationsstand ausweiten

2. Plugin-Vertrag stabilisieren
   - Routen- und Translation-Kollisionen fail-fast behandeln
   - Plugin-Permissions mit IAM-Manifest kreuzvalidieren
   - SDK-Kompatibilitaet per SemVer-Range erzwingen
   - Typisierten Route- und Aktivierungsvertrag einfuehren
   - Vollqualifizierte Action-IDs statisch erzwingen

3. CI- und Architektur-Gates verankern
   - Dependency-Graph-Snapshot in CI
   - i18n-Key-Extraktion und Missing-Key-Gate
   - `.server.ts`- und server-only Leak-Gates inklusive `interfaces-api`
   - Kritische Coverage- und Komplexitaetsregeln verschaerfen

4. Datenkonsistenz ueber UI-Grenzen
   - Hostvalidierte Invalidation-Tags fuer Mutationen
   - Gemeinsame Cache-Invalidierung ueber Core und Plugins

## Risks / Trade-offs

- Strengere Build- und Boot-Gates koennen bestehende Drift sofort sichtbar machen und zunaechst mehrere rote Checks freilegen.
- Die typisierte Plugin-Route-Schnittstelle ist ein oeffentlicher SDK-Vertrag und braucht eine klar dokumentierte Migrationsphase fuer bestehende Plugins.
- Runtime-Aktivierungsflags fuer build-linked Plugins reduzieren nicht den Build-Kopplungsgrad, schaffen aber einen kontrollierbaren Betriebshebel ohne Vollumbau.

## Migration Plan

1. Zuerst Guardrails einfuehren, die inkonsistente Zustaende sichtbar machen, ohne sofort alle Callsites umzubauen.
2. Danach Auth- und Plugin-Hotspots auf die neuen Vertraege migrieren und Characterization-Tests fuer Redis-, Build-time- und Host-Routing-Pfade ergänzen.
3. Anschliessend CI-Gates scharf schalten und die verbleibenden Exemptions, Floors und Hotspots dokumentiert abbauen.
4. Die neuen Vertraege in arc42 und mindestens einer ADR fuer Plugin- und Runtime-Guardrails verankern.
