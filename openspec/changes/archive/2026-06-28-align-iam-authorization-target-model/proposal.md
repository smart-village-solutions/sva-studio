# Align IAM Authorization Target Model

## Warum

Der Code setzt den abgeschlossenen Change `update-iam-ownership-authorization-model` in weiten Teilen um, bleibt aber an mehreren Stellen hinter dem Zielbild aus `docs/guides/iam-autorisierungsmodell-zielbild.md` zurück. Besonders kritisch sind Ownership-Transfers, die sichtbare Autorenanzeige, System-Admin-Ausnahmen, die Normalisierung effektiver Scopes und die Mainserver-Projektion von Organisationskontext als IAM-Ownership.

Ohne einen expliziten Follow-up-Change besteht das Risiko, dass diese Restpunkte als "schon erledigt" gelten, obwohl sie fachlich noch Zielbild-relevant sind.

## Was ändert sich

- Ownership-Transfers werden zielbildkonform autorisiert: entscheidend ist die Update-Berechtigung am aktuellen Inhalt, nicht eine zusätzliche Berechtigung auf den Ziel-Owner.
- Die sichtbare Autorenanzeige wird als eigener Inhaltsvertrag modelliert und bleibt strikt von technischer Ownership getrennt.
- System-Admin-Sonderwege werden runtime-seitig auf Permissions zurückgeführt; verbleibende Bootstrap- oder Reconcile-Ausnahmen werden explizit begrenzt.
- Effektive Permission-Read-Models normalisieren Access-Scopes auf den weitesten wirksamen Scope pro fachlichem Permission-Key und behalten Provenienz nur als Erklärungsspur.
- Die Mainserver-Projektion trennt externen Organisations-/Quellkontext von kanonischer IAM-Ownership.
- Mehrorganisationsfähigkeit bleibt Teil des Zielbilds: Mutationen laufen explizit entweder im Namen der aktiven Organisation oder persönlich im Namen des Benutzers.
- Audit- und Dokumentationspflichten werden für die neuen Ownership- und Autorenanzeige-Entscheidungen ergänzt.

## Auswirkungen

- Betroffene Packages: `packages/core`, `packages/auth-runtime`, `packages/iam-admin`, `apps/sva-studio-react`, ggf. `packages/sva-mainserver`.
- Betroffene Datenmodelle: Content-Ownership, sichtbare Autorenanzeige, Projection-Metadaten, Audit-Events.
- Betroffene Tests: Authorization-Engine, Content-Mutations, Account-/Role-/Group-Admin-Flows, Mainserver-Projection, API-/Schema-Serialisierung.
- Betroffene Dokumentation: IAM-Zielbild, Content-Management-Guide, relevante arc42-Abschnitte und DB-Schema-Snapshot bei Schemaänderungen.

## Nicht-Ziele

- Keine Wiedereinführung von `account_permissions` oder Deny-Effekten.
- Keine Abkehr vom Allow-only-RBAC-Modell.
- Keine neue parallele Autorisierungsengine für Mainserver-Inhalte.
- Keine Einschränkung auf Benutzer mit höchstens einer Organisation.
- Keine direkte Implementierung im Rahmen dieses OpenSpec-Changes.
