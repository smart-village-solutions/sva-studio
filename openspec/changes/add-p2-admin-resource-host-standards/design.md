## Kontext

Ein belastbarer Admin-Ressourcen-Vertrag reicht nicht aus, wenn Suche, Filter, Bulk-Aktionen, Historie und Revisionen je Ressource neu erfunden werden. Für ein CMS-Backbone muss der Host diese Querschnittsfähigkeiten standardisieren.

## Entscheidungen

### 1. Suche, Filter und Bulk-Aktionen sind Host-Fähigkeiten

Packages konfigurieren diese Fähigkeiten, bauen aber keinen parallelen Funktionsstack.

Die Sicherheitsentscheidung für diese Fähigkeiten bleibt davon getrennt: fachliche Bulk-Aktionen oder vergleichbare Admin-Aktionen verwenden weiterhin das zentrale Capability-Mapping auf primitive Studio-Rechte und bekommen kein separates Admin-Sicherheitsmodell.

### 2. Historie und Revisionen bleiben systemweit konsistent

Historie, Änderungsdarstellung und Revisionen werden hostgeführt modelliert, damit verschiedene Ressourcentypen dieselben Bedienmuster verwenden.

### 3. Admin-Ressourcen spezialisieren Konfiguration, nicht Grundmuster

Ressourcen beschreiben Filterfelder, Bulk-Aktionsangebote oder Suchmetadaten; das UI-Grundgerüst und die Interaktionsregeln kommen vom Host.

Dasselbe gilt für Autorisierung und Auditierbarkeit: Die Ressource konfiguriert angebotene Aktionen, aber Guard-Anwendung, Capability-Mapping und Audit-Spur bleiben querschnittlich hostgeführt.
