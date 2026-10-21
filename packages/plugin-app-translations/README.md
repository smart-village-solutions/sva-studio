# Mehrsprachigkeit — lokaler Pluginanschluss

Optionales Studio-Plugin `app-translations`. Der Host registriert Modul-IAM und Lifecycle über den vorhandenen Katalog. Der Browserentry enthält ausschließlich Metadaten; es gibt noch keine Route, Navigation oder neue HTTP-API.

Der Host injiziert `readLocalReadiness(instanceId)`. Der Jobhandler erhält nur Schema-/Konfigurationsmarker, nie den DeepL-Key. `ready`/`degraded` beziehen sich ausschließlich auf die lokale Katalogbasis. Fehlendes Schema sperrt den Zugriff; fehlender Key lässt lokale Redaktion als eingeschränkt bereit zu. Sprachabdeckung und Anbieterzugriff sind damit nicht geprüft.

`suspend`/`reactivate` sind registriert, scheitern hier aber ausdrücklich mit `app-translations.remote-lifecycle-unavailable`. Der lokale Abschnitt bestätigt keinen Remote-Lifecycle. Publisher, vollständige Abschaltung und Reaktivierung folgen in Tasks 3.8/3.9; mobile App und Formularanzeigen sind nicht Bestandteil dieses Packages.

Prüfungen: `pnpm nx run plugin-app-translations:test:unit` und `pnpm nx run plugin-app-translations:test:types`. Ausführungsrechte und technische Secrets bleiben beim Host; kein eigenes Runtime-Package oder Anbieterregister.
