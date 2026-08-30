# ADR-056: Extension-Tiers und scopegebundene Plugin-Beiträge

**Status:** Accepted
**Entscheidungsdatum:** 2026-08-30
**Entschieden durch:** SVA Studio Team

## Kontext

Der bestehende Plugin-Snapshot validiert Namespaces und tenantbezogene
`UiAccessRequirement`s. Für SSF und weitere administrative Plugins müssen
Plugins jedoch auch eng begrenzte Root-Funktionen beitragen können, ohne dass
normale Fachplugins Plattformrollen beanspruchen oder Tenant-Actions als
Root-Berechtigung verwenden.

## Entscheidung

1. Jedes Plugin-Manifest deklariert genau einen Extension-Tier: `feature`,
   `admin` oder `platform`. Fehlende und unbekannte Werte werden vor der
   Snapshot-Materialisierung deterministisch abgewiesen.
2. `feature` ist der Tier für normale Fachplugins und darf ausschließlich
   tenantbezogene Autorisierungsanforderungen beitragen.
3. `admin` und `platform` dürfen ausdrücklich freigegebene Plattformbeiträge
   deklarieren. Plattformbeiträge verwenden ausschließlich
   `UiAccessRequirement.kind = "platform"` mit der Plattformrolle
   `instance_registry_admin`.
4. Route, Navigation, Action und deklarativer Server-Handler eines verknüpften Plugin-Pfads müssen dieselbe
   vollständige Autorisierungsanforderung besitzen. Der Host vergleicht Scope,
   Modus und Rollen beziehungsweise Actions als Mengen.
5. Legacy-Tenant-Guards und `requiredAction` sind für Plattformbeiträge
   unzulässig. Plattformrollen begründen umgekehrt keine Tenant-Berechtigung.
6. Die Manifest-Metadaten werden durch Katalog und Loader in den kanonischen
   Snapshot getragen. Runtime-Consumer dürfen keinen Tier aus Plugin-ID,
   Feature-Flag oder Fachkonfiguration ableiten.
7. Derselbe versionierte Manifestvertrag deklariert je Plugin genau eine
   Tenant-Aktivierungsrichtlinie: `optional`, `automatic` oder `required`.
8. `iam.instance_modules` bleibt die einzige persistente Wahrheit für
   Tenant-Aktivierung. Der Reconcile materialisiert Richtlinie, Herkunft,
   effektiven Zustand, Manifest-/Policy-Revision und Reconcile-Nachweis;
   bestehende Zuweisungen bleiben bei der Migration aktiv.
9. Ein manueller Deaktivierungs-Override überlebt den Reconcile eines
   `automatic`-Plugins. Für `required` erzwingen Service und
   Datenbank-Constraint den aktiven Zustand ohne Override.
10. Plattform- und Tenant-Routen werden in getrennten Snapshot-Sichten geführt
    und anhand der hostvalidierten Auth-Auflösung getrennt materialisiert. Die
    Browser-Hydrierung übernimmt denselben Scope über `/auth/me`; Nutzerrollen
    oder Plugin-IDs sind keine Quelle der Baumwahl.
11. Aktivierungsrichtlinien und Plugin-IAM-Verträge werden atomar aus demselben
    Build-time-Snapshot in die Instanz-Runtime injiziert. Nur hosteigene Module
    dürfen außerhalb dieses Plugin-Snapshots ergänzt werden.
12. Deklarative Server-Handler werden über den Manifest-`server`-Entry an
    ausführbaren Code gebunden. Der Host verlangt vollständige, eindeutige
    Handler-Abdeckung und prüft exakten Pfad, Methode, Authentifizierung,
    Scope, Tenant-Aktivierung und Berechtigung, bevor er einen hosterzeugten
    Execution-Context an Plugin-Code übergibt.
13. Deaktivierung entfernt nur automatisch synchronisierte Modul-Grants.
    Permission-Definitionen und manuelle Rollenzuweisungen bleiben erhalten,
    werden aber für inaktive Module zentral aus den effektiven Berechtigungen
    gefiltert.

## Begründung

- Der Tier ist eine explizite, reviewbare Vertrauensentscheidung des Hosts.
- Die vorhandene scopegebundene Zugriffsauswertung aus ADR-050 bleibt die
  einzige Autorisierungssemantik für Host und Plugins.
- Eine enge Rollen-Allowlist verhindert, dass installierter Plugin-Code neue
  Plattformrollen oder einen parallelen Root-Rechtekatalog etabliert.
- Die Validierung vor der Veröffentlichung des Snapshots verhindert partiell
  registrierte Plugin-Beiträge.
- Ein materialisierter Zustand vermeidet parallele Aktivierungsquellen und
  macht automatische sowie verpflichtende Aktivierung auditierbar.

## Konsequenzen

### Positiv

- SSF-Administration kann dieselbe Plugin-Architektur wie tenantbezogene
  Fachmodule verwenden.
- Normale Fachplugins bleiben auf Tenant-Scope begrenzt.
- Root- und Tenant-Autorisierung bleiben technisch und diagnostisch getrennt.
- Automatisch aktivierte Plugins können dauerhaft deaktiviert werden, ohne
  ihre Fachdaten oder den Reconcile-Nachweis zu löschen.
- Manuelle Rollenbelegungen überleben eine Deaktivierung, ohne währenddessen
  weiterhin Zugriff zu gewähren.

### Negativ

- Alle bestehenden Manifeste benötigen explizite Tier-Metadaten.
- Neue Plattformrollen oder Beitragstypen erfordern eine bewusste Erweiterung
  der Host-Allowlist und ihrer Tests.
- Der Host muss Server-Entry und Deskriptor-Snapshot beim Bootstrap vollständig
  zusammenführen; ein fehlender Handler verhindert den Plugin-Server-Dispatch.

## Verworfene Alternativen

### Impliziter Tier aus Plugin-ID oder Installationsprofil

Verworfen, weil Umbenennungen und Deployment-Konfiguration sonst unbemerkt die
Autorisierungsgrenze verändern könnten.

### Plattformbeiträge für alle Plugins

Verworfen, weil dies Fachplugins unnötig privilegiert und die Angriffsfläche
der Root-Control-Plane vergrößert.

### Eigener SSF-Root-Router außerhalb des Plugin-Snapshots

Verworfen, weil dadurch ein zweiter Routing-, IAM- und Navigationspfad mit
eigener Ownership entstünde.

## Verwandte ADRs

- [ADR-032](ADR-032-plattform-scope-vs-tenant-instanz.md)
- [ADR-034](ADR-034-plugin-sdk-vertrag-v1.md)
- [ADR-041](ADR-041-plugin-plattform-v2-fuer-externe-distribution.md)
- [ADR-046](ADR-046-plattform-vs-tenant-rollenmodell-und-legacy-standardrollen.md)
- [ADR-050](ADR-050-zentraler-scopegebundener-ui-zugriff.md)
