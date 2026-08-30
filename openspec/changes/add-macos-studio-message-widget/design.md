## Context

Das Studio baut aus `docs/changelog/entries/pr-<nummer>.json` einen Katalog mit höchstens 20 Einträgen. `GET /api/studio/changelog` liefert diesen Katalog heute nur für eine gültige browserseitige Studio-Sitzung. Die Einträge bestehen aus PR-Nummer und Markdown-Text, werden absteigend nach PR-Nummer sortiert und auf der Studio-Startseite dargestellt.

Eine WidgetKit-Erweiterung kann die `httpOnly`-Browser-Session nicht sicher übernehmen. Gleichzeitig darf eine native App den bestehenden BFF-Vertrag nicht dadurch umgehen, dass Browser-Cookies, Passwörter oder ein vertrauliches Client-Secret kopiert werden. Für den nativen Kontext wird deshalb ein eigener öffentlicher OIDC-Client mit eng begrenzten Scopes benötigt. Der bestehende Browserflow bleibt unverändert.

WidgetKit steuert Aktualisierungszeitpunkte selbst. Das Widget ist daher ein übersichtlicher Read-Kanal, aber kein garantierter Echtzeit- oder Alarmkanal. Diese Grenze ist besonders relevant, sobald später kritische Nachrichten angebunden werden.

## Goals / Non-Goals

### Goals

- Einen allgemeinen, typisierten und autorisierten Studio-Nachrichtenfeed bereitstellen.
- Das bestehende Update-Log ohne zweite fachliche Changelog-Quelle als ersten Provider anbinden.
- Einen geräteübergreifend konsistenten Gelesen-Stand pro Account und Instanz führen.
- Eine native macOS-Begleit-App mit kleinen, mittleren und großen WidgetKit-Ansichten bereitstellen.
- Native Anmeldung über den externen Systembrowser, Authorization Code und PKCE absichern.
- Sensible Inhalte im Sperrzustand und in Logs verbergen.
- Browser-, native Client- und Serververträge getrennt testbar halten.

### Non-Goals

- Keine PWA, Tauri- oder Electron-Einführung.
- Keine vollständige zweite Studio-Oberfläche in SwiftUI.
- Keine Offline-Bearbeitung oder lokale Spiegelung von Studio-Fachdaten.
- Keine Push-Benachrichtigungen, garantierte Zustellzeit oder Eskalationslogik.
- Keine persönlichen oder kritischen Nachrichtenquellen im ersten Lieferumfang.
- Keine App-Store-, MDM- oder automatische Desktop-Update-Verteilung im ersten Lieferumfang.

## Decisions

### 1. Ein allgemeiner Feed trennt Quellen, Sichtbarkeit und Darstellung

Eine frameworkunabhängige Feed-Kernlogik definiert mindestens:

```ts
type StudioMessage = {
  id: string;
  source: string;
  title: string;
  summary: string;
  publishedAt: string | null;
  priority: 'normal' | 'important' | 'critical';
  sensitivity: 'internal' | 'personal';
  href: string;
  readAt: string | null;
};
```

Provider liefern nur Nachrichten, die im aktuellen Instanz-/Accountkontext grundsätzlich sichtbar sein dürfen. Die Feed-Orchestrierung validiert Providerantworten, dedupliziert stabile IDs, führt den Gelesen-Stand zusammen und begrenzt das Ergebnis serverseitig. Sie darf Inhalte nicht anhand von Clientangaben autorisieren.

Der erste Provider adaptiert das vorhandene Changelog. Seine stabilen IDs folgen dem Schema `studio-changelog:pr:<nummer>`. Markdown wird für das Widget serverseitig in einen begrenzten Klartextauszug überführt; die native App rendert kein beliebiges HTML oder Markdown.

Neue Changelog-Dokumente erhalten einen validierten RFC-3339-Zeitpunkt `publishedAt`. Bestehende Dokumente bleiben als Legacy-Einträge lesbar. Die bei Einführung im ausgelieferten 20er-Katalog enthaltenen Einträge werden einmalig mit einem belegten Veröffentlichungszeitpunkt ergänzt. Innerhalb verbleibender Legacy-Einträge bleibt die PR-Nummer die deterministische Reihenfolge; neue providerübergreifende Nachrichten benötigen immer `publishedAt`.

### 2. Die API trennt Zähler, Inhalt und Gelesen-Mutation

Die versionierte Account-API stellt bereit:

- `GET /api/v1/account/messages/summary` liefert ausschließlich `unreadCount` und den Aktualisierungszeitpunkt. Das kleine Widget lädt dadurch keine Nachrichtentexte.
- `GET /api/v1/account/messages?limit=<n>` liefert höchstens das serverseitige Maximum von 20 sichtbaren Nachrichten. Für das Widget werden ausschließlich `3` und `5` verwendet.
- `POST /api/v1/account/messages/read` akzeptiert eine begrenzte Liste stabiler Nachrichten-IDs und markiert nur Nachrichten, die für den aktuellen Account weiterhin sichtbar sind.
- `POST /api/v1/account/messages/handoffs` akzeptiert ausschließlich das diskriminierte Ziel `{ kind: 'feed' }` oder `{ kind: 'message', messageId }`. `feed` wird serverseitig auf den festen Nachrichtenbereich abgebildet; `message` erfordert eine weiterhin sichtbare Nachrichten-ID. Freie Pfade oder URLs sind nicht zulässig. Die API erzeugt eine kurzlebige, einmalig verwendbare Browser-Übergabe, die serverseitig an Instanz, Account und das aufgelöste relative Ziel gebunden ist.

Alle Antworten mit accountbezogenen Daten setzen einen privaten `no-store`-Cachevertrag. Fehler verwenden stabile Codes und enthalten weder Token noch Nachrichteninhalte. Der Browser kann dieselben Endpunkte über die bestehende `httpOnly`-Session nutzen; der native Client verwendet Bearer-Token. Beide Transportarten werden vor der fachlichen Feed-Logik in denselben instanzgebundenen Identity-Kontext überführt. Cookie-authentifizierte `POST`-Requests müssen zusätzlich den bestehenden CSRF- und erlaubten Origin-Vertrag erfüllen. Bearer-authentifizierte native Requests verwenden stattdessen ausschließlich die Tokenbindung und dürfen nicht auf eine beigefügte Browser-Session zurückfallen; mehrdeutige Cookie-/Bearer-Requests werden fail-closed abgelehnt.

### 3. Gelesen-Belege werden schmal und instanzisoliert persistiert

Eine neue Tabelle `iam.account_message_receipts` speichert nur:

- `instance_id text`
- `account_id uuid`
- `message_id text`
- `read_at timestamptz`

Der zusammengesetzte Primärschlüssel ist `(instance_id, account_id, message_id)`. Ein zusammengesetzter Fremdschlüssel auf `iam.instance_memberships(instance_id, account_id)` löscht Belege beim Entfernen der Membership. `message_id` erhält eine sinnvolle Längen- und Nichtleer-Constraint. Die Tabelle speichert keine Titel, Texte, Token oder Audience-Daten.

RLS wird aktiviert und erzwungen. Die Policy bindet alle Lese- und Schreiboperationen an `iam.current_instance_id()`. Der Anwendungsdienst bindet zusätzlich immer die aufgelöste `account_id`; Clientwerte dürfen weder Account noch Instanz wählen. Ein idempotentes Upsert setzt `read_at` nur für aktuell sichtbare Nachrichten.

Der Primärschlüssel deckt die führende Abfrage nach Instanz, Account und Nachrichten-ID ab. Weitere Indizes werden nur ergänzt, wenn der reale Query-Plan einen zusätzlichen Zugriffspfad belegt.

`message_id` und `read_at` sind accountbezogene Aktivitätsdaten. Selbst- und Administrator-Exporte der Betroffenenrechtslogik führen deshalb die Gelesen-Belege mit Instanz, Nachrichten-ID und Gelesen-Zeitpunkt vollständig im maschinenlesbaren Export auf. Die Exportautorisierung und Auditierung bleiben unverändert; Nachrichtentexte werden weiterhin nicht in den Belegen gespeichert.

Eine validierte, konfigurierbare Aufbewahrungsfrist begrenzt Gelesen-Belege standardmäßig auf 365 Tage. Der Nachrichtenfeed darf keine Nachricht ausliefern, deren belegter `publishedAt` außerhalb derselben Frist liegt; dadurch kann die periodische Bereinigung Belege anhand von `read_at` löschen, ohne eine noch sichtbare Nachricht wieder ungelesen erscheinen zu lassen. Der Wert gilt für Feed und Belege gemeinsam, Änderungen werden wie andere DSR-Löschfristen auditiert und eine Verringerung wirkt erst nach erfolgreichem Dry Run und expliziter Freigabe. Legacy-Einträge ohne belegten Zeitpunkt sind nur dann Teil des neuen Feeds, wenn sie vor Einführung der Frist mit einem belegten `publishedAt` nachgetragen wurden. Membership- und Account-Löschung entfernen Belege weiterhin unabhängig von der Frist; ein aktiver Legal Hold blockiert die periodische Löschung entsprechend dem bestehenden DSR-Vertrag.

### 4. Native Anmeldung bleibt standardisiert und least-privilege

Die macOS-App ist ein öffentlicher OIDC-Client ohne Client-Secret. Sie verwendet:

- Authorization Code Flow mit PKCE S256,
- den externen, vom Betriebssystem verwalteten Browser,
- eine servervalidierte Auswahl der Studio-Instanz vor Beginn des Authorization Requests,
- einen verifizierten Claimed-HTTPS-Callback auf dem kanonischen Auth-Host,
- exakte Redirect-URI-Allowlisting ohne Wildcards,
- `state`, `nonce` sowie eine Integritätsbindung von Instanz, Realm/Issuer, Callback und API-Host,
- kurzlebige Access Tokens und rotierende Refresh Tokens,
- die Audience der Studio-Account-API,
- ausschließlich `studio.messages.read` und `studio.messages.read-state.update`.

Access- und Refresh-Token werden ausschließlich in einer minimalen Keychain-Access-Group gespeichert, die Container-App und Widget Extension teilen. Sie werden nie in `UserDefaults`, App-Group-Dateien, Logs, Crash-Metadaten oder Telemetrie geschrieben. Die Anwendung zeigt keine Keycloak-Seite in einem kontrollierbaren eingebetteten WebView.

Container-App und Widget Extension koordinieren Refresh-Rotation, Logout und Accountwechsel über dieselbe betriebssystemgestützte, pro App Group prozessübergreifende Sperre mit begrenzter Wartezeit. Nach Erwerb der Sperre liest jeder Prozess Token und Credential-Generation erneut aus der Keychain. Ist dort bereits ein neueres gültiges Access Token vorhanden, verwendet er dieses und sendet den zuvor gelesenen Refresh Token nicht. Andernfalls führt ausschließlich der Sperreninhaber den Refresh aus und ersetzt Tokenpaar und Generation gemeinsam, bevor er die Sperre freigibt. Logout beziehungsweise Accountwechsel warten auf einen laufenden Refresh, widerrufen anschließend das aktuelle serverseitige Tokenpaar, löschen die Credentials und schreiben eine monoton neuere Credential-Generation als Tombstone, bevor sie die Sperre freigeben. Ein späterer Refresher darf nach diesem Tombstone keine alten Credentials mehr schreiben oder senden. Lockdatei und Koordinationsmetadaten enthalten keine Credentials. Bei Lock-Timeout oder unklarem Zustand sendet das Widget keinen möglicherweise alten Refresh Token, sondern zeigt einen neutralen Fehlerzustand; ein tatsächlich rotierter, aber vor der lokalen Speicherung verlorener Token führt fail-closed zur erneuten Anmeldung.

Die vom Benutzer gewählte Studio-Instanz ist kein vertrauenswürdiger Realm- oder Hostparameter. Der kanonische Auth-Host löst sie ausschließlich über die serverseitige Instanz-/Tenant-Registry auf und erzeugt eine kurzlebige, integritätsgeschützte Login-Transaktion. Deren Instanz, erlaubter Realm/Issuer, Callback und API-Host werden in den Authorization Request und `state` gebunden. Der Callback akzeptiert nur exakt diese Transaktion; die App validiert State, Nonce und Issuer und sendet das resultierende Token ausschließlich an den zuvor servervalidierten API-Host. Freie Redirect-, Issuer-, Realm- oder API-Host-Werte aus App-, Callback- oder Token-Daten werden nicht übernommen.

Die Studio-API prüft Signatur, erlaubten Algorithmus, Issuer, Audience, autorisierten Client, Ablauf, Not-before, Scopes sowie die Übereinstimmung von Tokeninstanz, angefragtem API-Host und aktivem Accountzustand. Unbekannte, blockierte, deaktivierte, gelöschte oder tenantfremde Identitäten bleiben fail-closed. Logout entfernt lokale Credentials und widerruft die native Sitzung beziehungsweise Refresh Tokens. Bestehende Forced-Reauth- und Kontosperrpfade müssen native Sitzungen ebenfalls unwirksam machen.

Diese Entscheidung ist eine bewusst begrenzte native Ausnahme vom Browser-BFF aus ADR-009 und wird in einem neuen ADR dokumentiert. Browser erhalten weiterhin keine OIDC-Tokens.

### 5. Die Widget-Größe bestimmt automatisch den Informationsumfang

- `systemSmall`: Studio-Icon, neutrale Bezeichnung und Anzahl ungelesener Nachrichten; es werden keine Nachrichtentexte abgerufen.
- `systemMedium`: bis zu drei neueste sichtbare Nachrichten mit gekürztem Titel und Kurztext.
- `systemLarge`: bis zu fünf neueste sichtbare Nachrichten mit längerer, weiterhin begrenzter Vorschau.

Die Anzahl ist nicht benutzerkonfigurierbar. Leere, ladende, offline-, fehler- und abgelaufene Auth-Zustände erhalten eigene zugängliche Darstellungen. Das Widget zeigt keine endlose Ladeanzeige und unterscheidet nach außen keine sensitiven Auth-Fehlerdetails.

Alle Titel und Texte werden als privacy-sensitive markiert. Im gesperrten oder vom Betriebssystem redigierten Zustand bleibt ausschließlich eine Form wie „3 neue Studio-Nachrichten“ sichtbar. Das Widget führt keinen eigenen persistenten Nachrichten-Cache. Nach einem Auth-Fehler ersetzt die nächste Timeline den Inhalt durch „Anmeldung erforderlich“; beim Logout leert die App Keychain-Zugriff, lokale abgeleitete Zustände und fordert eine Neuladung aller Widget-Timelines an.

Widget-Timeline-Aktualisierungen markieren keine Nachricht als gelesen.

### 6. Gelesen wird erst nach erfolgreicher Darstellung im Studio

Ein neuer Studio-Nachrichtenbereich zeigt dieselben autorisierten Feed-Einträge. Nach erfolgreichem Laden und Darstellen markiert er die dargestellten IDs idempotent als gelesen. Ein Deep Link auf eine einzelne Nachricht markiert nur diese Nachricht, nachdem das Ziel erfolgreich dargestellt wurde.

Das kleine Widget öffnet den Nachrichtenbereich. Ein Eintrag im mittleren oder großen Widget öffnet die konkrete Nachricht. Widget-Interaktionen führen zuerst in die Container-App. Diese fordert mit ihrer nativen Accountidentität eine kurzlebige, einmalig verwendbare Browser-Übergabe für das allowlist-validierte relative Ziel an und öffnet erst dann den externen Browser. Die Übergabe enthält im URL keine lesbare Account-, Instanz- oder Nachrichteninformation und ist serverseitig an genau eine Instanz, einen Account und ein Ziel gebunden.

Der Studio-Nachrichtenbereich konsumiert die Übergabe erst, wenn die Browser-Session exakt zu gebundener Instanz und gebundenem Account passt. Bei fehlender oder abweichender Browseridentität verlangt er eine passende Anmeldung beziehungsweise einen Accountwechsel; bis dahin werden weder Nachrichteninhalt dargestellt noch Gelesen-Belege verändert. Externe oder protokollfremde Ziele, abgelaufene, wiederverwendete oder nicht passende Übergaben werden fail-closed verworfen.

### 7. Die native App ist ein eigener Nx-orchestrierter Workspace-Baustein

Die native App liegt unter `apps/sva-studio-macos` und enthält Container-App, Widget Extension und gemeinsame Swift-Modelle. Nx-Targets kapseln deterministische `xcodebuild`-Aufrufe für Build, Unit-Test und statische Prüfung. Swift-/WidgetKit-Tests laufen mit den nativen Apple-Testwerkzeugen; TypeScript- und Servertests bleiben bei Vitest. Diese begrenzte Toolchain-Ausnahme wird in der Testdokumentation ausdrücklich festgehalten.

Die App enthält keine Kopie der React-Oberfläche und keine serverseitigen Studio-Packages. Der gemeinsame Vertrag ist ausschließlich die versionierte HTTP-API. Vor einem manuellen Setup wird während der Implementierung mit dem vorgeschriebenen Nx-Generator-Workflow geprüft, ob ein geeigneter Generator existiert; fehlt er, greift der dokumentierte Sonderfall für manuelles App-Setup.

### 8. Native Distribution bleibt vom Studio-Rollout getrennt

Der kanonische GitHub-Actions-Pfad `Build` → Dev → Staging → Production bleibt ausschließlich für die Studio-Serveranwendung maßgeblich. Native Builds erzeugen separat versionierte, prüfsummengebundene macOS-Artefakte. Produktive Pilotartefakte müssen mit einer freigegebenen Apple-Identität signiert und notarisiert sein; fehlen Credentials oder Notarisierungsnachweis, darf kein produktives Artefakt veröffentlicht werden.

Backend und native App verwenden eine versionierte, rückwärtskompatible API. Solange eine betroffene native Clientversion innerhalb des dokumentierten Supportfensters liegt und noch nicht migriert wurde, muss der Server ihren Vertrag weiter bedienen. Ein inkompatibler Serververtrag darf erst promotet werden, wenn alle betroffenen Clientversionen nachweislich migriert wurden oder nicht mehr unterstützt werden; ein beschriebener Breaking-Change allein hebt diese Sperre nicht auf. App-Store-, MDM- und automatische Updateverteilung bleiben Folgeentscheidungen.

## Runtime Flows

### Anmeldung

1. Der Benutzer wählt seine Studio-Instanz; der kanonische Auth-Host validiert sie gegen die serverseitige Registry und liefert eine kurzlebige Login-Transaktion mit gebundener Instanz, erlaubtem Realm/Issuer, Callback und API-Host.
2. Die Container-App startet mit dieser Transaktion den OIDC-Flow im externen Systembrowser und erzeugt `state`, `nonce` sowie PKCE-Verifier.
3. Der Auth-Host leitet ausschließlich zum gebundenen Keycloak-Realm; der verifizierte HTTPS-Callback kehrt zur App zurück.
4. Die App prüft Login-Transaktion, State, Nonce und Issuer, tauscht den Code mit dem PKCE-Verifier aus und akzeptiert keine abweichende Instanz oder API-Origin.
5. Credentials und die validierte API-Bindung werden in der geteilten Keychain-Gruppe gespeichert; WidgetKit lädt eine neue Timeline.

### Widget-Aktualisierung

1. Das kleine Widget lädt nur `/summary`; mittlere und große Widgets laden zusätzlich die begrenzte Liste.
2. Die API validiert Token, Scope, Audience, Instanz und aktiven Account.
3. Die Feed-Orchestrierung lädt sichtbare Provider-Nachrichten und verbindet sie mit Gelesen-Belegen.
4. WidgetKit erhält eine begrenzte Timeline. Kein Request verändert den Gelesen-Stand.

### Nachricht öffnen

1. WidgetKit öffnet einen internen, allowlist-validierten App-Link mit der stabilen Nachrichten-ID beziehungsweise dem Nachrichtenbereich als Ziel.
2. Die Container-App fordert mit ihrer nativen Sitzung eine kurzlebige, einmalige und an Instanz, Account sowie relatives Ziel gebundene Browser-Übergabe an.
3. Das Studio authentifiziert den Benutzer über seinen normalen Browser-/PWA-Flow und konsumiert die Übergabe nur bei exakter Übereinstimmung von Browser- und nativer Identität.
4. Bei einer abweichenden Browseridentität werden vor passender Anmeldung weder Inhalt dargestellt noch Gelesen-Belege verändert.
5. Nach erfolgreicher Darstellung markiert der Nachrichtenbereich die sichtbaren IDs als gelesen; App beziehungsweise Widget aktualisieren den Zähler beim nächsten Timeline-Reload.

## Risks / Trade-offs

- **WidgetKit ist nicht echtzeitfähig:** Kritische Zustellung darf nicht allein vom Widget abhängen; Push und Eskalation bleiben getrennte Folgearbeit.
- **Native Token erhöhen die Client-Angriffsfläche:** Öffentlicher Client, PKCE, externe Browseranmeldung, enge Scopes, Keychain, kurze Laufzeiten, Rotation und serverseitige Accountprüfung begrenzen das Risiko.
- **Widget-Snapshots werden vom Betriebssystem verwaltet:** Privacy-Redaktion, minimale Inhalte und das Vermeiden eigener Klartext-Caches reduzieren die Exposition, können aber keinen bereits entsperrt angezeigten Bildschirm gegen Shoulder Surfing schützen.
- **Ein zweiter Releasekanal entsteht:** Nx-Orchestrierung, Signierung, Notarisierung und getrennte Dokumentation machen den Status explizit; der Studio-Rollout bleibt unverändert.
- **Legacy-Changelog-Einträge besitzen keinen Zeitpunkt:** Neue Einträge werden gehärtet, die aktuell ausgelieferte Teilmenge wird belegt nachgetragen und Legacy-Sortierung bleibt deterministisch.
- **macOS-only:** Andere Plattformen konsumieren weiterhin den Studio-Nachrichtenbereich; zusätzliche native Widgets sind eigene Changes.

## Migration Plan

1. Feed-Vertrag und Changelog-Adapter ohne Änderung der bestehenden Startseitenanzeige einführen.
2. Gelesen-Belege per idempotenter Goose-Migration ergänzen; Schema-Snapshot und Übersicht fortschreiben.
3. Versionierte Account-API und neuen Studio-Nachrichtenbereich für bestehende Browser-Sessions ausrollen.
4. Native OIDC-Konfiguration, Bearer-Validierung und Widerruf hinter expliziter Registry-/Client-Freigabe einführen.
5. Native App und Widgets zunächst gegen Dev und Staging abnehmen.
6. Erst nach Security-, Privacy-, Accessibility-, Signierungs- und Notarisierungsnachweis ein Pilotartefakt veröffentlichen.

Der Rollback deaktiviert zuerst den nativen Client und widerruft Refresh Tokens. Feed-API und Gelesen-Belege können kompatibel bestehen bleiben; die Migration darf erst in einem getrennten, belegten Cleanup entfernt werden.

## Validation Strategy

- Unit-Tests für Provider-Normalisierung, Deduplizierung, Sortierung, Klartextauszug, Limits und Gelesen-Zusammenführung.
- API-Tests für Cookie- und Bearer-Identitäten, Audience/Issuer/Scope, Instanzisolation, deaktivierte Accounts, Eingabegrenzen, `no-store` und stabile Fehlercodes.
- PostgreSQL-16-Migrationstest Up/Down/Up sowie RLS-, Membership-FK-, Upsert- und Query-Plan-Nachweise.
- Web-Tests für Nachrichtenbereich, Gelesen-Zeitpunkt, Deep Links, i18n, Tastaturbedienung und WCAG.
- Native Unit-Tests für DTO-Validierung, Keychain-Abstraktion, prozessübergreifende Refresh-Serialisierung, Credential-Generationen, Tokenzustände, Größenabbildung und Fehlerdarstellung.
- Native UI-/Snapshot-Prüfungen für kleine, mittlere und große Widgets einschließlich Dynamic Type, hoher Kontrast, VoiceOver und redigiertem Zustand.
- Integrationsprüfung der servervalidierten Instanzauswahl, des externen Browserlogins, der State-/Issuer-/Callback-/API-Host-Bindung, konkurrierender App-/Widget-Refreshes, accountgebundener Browser-Übergaben, von Logout/Widerruf, Account-Deaktivierung und Realm-/Instanzkonflikten gegen Staging.
- DSR-Tests für vollständigen Selbst-/Adminexport der Gelesen-Belege, konfigurierbare Frist, Dry Run, Legal Hold und fristgerechte Bereinigung.
- Release-Gate für Signatur, Notarisierung, Checksummen und den rückwärtskompatiblen API-/Browser-Übergabevertrag.
