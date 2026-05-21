## Context

Das Studio besitzt bereits DSR-nahe Funktionen, Audit-Logging und ein tab-basiertes IAM-Cockpit, aber noch kein tenantbezogenes Löschkonzept für inaktive Accounts. Für diesen Change muss ein eigenständiges Regelmodul beschrieben werden, das Tenant-Admins konfigurieren können und das Self-Service, Berechtigungen und Auditspur konsistent ergänzt.

## Goals / Non-Goals

- Goals:
  - Tenantweite Default-Regeln für Account-Deaktivierung, Pseudonymisierung und finalen Tombstone-Soft-Delete
  - Transparente Anzeige der Regeln in Admin- und Self-Service-Oberflächen
  - Ein tenantseitig freischaltbarer per-Account-Override für die Behandlung eigener Inhalte in `iam.contents`
  - Ein operativer Runtime-/Ops-Einstieg für tenantweite Lifecycle-Läufe
- Non-Goals:
  - Keine Unterstützung für Root-/Plattform-Admins ohne Tenant-Scope
  - Kein neues Aktivitäts- oder Telemetrie-Tracking-System
  - Keine physische Löschung von Accounts oder Inhalten in V1
  - Keine Inhaltsdomänen außerhalb von `iam.contents`
  - Keine neue feingranulare Action-Matrix oder dedizierten Audit-Event-Familien in diesem Change

## Decisions

- Decision: Inaktivität wird in V1 ausschließlich aus erfolgreichen Login-Events abgeleitet.
  - Rationale: Das nutzt den bereits in den bestehenden IAM-Read-Models etablierten Login-Zeitpunkt und vermeidet ein neues Aktivitäts-Tracking-System.
  - Kanonische Quelle: V1 verwendet für Online- und Offline-Auswertung `MAX(iam.activity_logs.created_at WHERE event_type = 'login' AND result = 'success')` pro Tenant-Account der betroffenen `instanceId`.
  - Tenant-Scope: Dieser Wert wird nicht als globales Cross-Tenant-Inaktivitätssignal interpretiert.
  - Fehlversuche: Fehlgeschlagene Login-Versuche halten den fachlichen Aktivitätszeitpunkt nicht frisch und dürfen den Lifecycle daher nicht verzögern.
  - Persistierter Fallback: `iam.accounts.last_login_at` darf im Schema vorhanden sein, wird in V1 aber nicht zur führenden fachlichen Wahrheit gemacht.
  - Null-Handling und Schwellwerte: Accounts ohne Login-Event sind in V1 nicht für den automatischen Inaktivitäts-Lifecycle qualifiziert. Ein Schwellwert `N` gilt als erreicht, sobald `last_login_at + N * 24h <= now()`.
  - Manuelle Läufe: Accounts ohne Login-Event werden auch durch manuelle Läufe dieses Deletion-Rules-Mechanismus nicht verarbeitet; ihre Behandlung bleibt außerhalb dieses V1-Features und erfolgt über separate manuelle Account-Administration.

- Decision: Tenant-Admins verwalten die Regeln in `/admin/iam?tab=deletion-rules`.
  - Rationale: Das Feature gehört in das bestehende IAM-Transparenz- und Governance-Cockpit und bleibt damit für Betreiber auffindbar.
  - Normative Baseline-Defaults/Fallbacks für neue oder noch nicht konfigurierte Tenants: `deactivateAfterDays=90`, `pseudonymizeAfterDays=180`, `deleteAfterDays=365`
  - Numerische Domäne: `deactivateAfterDays`, `pseudonymizeAfterDays` und `deleteAfterDays` sind positive ganzzahlige Tageswerte und müssen strikt `deactivateAfterDays < pseudonymizeAfterDays < deleteAfterDays` erfüllen.
  - Geerbte Default-Inhaltsstrategie für unkonfigurierte Tenants: `beibehalten`
  - Tenant-Schalter für Self-Service-Overrides: `allowContentPreferenceOverride` ist Teil der Tenant-Konfiguration und startet mit Default `false`.
  - UI-Verhalten für unkonfigurierte Tenants: Die Oberfläche zeigt diese Baseline-Defaults, die geerbte Default-Inhaltsstrategie `beibehalten` und den Override-Schalter deaktiviert als wirksamen Zustand; Speichern erzeugt oder aktualisiert eine explizite Tenant-Konfiguration.
  - Zugriffsmodell im gelieferten Scope: Nur tenantgebundene Admin-Accounts (`iam_admin`, `support_admin`, `system_admin`) mit passender `instanceId` erhalten den Admin-Tab; Root-/Plattform-Admins ohne Tenant-Scope bleiben ausgeschlossen.
  - Zustandsanforderungen: Der Admin-Tab benötigt explizite Lade-, Fehler-, Read-only- und Denied-Zustände; ein unkonfigurierter Tenant erzeugt keinen leeren Zustand, sondern zeigt wirksame Baseline-Defaults.

- Decision: Der Lebenszyklus verwendet die Zustände `active`, `deactivated`, `pseudonymized` und `deleted`.
  - Rationale: Diese Zustände bilden die fachlichen Eskalationsstufen verständlich ab und trennen reversible Sperre von irreversibleren Datenschutzschritten.
  - Zustandseffekte: `deactivated` blockiert Login und reguläre Nutzung des Accounts; bestehende Sessions dürfen danach keinen normalen Zugriff mehr vermitteln. Nur ein separater Reaktivierungsprozess kann die Nutzbarkeit wiederherstellen. `pseudonymized` lässt den Account weiterhin unbenutzbar für Login und Nutzung, entfernt oder pseudonymisiert direkte identifizierende Account-Felder irreversibel und erhält den Datensatz für Audit- und Referenzintegrität. `deleted` ist ein finaler Tombstone-Soft-Delete ohne physische Löschung; der Account bleibt unbenutzbar, und die Deleted-/Tombstone-Darstellung überschreibt eine frühere pseudonymisierte Darstellung bei erhaltener Referenz- und Auditintegrität.
  - Reaktivierungssemantik: `deactivated` wird nicht automatisch durch Login aufgehoben; eine Reaktivierung verlangt einen separaten Prozess. Ohne Reaktivierung dürfen spätere automatische Lifecycle-Stufen weiterhin greifen.
  - Laufsemantik: Ein einzelner geplanter oder manueller Lifecycle-Lauf darf einen Account höchstens um eine benachbarte Stufe weiterbewegen (`active -> deactivated`, `deactivated -> pseudonymized`, `pseudonymized -> deleted`), auch wenn mehrere Schwellwerte bereits überschritten sind. Weitere Fortschritte erfolgen erst in nachfolgenden Läufen.

- Decision: `deleted` bleibt ein finaler Tombstone-Soft-Delete.
  - Rationale: Referenzintegrität, Auditierbarkeit und Compliance-Nachweise bleiben erhalten, ohne eine Hard-Delete-Kaskade zu verlangen.

- Decision: Die Inhaltsbehandlung in V1 beschränkt sich auf `iam.contents`, mit tenantweitem Default und per-Account-Override.
  - Rationale: Das reduziert Komplexität und schafft dennoch eine klare Nutzerentscheidung für die einzige unterstützte Inhaltsdomäne.
  - Normative V1-Strategiemenge: `beibehalten`, `mit Eigentümer-Lifecycle mitbehandeln`
  - Strategiebedeutung in V1: `beibehalten` lässt Inhalte über alle Account-Zustandswechsel unverändert und koppelt sie nie an den Lifecycle. `mit Eigentümer-Lifecycle mitbehandeln` spiegelt die jeweils erreichte Account-Stufe auf `iam.contents`: `deactivated` setzt mindestens den referenzwahrenden Content-Lifecycle-Zustand `deactivated`, `pseudonymized` erhält Inhalte referenzwahrend und ersetzt owner-/author-facing Felder durch ein stabiles Pseudonym-Label, `deleted` markiert Inhalte referenzwahrend als gelöscht und ersetzt owner-/author-facing Felder durch ein Deleted-Label.
  - Sichtbarkeit: Ob `deactivated`-Inhalte in einer konkreten Oberfläche ausgeblendet oder nur als deaktiviert dargestellt werden, bleibt eine nachgelagerte Interpretationsfrage der konsumierenden Read-Models/UI und ist in V1 keine physische Löschwirkung.
  - Labelstabilität: Die ersetzenden Lifecycle-Labels für owner-/author-facing Ownership- und Display-Name-Felder sind pro Locale über alle betroffenen Entitäten stabil und nicht pro Account oder Inhalt individuell abgeleitet. Deutsche Standardbeispiele für diese stabilen Semantiken sind `Pseudonymisiert` und `Gelöscht`.
  - V1 löscht `iam.contents`-Zeilen niemals physisch.
  - Geerbte Baseline-Strategie ohne Tenant-Konfiguration: `beibehalten`
  - Override-Autorisierung: Der per-Account-Override ist ein Self-Service-Schreibpfad für den eigenen Tenant-Account; der Zielaccount wird serverseitig aus Session/Auth-Kontext gebunden. Dieser Change führt keinen separaten Admin-Schreibpfad für fremde Overrides ein.
  - Override-Freigabe: Tenant-Admins können Self-Service-Overrides tenantweit erlauben oder unterbinden. Wenn Overrides deaktiviert sind, zeigt die Privacy-UI nur den wirksamen Tenant-Standard und keinen Schreibbereich.
  - Rückkehr zum Tenant-Default: Benutzer können ihren expliziten Override indirekt entfernen, indem sie denselben Wert wie den Tenant-Standard speichern; dann bleibt nur noch der wirksame Tenant-Standard bestehen.

- Decision: Der gelieferte Scope bleibt bei tenantgebundenen Rollen- und Kontextprüfungen statt bei einer neuen Action-Matrix.
  - Rationale: Das liefert die gewünschte Tenant-Abgrenzung mit geringerer Querwirkung auf den bestehenden IAM-Rechtekatalog.
  - Admin-Zugriff: `/admin/iam?tab=deletion-rules` ist nur mit Tenant-Scope und Admin-Rolle verfügbar.
  - Self-Service: `/account/privacy` und die Schreiboperation für Inhaltspräferenzen sind ausschließlich an das eigene authentifizierte Tenant-Konto gebunden.
  - Root-/Plattform-Scope: Root-/Plattform-Admins ohne aktive `instanceId` sehen weder den Admin-Tab noch die Self-Service-Löschregeln-Box.
  - Laufreichweite: Manuelle oder geplante Läufe dieses V1-Features sind tenantweit für die aktive `instanceId` definiert und verarbeiten alle dafür qualifizierten Accounts; per-Account- oder Teilmengenläufe gehören nicht zu diesem Change.

- Decision: Lifecycle-Ausführung erhält einen expliziten Ops-Einstieg.
  - Rationale: Tenantweite Läufe sollen operational erreichbar sein, ohne den Feature-Scope an eine neue UI-Steuerung zu koppeln.
  - Einstieg: `pnpm iam:account-deletion-rules:run`
  - Semantik: Der Lauf verwendet denselben tenantbezogenen Login-Zeitpunkt wie die Read-Models und bewegt einen Account pro Lauf höchstens um eine Stufe.
  - Betriebsmodell: V1 enthält bewusst keinen impliziten Scheduler in diesem Change; die Lifecycle-Ausführung erfolgt nur über einen explizit eingerichteten operativen Trigger, Cronjob oder manuellen Run.

## Risks / Trade-offs

- Login-Events können fachlich weniger reichhaltig sein als ein vollwertiges Aktivitätsmodell.
  - Mitigation: Der Scope wird explizit dokumentiert; spätere Erweiterungen können zusätzliche Aktivitätsquellen separat einführen.

- Ein Tombstone-Soft-Delete kann bei Nutzern als unvollständige Löschung missverstanden werden.
  - Mitigation: Self-Service und Audit-Nachweise müssen den finalen Zustand und seine Datenschutzwirkung klar erläutern.

- Die führende fachliche Wahrheit für den letzten Login liegt in der Aggregation über `iam.activity_logs`, obwohl ein persistiertes Feld existiert.
  - Mitigation: Die Doku benennt diese Abgrenzung explizit; spätere Denormalisierung oder Backfill kann separat erfolgen.

## Migration Plan

1. Tenantbezogene Regeln, Zustände und Inhaltsstrategien fachlich normieren.
2. Admin-Cockpit-Tab und Self-Service-Anzeigen samt tenantseitiger Override-Freigabe spezifizieren.
3. Runtime-, Maintenance- und Ops-Einstieg gegen denselben Login-Zeitpunkt wie die bestehenden Read-Models ausrichten.
4. Danach Implementierung und Dokumentation gegen die freigegebenen Deltas planen.

## Open Questions

- Wie der separate Reaktivierungsprozess operativ oder UI-seitig ausgelöst wird, bleibt einem nachfolgenden Implementierungschange vorbehalten.
