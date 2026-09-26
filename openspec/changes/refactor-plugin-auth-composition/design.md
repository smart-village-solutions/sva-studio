## Kontext und Entscheidung

Der vorhandene `configureInstanceRegistryPluginRuntimeSnapshot` ist die
hostvalidierte Konfigurationsgrenze für Plugin-Lifecycle, IAM-Verträge und
OIDC-Anforderungen. Dort wird ein optionaler Account-Create-Beitrag ergänzt;
`executeCreateUser` konsumiert nur diesen generischen Vertrag. Ein fehlender
Beitrag führt den vorhandenen Create-Callback mit leeren Zusatzattributen aus.

Die Studio-Buildprofile liefern über einen profilgebundenen App-Entrypoint
entweder keinen Auth-Beitrag und keine SSF-OIDC-Anforderungen (`studio`) oder
den SSF-Beitrag und dessen Anforderungen (`ssf`). Das SSF-Profil validiert
vor der Veröffentlichung des Snapshots, dass das Plugin im Katalog enthalten
ist. Der bestehende Nx-Build-Input enthält die Distribution, damit der Cache
kein Artefakt des jeweils anderen Profils zurückliefert. SSF-Fachlogik liegt im
Plugin; die Composition-Root reicht die bereits
vorhandene Host-Funktion für tenantbezogene Plugin-Readiness hinein. Damit
entsteht weder eine Rückabhängigkeit des Plugins auf `@sva/auth-runtime` noch
ein zweiter Account-Persistenzpfad.

Der Beitrag umschließt weiterhin den bestehenden Keycloak-Create und lokalen
Commit. Für aktive SSF-Tenants prüft er die bestätigte Revision unter derselben
Tenant-Sperre und erzeugt `studio_tenant_id`, `ssf_roles`, `ssf_permissions`
und `ssf_authorization_revision`. Fehlende Readiness, Pools oder Sperre bleiben
vor dem Create sichtbar fail-closed. Inaktive oder nicht verwaltete SSF-Tenants
erhalten keine SSF-Claims. An der Kompensation wird nichts geändert.

## Risiken und Nachweise

- Fehlende Profilbindung darf in der SSF-Distribution nicht stillschweigend
  zu einem Core-Create ohne SSF-Claims führen: Bootstrap-Validierung und
  Profiltests prüfen die Bindung vor Request-Annahme.
- Ein statischer Import kann das ausgeschlossene Paket erneut ins Studio-Image
  ziehen: Quell- und Artefaktinventar sowie `/health/live` prüfen die
  physische Abwesenheit und den Start.
- Der neue Port darf keine Rechte erfinden: bestehende SSF-Claim-, Readiness-,
  Sperr- und Account-Kompensationstests bleiben grün; ein gezielter Negativtest
  sperrt die Benutzeranlage vor dem Keycloak-Write.

## Alternativen

Ein Runtime-Flag oder ein Stub für `@sva/plugin-ssf/runtime` würde die direkte
Abhängigkeit nur verdecken. Eine allgemeine Plugin-Installationsplattform wäre
für den aktuellen Build-Blocker zu groß und bleibt #1503-Folgearbeit.
