## Kontext

Der Studio-Admin besitzt bereits mehrere hostseitig verdrahtete Verwaltungs- und Inhaltsrouten. Für weitere Fachmodule reicht dieses Muster nicht, weil Listen-, Detail- und Editorflächen sonst erneut individuell in Host, Routing und Navigation angeschlossen werden müssten.

Der Change führt deshalb keinen neuen Runtime-Mechanismus ein, sondern einen deklarativen Build-time-Vertrag für Admin-Ressourcen aus Workspace-Packages.

## Entscheidungen

### 1. Admin-Ressourcen sind deklarative Host-Beiträge

Ein Plugin oder Workspace-Package beschreibt eine Admin-Ressource als deklarativen Beitrag mit Identität, Titeln, Guard-Anforderung und den kanonischen Flächen für Liste, Detail, Erstellen, Bearbeiten und Historie.

### 2. Der Host materialisiert daraus Routen und UI-Bindings

Der Host übernimmt die Materialisierung in Routing, Navigation und Standard-Layouts. Packages liefern Komponenten und Metadaten, aber keine separaten app-lokalen Verdrahtungen.

### 3. Admin-Ressourcen ergänzen, ersetzen aber nicht die Host-Kernstruktur

Shell, Guards, Breadcrumbs, Seitentitel, Focus-Management und andere Host-Standards bleiben hostgeführt. Der Registrierungsvertrag beschreibt nur, wo sich eine Ressource in diese Struktur einhängt.

## Nicht-Ziele

- Kein Runtime-Plugin-Laden
- Kein zweiter Routing-Stack nur für Admin-Ressourcen
- Kein eigener Security-Vertrag außerhalb der bestehenden Host-Guards
