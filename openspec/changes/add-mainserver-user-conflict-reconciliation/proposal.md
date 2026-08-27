# Change: Mainserver-Identitätskonflikte gezielt auflösen

## Why

Die persönliche Mainserver-Provisionierung beendet einen Konflikt, bei dem eine E-Mail-Adresse im Mainserver bereits mit einem anderen Keycloak-Subject existiert, korrekt fail-closed mit `local_user_conflict`. Ein System-Admin kann den Befund heute jedoch weder redigiert prüfen noch die bestehende Mainserver-Identität kontrolliert an den aktuellen Studio-Account binden. Wiederholte Reprovisionierung löst den Konflikt nicht.

## What Changes

- Eine Read-only-Prüfung zeigt einem berechtigten `system_admin` den redigierten Konfliktbefund.
- Die Übereinstimmung derselben normalisierten E-Mail-Adresse im Studio und Mainserver ist das ausreichende fachliche Identifikationsmerkmal für den Rebind.
- Ein `system_admin` der betroffenen Instanz kann den Rebind nach Fresh Reauth und einer expliziten Wirkungsbestätigung direkt ausführen; eine zweite Freigabe ist nicht erforderlich.
- Der Rebind verwendet einen dedizierten atomaren und idempotenten Mainserver-Vertrag, der die Bindung und persönlichen Credentials gemeinsam aktualisiert und nach einem unklaren Ergebnis abgefragt werden kann.
- Studio persistiert neue persönliche Credentials ausschließlich serverseitig in Keycloak und verifiziert anschließend die bestehende DataProvider-Bindung.
- Der Ablauf verwendet bestehende Provisioning-/Binding-Zustände und das vorhandene IAM-Audit. Es entsteht weder ein neues Reconciliation-Ledger noch eine allgemeine Approval-Engine.
- Die Benutzer-Detailansicht erhält eine gezielte Prüf- und Reconcile-Aktion mit verständlichen Erfolgs- und Fehlerzuständen.

## Non-Goals

- Keine Verknüpfung bei abweichenden normalisierten E-Mail-Adressen.
- Kein allgemeiner Account-Merge, keine Bulk-Reconciliation und keine Content-Ownership-Umschreibung.
- Keine zweite administrative Freigabestufe und kein generischer Workflow für sicherheitskritische Aktionen.
- Keine direkte Datenbankmanipulation im Mainserver oder Keycloak als Ersatz für den Upstream-Vertrag.
- Keine neue fachliche Persistenz ausschließlich zur Abbildung des Reconcile-Ablaufs.

## Product Decision

Die normalisierte E-Mail-Adresse ist für diesen begrenzten Konfliktfall das maßgebliche und ausreichende Identifikationsmerkmal. Ein berechtigter `system_admin` darf den Rebind nach Fresh Reauth und expliziter Bestätigung ohne Vier-Augen-Freigabe durchführen.

## Impact

- Affected specs: `account-ui`, `iam-access-control`, `iam-auditing`, `sva-mainserver-integration`
- Affected code: `apps/sva-studio-react`, `packages/iam-admin`, `packages/auth-runtime`, `packages/sva-mainserver`, `packages/routing`
- Affected docs: `docs/api/iam-v1.yaml`, IAM-Runbook und relevante arc42-Abschnitte 03, 05, 06, 08 und 09
- New ADR: E-Mail-basierter, administrativer Mainserver-Identitätsrebind
