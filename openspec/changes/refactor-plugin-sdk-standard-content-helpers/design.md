## Kontext

Die drei bestehenden Content-Plugins sind bewusst gleichartige Referenzmengen für host-owned CRUD-Flächen unter `/admin/<plugin>`. Wiederholt werden nur technische Muster, nicht fachliche Feldmodelle oder Editor-Semantik.

## Ziele

- gemeinsame Standard-CRUD-Metadaten im Plugin-SDK kapseln
- gemeinsame Mainserver-HTTP-Basis im Plugin-SDK kapseln
- kleine UI-nahe Utilities zentralisieren
- Plugin-Isolation beibehalten

## Nicht-Ziele

- kein generisches CRUD-Framework für komplette Editor-Oberflächen
- kein gemeinsames Workspace-Package zwischen Plugins
- keine fachliche Vereinheitlichung der drei Datenmodelle

## Entscheidungen

- Shared-Code wandert ausschließlich nach `packages/plugin-sdk`
- `packages/sdk` bleibt Re-Export-Layer und spiegelt die neuen Public APIs
- Plugin-seitig bleiben Typen, Validierung, Übersetzungen und Editor-Mappings lokal
- die HTTP-Helfer kapseln Transport, Fehler-Mapping und Standard-Header, nicht fachliche Request-/Response-Modelle

## Risiken / Trade-offs

- Mehr Public API im Plugin-SDK erhöht dessen Verantwortung
  - Minderung: Helper bleiben klein und fokussiert auf Standard-Content-Plugins
- Zu aggressive UI-Abstraktion würde Fachgrenzen verwischen
  - Minderung: nur Datetime-/Media-Utilities zentralisieren, keine generische Editor-Engine
