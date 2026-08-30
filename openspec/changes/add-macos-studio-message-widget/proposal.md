# Change: Geschützten Studio-Nachrichtenfeed mit macOS-Widget ergänzen

## Why

Das Studio-Update-Log ist heute nur innerhalb der Web-Anwendung sichtbar. Nutzer sollen neue Studio-Nachrichten auf einem macOS-Desktop auf einen Blick erkennen können, ohne dafür dauerhaft ein Browserfenster geöffnet zu halten. Der erste Nachrichtenlieferant ist das bestehende Update-Log; der Vertrag muss jedoch von Beginn an auch persönliche und kritische Nachrichten unterstützen, ohne Widget, Authentifizierung oder API später grundlegend neu zu bauen.

## What Changes

- Ein allgemeiner, instanz- und accountgebundener Studio-Nachrichtenfeed aggregiert autorisierte Nachrichtenquellen. Das bestehende Update-Log wird als erste Quelle angebunden.
- Neue versionierte Account-Endpunkte liefern eine reine Ungelesen-Zusammenfassung, begrenzte Nachrichtenlisten und idempotente Gelesen-Markierungen.
- Der Gelesen-Stand wird serverseitig, instanzisoliert und ohne Kopie des Nachrichtentextes persistiert.
- Gelesen-Belege werden in Betroffenenexporte aufgenommen und nach einer konfigurierbaren, mit der Feed-Sichtbarkeit abgestimmten Aufbewahrungsfrist gelöscht.
- Ein nativer, öffentlicher macOS-OIDC-Client meldet Benutzer ausschließlich über den externen Systembrowser mit Authorization Code und PKCE an. Das Widget erhält nur die vollständig qualifizierten Rechte `studio.messages.read` und `studio.messages.read-state.update`.
- Eine kleine native macOS-Begleit-App mit WidgetKit-Erweiterung stellt automatisch passende Inhalte dar: klein nur die Anzahl ungelesener Nachrichten, mittel drei und groß fünf Nachrichten.
- Nachrichtentitel und -texte werden im gesperrten Zustand als sensibel behandelt; sichtbar bleibt nur eine neutrale Anzahl.
- Widget-Interaktionen öffnen den neuen Studio-Nachrichtenbereich oder eine konkrete Nachricht über sichere Deep Links.
- Native Build-, Test-, Signierungs- und Notarisierungsartefakte bilden einen getrennten Client-Releasekanal. Der kanonische Studio-Rollout über Build, Dev, Staging und Production bleibt unverändert und allein maßgeblich für die Serveranwendung.
- Ein neues ADR dokumentiert die begrenzte native OIDC-Ausnahme vom browserseitigen BFF-Vertrag.

## Impact

- Affected specs: `studio-messaging` (neu), `iam-access-control`, `iam-data-subject-rights`, `monorepo-structure`, `deployment-topology`
- Affected code: `apps/sva-studio-react`, `packages/auth-runtime`, IAM-Datenzugriff und Migrationen, Changelog-Artefaktgenerator, neue native App `apps/sva-studio-macos`, Nx-/CI-Konfiguration
- Affected documentation: Nachrichtenfeed-/Widget-Bedienung, native Entwicklung und Distribution, Datenbankschema, IAM- und Architekturunterlagen
- Affected arc42 sections:
  - `docs/architecture/03-context-and-scope.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/07-deployment-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
- Database impact: neue instanzisolierte Gelesen-Belege mit Membership-Fremdschlüssel, DSR-Export und konfigurierbarer Aufbewahrungsfrist; `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` müssen synchron fortgeschrieben werden
- Security impact: neuer nativer Public-Client, Bearer-Token-Prüfung, Keychain-Sharing, Audience-/Scope-Bindung, Token-Widerruf und redigierte Widget-Snapshots
- Rollout impact: keine Änderung am kanonischen Studio-Deploypfad; produktive macOS-Artefakte benötigen zusätzlich Apple-Signierung und Notarisierung

## Scope Boundaries

- Die PWA ist weder Voraussetzung noch Bestandteil dieses Changes.
- Tauri und Electron werden nicht eingeführt.
- Der erste Lieferumfang versendet keine Push-Benachrichtigungen und garantiert keine Echtzeit-Zustellung. Kritische Nachrichten benötigen für garantierte oder fristgebundene Zustellung einen getrennten Folge-Change.
- Der erste Lieferumfang führt keine weiteren Nachrichtenquellen neben dem Update-Log ein, schafft aber den typisierten Provider-Vertrag dafür.
- App-Store-, MDM- und automatische Desktop-Update-Verteilung sind nicht Bestandteil des ersten Lieferumfangs; produktiv verteilte Pilotartefakte müssen dennoch signiert und notarisiert sein.
