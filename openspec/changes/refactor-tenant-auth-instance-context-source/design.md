## Context

SVA Studio betreibt tenant-spezifische Hosts unter `https://<instanceId>.studio.smart-village.app`. Fuer einen eingehenden Request wird der Tenant bereits vor dem Login ueber Host, Registry und Realm-Aufloesung bestimmt. Im aktuellen Modell wird derselbe Tenant nach erfolgreichem OIDC-Login noch einmal ueber einen benutzerbezogenen Claim `instanceId` verifiziert. Das erzeugt zwei Wahrheitsquellen fuer denselben Scope.

Im produktionsnahen Betrieb fuehrt dieses Doppelmodell zu Fehlkonfigurationen, bei denen Benutzer erfolgreich im richtigen Tenant-Realm authentifiziert werden, Studio die Session aber wegen fehlendem `instanceId`-Claim wieder verwirft. Fachlich ist fuer tenant-spezifische Realms jedoch gewollt, dass alle Benutzer dieses Realms in Studio ankommen koennen.

## Goals / Non-Goals

- Goals:
  - tenant-spezifischen Session-Kontext aus Host, Registry und Realm ableiten
  - `instanceId` weiterhin strikt in Session, Logging, Audit und IAM-Pfaden fuehren
  - keine stillen oder impliziten Fallbacks zwischen Tenant-Modellen einfuehren
  - Keycloak-Vertrag auf das wirklich benoetigte Minimum reduzieren
- Non-Goals:
  - Plattform-Root-Host in denselben Vertrag wie Tenant-Realm-Logins pressen
  - generische Cross-Realm-Benutzerfreigaben modellieren
  - Berechtigungs- oder Membership-Regeln innerhalb eines Tenants aufweichen

## Decisions

- Decision: Tenant-spezifische Runtime-Scopes bleiben host- und registry-gebunden.
  - Der fuehrende Tenant-Kontext fuer tenant-spezifische Requests wird weiterhin vor dem Login aus Host und Registry bestimmt.

- Decision: Erfolgreicher Login in einem tenant-spezifischen Realm reicht fuer die technische Tenant-Zuordnung.
  - Nach erfolgreichem OIDC-Login wird `instanceId` fuer tenant-spezifische Sessions aus dem bereits aufgeloesten Auth-Scope in die Session uebernommen.
  - Ein fehlender benutzerbezogener `instanceId`-Claim blockiert den Login in tenant-spezifischen Realms nicht mehr.

- Decision: `instanceId` bleibt ein Runtime-Kontext, kein doppeltes Benutzer-Gate.
  - Session, Logging, Audit, JIT-Provisioning und IAM-Abfragen fuehren `instanceId` weiterhin konsequent mit.
  - Die Quelle dieses Wertes ist im Tenant-Fall der Auth-Scope, nicht primaer ein Keycloak-Benutzerattribut.

- Decision: Keycloak-Mapper und User-Attribut werden optional fuer Interop und Diagnose.
  - Ein `instanceId`-Mapper darf weiterhin existieren und ist fuer Debugging, Export oder externe Integrationen nuetzlich.
  - Er ist jedoch kein normativer Vorbedingungs-Check mehr fuer tenant-spezifische Login-Sessions.
  - Admin-UI und Provisioning-Checks duerfen fehlende Mapper oder Tenant-Admin-Attribute weiter als Warnung anzeigen, aber nicht in die Login-Bereitschaft einrechnen.

- Decision: Widerspruechliche `instanceId`-Claims sind harte Scope-Konflikte.
  - Wenn ein Token einen `instanceId`-Claim enthaelt, muss er zum Host-/Registry-/Realm-Scope passen.
  - Abweichungen werden fail-closed als `tenant_scope_conflict` behandelt und duerfen nicht still vom Host-Scope ueberschrieben werden.

- Decision: Realm-basierter Import ersetzt Attribut-basierte Filterung.
  - Benutzer-Import und vergleichbare tenant-spezifische Identity-Pfade behandeln den aktiven Realm als fuehrenden Tenant-Rahmen.
  - Ein per-User-Attribut `instanceId` ist dafuer nicht mehr das primaere Selektionskriterium.

## Risks / Trade-offs

- Risiko: Bestehende Provisioning- und Diagnoselogik referenziert `instanceId`-Mapper heute als Pflichtartefakt.
  - Mitigation: Checklisten, Doku und Statusmodelle muessen explizit zwischen "optionalem Interop-Artefakt" und "hartem Login-Vertrag" unterscheiden.

- Risiko: Alte Realms koennen noch Benutzerattribute oder Mapper fuehren, die von der neuen Runtime-Logik nicht mehr benoetigt werden.
  - Mitigation: Das Modell bleibt kompatibel zu vorhandenen Claims, behandelt diese aber nicht mehr als Gate.

- Risiko: Root-Host- und Tenant-Host-Pfade koennen semantisch vermischt werden.
  - Mitigation: Der Change gilt ausdruecklich nur fuer tenant-spezifische Realms; Plattform-Scope bleibt separat modelliert.

## Migration Plan

1. Spezifikationen fuer IAM-Core und Instanz-Provisioning anpassen.
2. Runtime-Code auf host-/realm-basierten Session-Kontext fuer tenant-spezifische Requests umstellen.
3. Import-/Sync-/JIT-Pfade auf realm-basierten Tenant-Rahmen angleichen.
4. Keycloak-Dokumentation, Instanz-Checklisten und arc42-Doku auf die neue Quellenhierarchie aktualisieren.
5. Tenant-Login-Repros gegen produktionsnahe Referenzfaelle erneut verifizieren.

## Resolved Questions

- Der `instanceId`-Mapper bleibt in UI und Diagnose als Interop-Hinweis sichtbar, blockiert aber keine tenant-spezifischen Logins.
- Ein echter Konflikt zwischen Host-Scope und angeliefertem Claim wird als `tenant_scope_conflict` fail-closed behandelt.
