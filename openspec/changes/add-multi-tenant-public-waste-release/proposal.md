# Change: Öffentlichen Waste-Web-Release für Prignitz und Frankfurt (Oder) ausführen

## Why

Der aktuelle tag-basierte Release baut und deployt die öffentliche Waste-Web-App nur in das fest verdrahtete Prignitz-Environment. Für Frankfurt (Oder) existieren bereits ein getrenntes GitHub-Environment, eine eigene Basis-URL und ein eigener Stack, der vorhandene Workflow kann dieses Ziel aber nicht erreichen.

## What Changes

- Der bestehende Public-Waste-Web-Workflow baut und publiziert das Image einmal pro Release-Tag.
- Anschließend rollt er denselben Image-Tag über getrennte, GitHub-environment-gebundene Deploy-Jobs nach `web-waste-calendar` und `web-waste-calendar-frankfurt-oder` aus.
- Jeder Deploy-Job liest ausschließlich die eigene Environment-Konfiguration, aktualisiert nur den dort konfigurierten Stack und prüft die eigene Basis-URL mit den bestehenden Health-, Startseiten- und Public-API-Smokes.
- Workflow-Vertragstests und das Public-Waste-Release-Runbook dokumentieren die beiden Ziele, den Einmal-Build und das Verhalten bei einem teilweisen Fehlschlag.

## Non-Goals

- Keine Änderung am normalen Studio-Releasepfad `Build` → `Promote`.
- Keine Änderung an Tenantdaten, Datenbanken, Domains, TLS, Portainer-Compose-Dateien oder GitHub-Environment-Secrets/-Variablen.
- Kein automatischer Rollback eines bereits erfolgreich aktualisierten Zielstacks, falls der andere Zielstack fehlschlägt.

## Impact

- Affected specs: `public-waste-calendar`, `deployment-topology`, `architecture-documentation`
- Affected code: `.github/workflows/public-waste-web-release.yml`, vorhandene Workflow-Vertragstests, `docs/operations/public-waste-web-release-runbook.md`
- Affected arc42 sections: `05-building-block-view`, `07-deployment-view`, `08-cross-cutting-concepts`
- Rollout: Nach Merge wird ein neuer Tag `waste-web-v0.1.16` für beide bestehenden Environments veröffentlicht. Jeder Zielstack verwendet denselben veröffentlichten Image-Tag.
