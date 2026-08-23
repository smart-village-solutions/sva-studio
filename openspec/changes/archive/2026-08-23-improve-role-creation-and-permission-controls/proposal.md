# Change: Rollenanlage und fehlende Aktionsrechte verständlich absichern

## Why

Issue #626 zeigt weiterhin vermeidbare technische Begriffe und unklare Zustände in der Rollenverwaltung: Administrator:innen müssen einen technischen Schlüssel und ein intern verwendetes `roleLevel` pflegen, der Speicherzustand ist nicht an tatsächliche Änderungen gebunden und die fachliche Wirkung einzelner Rechte ist nicht überall eindeutig. Zusätzlich wird das Senden einer Push-Benachrichtigung derzeit nicht durch ein eigenes positives Recht geschützt.

Die bestehenden IAM-Verträge bieten bereits scope-fähige Rollenrechte sowie getrennte Primitive für Veröffentlichen und Sichtbarkeitswechsel. Der Change soll diese Grundlagen verständlich nutzbar machen und nur die tatsächlich fehlende Push-Autorisierung ergänzen.

## What Changes

- Die normale Studio-Rollenanlage verwendet den Anzeigenamen als primäre Eingabe und erzeugt daraus serverseitig einen stabilen, kollisionsfreien technischen Rollenschlüssel. Explizite technische Schlüssel bleiben nur für bestehende API-Kompatibilität akzeptiert und werden nicht in der UI angeboten.
- Das bestehende `roleLevel` bleibt als internes Kompatibilitäts- und Schutzfeld erhalten, wird aber aus den normalen Rollenformularen und Rollenlisten entfernt. Custom-Rollen ohne expliziten Legacy-Wert erhalten serverseitig den sicheren Standardwert `0`.
- Rollenmetadaten- und Rollenrechte-Formulare erhalten einen echten Dirty-State. Speichern ist ohne fachliche Änderung deaktiviert und kehrt nach erfolgreichem Speichern in diesen Zustand zurück.
- Die Rechteauswahl erklärt fachliche Aktion, betroffenen Bereich und die Scopes `own`, `organization` und `all` in lokalisierten Begriffen. Technische Schlüssel bleiben einklappbare Zusatzinformation.
- Die vorhandenen positiven Rechte `content.publish` und `content.changeStatus` bleiben getrennt und werden in der Rollenverwaltung eindeutig als „Veröffentlichen“ beziehungsweise „Sichtbarkeitsstatus ändern“ dargestellt und getestet.
- Das News-Modul führt `news.pushNotification` als eigenes vollständig qualifiziertes, serverseitig durchgesetztes Recht ein. Ein vorhandenes `news.create`, `news.update` oder `content.publish` gewährt den Push-Versand nicht implizit.
- Bestehende Custom-Rollen erhalten das neue Push-Recht nicht automatisch. Die geschützte Rolle `system_admin` folgt weiterhin dem bestehenden Vertrag für den vollständigen tenantlokalen Permission-Katalog.
- Rollenbezogene Fehlermeldungen erklären geschützte Verwaltungsgrenzen, ohne ein in der UI verborgenes numerisches Rollenlevel vorauszusetzen.

## Non-Goals

- Keine Rollen- oder Gruppenvorlagen und keine neue Preset-Infrastruktur
- Kein physischer Rückbau von `roleLevel` aus Datenbank-, API-, Audit- oder Kompatibilitätsverträgen
- Keine allgemeine Neugestaltung der IAM-Hierarchie oder Delegationslogik
- Keine neuen Publish-Rechte pro Plugin; `content.publish` bleibt die kanonische Veröffentlichungsprimitive
- Keine Änderung der fachlichen Bedeutung von `own`, `organization` oder `all`
- Keine neue globale Feedback-, Toast- oder Formularplattform

## Impact

- Affected specs: `account-ui`, `iam-access-control`, `plugin-actions`
- Affected code:
  - `apps/sva-studio-react/src/routes/admin/roles/`
  - `apps/sva-studio-react/src/i18n/resources/{de,en}/admin/roles.resources.ts`
  - `packages/iam-admin/`
  - `packages/core/src/iam/` und IAM-Seeds/Reconcile
  - `packages/plugin-news/`
  - `packages/sva-mainserver/src/server/news-route.ts`
  - zugehörige Unit-, Integrations- und E2E-Tests
- Affected arc42 sections:
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
- Related issue: `#626`
