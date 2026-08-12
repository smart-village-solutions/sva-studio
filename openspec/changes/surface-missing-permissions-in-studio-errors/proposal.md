# Change: Fehlende Berechtigungen in Studio-Fehlern benennen

## Why

Das Studio meldet verweigerte Seitenzugriffe und Fachaktionen heute vielfach nur als allgemeines `forbidden` oder „Keine Berechtigung“. Obwohl Route-Guards und serverseitige Autorisierung die geprüfte Action häufig kennen, geht diese Information auf dem Weg zur sichtbaren Meldung verloren. Benutzer und Administration können dadurch nicht erkennen, welches Recht für die gewünschte Aktion benötigt wird.

## What Changes

- Berechtigungsablehnungen erhalten einen gemeinsamen, additiven und typsicheren Detailvertrag mit geprüften Permission-IDs und der Semantik `allOf` oder `anyOf`.
- Serverseitige Autorisierung bleibt die führende Quelle für die benannte Action; Clients dürfen fehlende Rechte nicht aus Buttons, Routen oder HTTP-Statuscodes erraten.
- Route-Guards erhalten ihren berechneten Denial-Kontext bis zur sichtbaren Fehlermeldung, ohne Rollen oder interne Entscheidungsdetails offenzulegen.
- Das Studio zeigt den lokalisierten Berechtigungsnamen zusammen mit der technischen Action-ID, zum Beispiel „Benutzer bearbeiten (`iam.user.write`)“.
- Mehrfachanforderungen unterscheiden zwischen „alle erforderlich“ und „eine davon erforderlich“.
- Scope-, ABAC- und Hierarchieablehnungen benennen die geprüfte Action, behaupten aber nicht fälschlich, dass das Recht vollständig fehlt.
- Technische IAM-Ausfälle, ein degradierter Permission-Snapshot und fachliche `403`-Fälle ohne Permission-Entscheidung bleiben von fehlenden Berechtigungen getrennt.
- Host- und Plugin-Berechtigungen verwenden einen gemeinsamen Auflösungspfad für lokalisierte Anzeigenamen mit sicherem Fallback auf die Action-ID.

## Approval Status

Der fachliche Entwurf wurde am 12. August 2026 freigegeben. Die Implementierung beginnt erst nach Prüfung und ausdrücklicher Freigabe dieses OpenSpec-Changes.

## Scope Clarification

- Im Scope:
  - verweigerte Seiten-, Admin- und Plugin-Routen
  - Lade-, Erstell-, Speicher-, Lösch-, Bulk-, Import- und sonstige Fachaktionen
  - IAM-, Medien-, Mainserver-, Waste- und hostgeführte Plugin-Autorisierungspfade
  - deutsche und englische Darstellung, Accessibility und sichere Fallbacks
- Nicht im Scope:
  - Änderung der Autorisierungsentscheidung oder Vergabe zusätzlicher Rechte
  - Offenlegung von Rollen, Gruppen, Grants, Policy-Ausdrücken oder internen Diagnosedaten
  - Umdeutung jedes HTTP `403` in einen Berechtigungsfehler
  - ein neuer Permission-Katalog oder ein zweiter IAM-Entscheidungspfad

## Impact

- Affected specs:
  - `iam-access-control`
  - `account-ui`
  - `routing`
- Expected affected code:
  - `packages/core/`
  - `packages/iam-core/`
  - `packages/auth-runtime/`
  - `packages/routing/`
  - `packages/studio-ui-react/`
  - `packages/studio-module-iam/`
  - `packages/plugin-sdk/` und produktive Fachplugins
  - `packages/sva-mainserver/`
  - `apps/sva-studio-react/`
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
