## Kontext

Für Plugin-Aktionen existiert bereits ein fully-qualified Namensschema. Andere pluginbezogene Beiträge verwenden diese Strenge bislang noch nicht einheitlich. Mit wachsender Zahl statischer Packages würde das zu Kollisionen und schwer prüfbaren Namenslandschaften führen.

## Entscheidungen

### 1. Namespacing gilt für alle pluginbezogenen Host-Beiträge

Nicht nur Aktionen, sondern auch Content-Typen, Admin-Ressourcen, Audit-Events, Such-Facets und i18n-Namespaces leiten sich von einer stabilen Plugin-Identität ab.

### 2. Plugin-Identität ist die Primärquelle

Aus der kanonischen Plugin-ID werden die abgeleiteten Registrierungsnamen gebildet. Der Host validiert, dass Beiträge nur im eigenen Namensraum liegen.

### 3. Governance besteht aus Vertrag, Validierung und Review

Namespacing wird nicht nur dokumentiert, sondern in SDK, Host-Validierung und Review-Regeln abgesichert.
