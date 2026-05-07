## Context

Die Befunde konzentrieren sich nicht auf einzelne Defekte, sondern auf Vertragslücken zwischen Auth-Runtime, Plugin-SDK, Host-Routing und CI-Governance. Das gemeinsame Muster ist, dass Konventionen bereits existieren, aber nicht deterministisch zur Build- oder Boot-Zeit erzwungen werden.

## Goals / Non-Goals

- Goals:
  - Serielle, deterministische Token-Refresh-Semantik für geteilte Redis-Sessions
  - Ein expliziter, hostvalidierter Plugin-Vertrag für Routen, Permissions, Übersetzungen und SDK-Versionen
  - Harte Architektur-Gates für cross-cutting Regeln, die heute nur dokumentiert oder implizit getestet sind
  - Schwächere Qualitätszonen in Auth- und Registry-Pfaden messbar und schrittweise auf Zielniveau anheben
- Non-Goals:
  - Vollständige Runtime-Nachladung externer Plugins ohne App-Build
  - Eine neue IAM-Engine oder ein neues Routing-System einführen
  - Sämtliche Komplexitätshotspots in einem einzigen Delivery-Slice beseitigen

## Decisions

- Decision: Session-Refresh bleibt serverseitig und Redis-basiert, wird aber pro `sessionId` serialisiert, sodass für parallele Requests genau ein Refresh-Schreiber gewinnt und konkurrierende Requests das Ergebnis wiederverwenden.
- Decision: `/auth/me` bleibt der kanonische Auth-Read, gibt aber nur eine explizite Allowlist stabiler Felder aus; neue interne Session- oder Profilfelder werden nicht per Object-Spread exponiert.
- Decision: Der Host validiert Plugin-Beiträge vor Snapshot-Publikation gegen einen kanonischen Preflight-Vertrag für Namespace, SDK-SemVer, Routen, Permission-Referenzen, Translation-Ownership und Aktivierungsstatus.
- Decision: Build-linked Plugins bleiben Teil des Host-Builds, müssen aber über hostkontrollierte Aktivierungsflags pro Instanz oder Umgebung deaktivierbar sein, damit Canary- und Rollback-Slices ohne Code-Fork möglich werden.
- Decision: Typsichere Plugin-Routen werden über einen deklarativen Vertrag für Search-Params, Path-Params und Route-Component-Bindings beschrieben; der Host behält Parsing-, Guard- und Route-Ownership.
- Decision: Mutationen emittieren hostvalidierte Invalidation-Tags, damit Core-App und Plugins denselben Cache-Invalidierungsvertrag nutzen können.
- Decision: Produktionsnahe Boots und Releases failen vor dem ersten Traffic bei OTEL-Unreadiness, Architekturdrift oder Migrationsdrift.
- Decision: Kritische Module dürfen bei offenen Hotspots weder Coverage-Floors absenken noch Komplexität weiter steigern; stattdessen gilt Ratcheting plus dokumentierter Refactoring-Backlog.

## Workstreams

1. Auth- und Runtime-Härtung
   - Session-Refresh serialisieren
   - `/auth/me` minimieren
   - Session-Store-Adapter auf denselben Codec- und Konkurrenzvertrag bringen
   - OTEL vor Request-Annahme initialisieren
   - Boot- und Readiness-Prüfung auf Migrationsstand ausweiten

2. Plugin-Vertrag stabilisieren
   - Routen- und Translation-Kollisionen fail-fast behandeln
   - Plugin-Permissions mit IAM-Manifest kreuzvalidieren
   - SDK-Kompatibilität per SemVer-Range erzwingen
   - Typisierten Route- und Aktivierungsvertrag einführen
   - Vollqualifizierte Action-IDs statisch erzwingen

3. CI- und Architektur-Gates verankern
   - Dependency-Graph-Snapshot in CI
   - i18n-Key-Extraktion und Missing-Key-Gate
   - `.server.ts`- und server-only Leak-Gates inklusive `interfaces-api`
   - Kritische Coverage- und Komplexitätsregeln verschärfen

4. Datenkonsistenz über UI-Grenzen
   - Hostvalidierte Invalidation-Tags für Mutationen
   - Gemeinsame Cache-Invalidierung über Core und Plugins

## Risks / Trade-offs

- Strengere Build- und Boot-Gates können bestehende Drift sofort sichtbar machen und zunächst mehrere rote Checks freilegen.
- Die typisierte Plugin-Route-Schnittstelle ist ein öffentlicher SDK-Vertrag und braucht eine klar dokumentierte Migrationsphase für bestehende Plugins.
- Runtime-Aktivierungsflags für build-linked Plugins reduzieren nicht den Build-Kopplungsgrad, schaffen aber einen kontrollierbaren Betriebshebel ohne Vollumbau.

## Migration Plan

1. Zuerst Guardrails einführen, die inkonsistente Zustände sichtbar machen, ohne sofort alle Callsites umzubauen.
2. Danach Auth- und Plugin-Hotspots auf die neuen Verträge migrieren und Characterization-Tests für Redis-, Build-time- und Host-Routing-Pfade ergänzen.
3. Anschließend CI-Gates scharf schalten und die verbleibenden Exemptions, Floors und Hotspots dokumentiert abbauen.
4. Die neuen Verträge in arc42 und mindestens einer ADR für Plugin- und Runtime-Guardrails verankern.
