## 1. Freigabe und gemeinsamer Vertrag

- [x] 1.1 Diesen Vorschlag zusammen mit SSF `update-recording-key-lifecycle` prüfen und vor Laufzeitänderungen freigeben lassen; Repository-Baseline und getrennte Agenten-Ownership bestätigen.
- [ ] 1.2 Pfade, DTOs, kanonische Challenge-Transkripte, Dateiformat, Größen-/TTL-Grenzen und Fehlercodes aus dem Gateway-Vorschlag als gemeinsame Fixtures fixieren; keine zweite Kodierung definieren.

## 2. Autorisierung und Gateway-Client

- [ ] 2.1 `ssf.recording.access.transfer` in Plugin-Actions/Permissions und Autorisierungsprojektion aufnehmen; aus automatischer `system_admin`-Vergabe ausschließen und explizite Vergabe testen.
- [ ] 2.2 Schmale serverseitige Session-Token-Capability für die festen SSF-Endpunkte ergänzen; Mandant aus authentisiertem Kontext ableiten, bestehende CSRF-/Request-Grenzen verwenden.
- [ ] 2.3 RFC-8693-Token-Exchange mit serverseitigem Benutzer-Token und konfigurierter Gateway-Audience implementieren; vertraulichen Client, Standard-Exchange-Schalter und vorhandene Ziel-Audience-/Client-Scopes im selben SSF-Mandanten-Realm provisionieren. Bei fremdem Studio-Realm tenantlokalen Client/Login ausliefern; Cross-Realm-Exchange ablehnen. Ursprüngliches `sub`/Tenant/`acr`/`auth_time` erhalten.
- [ ] 2.4 Typisierten Gateway-Client und Plugin-Serverhandler für die sieben Vertragsoperationen ergänzen; Timeout/Abbruch, Fehlerzuordnung und Geheimnisredaktion vorsehen. Keine Service-Token- oder Actor-Header-Ausweichlösung.
- [ ] 2.5 Fokussierte Auth-/Client-/Handler-Tests für CSRF, direkte falsche Tenants, falsche Audience, entzogene Rechte, alte MFA, nicht verfügbare Exchange-Policy und Gateway-Ausfall ausführen; echten Keycloak-Test für Same-Realm-Erfolg und Cross-Realm-/fehlende-Scopes-Ablehnung ergänzen.

## 3. Organisationsschlüssel-Seite

- [ ] 3.1 Guarded Route und Navigation `/plugins/ssf/organisation-keys` samt vorhandenen Studio-Templates und DE/EN-Texten ergänzen; öffentliche aktive/historische Versionen vom Gateway anzeigen.
- [ ] 3.2 Lokale P-256-Erzeugung und versionierte JSON-Datei, Download/Druckansicht und Sicherungsbestätigung implementieren; anschließend Challenge prüfen und vorbereitete Version aktivieren.
- [ ] 3.3 Ersatzflow mit Hinweisen auf künftige und historische Aufzeichnungen ergänzen; Abbruch, Ablauf, parallele Aktivierung und ungewisses Netzwerkresultat ohne stillen Schlüsselwechsel behandeln.
- [ ] 3.4 Datei-/Crypto-Testvektoren und UI-Tests für Download vor Aktivierung, explizite Sicherung, Abbruch, falsche Datei, Kontextwechsel, identische Aktivierungswiederholung und unveränderte historische Bezüge ausführen.

## 4. Zugänge verwalten

- [ ] 4.1 Guarded Route `/plugins/ssf/access-transfers`, Quell-/Zielperson, paginierte Aufzeichnungsmetadaten, begründete Auswahl und Versionsgruppen implementieren; keine verschlüsselten Sprachen/Inhalte anreichern.
- [ ] 4.2 Lokales Laden/Validieren der Organisationsschlüsseldatei und Umschlüsseln der exakt vorbereiteten Inhaltsschlüssel auf den bestätigten Zielschlüssel implementieren; Private-/Rohschlüssel bleiben im Tab.
- [ ] 4.3 Empfänger-/Umfangsbestätigung, HMAC-Besitznachweis, atomaren Commit und Beleg anzeigen. Auswahländerungen verwerfen Vorbereitung; Versionskonflikte verlangen neue Bestätigung.
- [ ] 4.4 Erfolg, falscher Tenant/Schlüssel, Zielrotation, fehlender/zusätzlicher Wrap, entzogene Transferberechtigung, Ablauf, gelöschte Aufzeichnung und wiederholter Commit mit Gateway-Vertragstests absichern.
- [ ] 4.5 HTTP-/SSR-/Log-Assertions auf Nichtübertragung privater Schlüssel und Klartexte sowie Tab-Lebenszyklus-/Druckansichtsbereinigung ausführen.

## 5. Integration und Abschluss

- [ ] 5.1 Bestehende `passphraseFileEnabled`- und Aufzeichnungseinstellungen unverändert round-trip testen; readinessabhängige Hinweise von bloßer Richtlinienaktivierung trennen.
- [ ] 5.2 Gemeinsamen Studio–Keycloak–Gateway-Test für Ersteinrichtung, Ersatz, gezielte Wiederherstellung und erhaltenen Zugriff älterer Organisationsversionen ausführen. Keine Altbestandsmigration oder Datenlöschung durchführen.
- [ ] 5.3 Kleinste betroffene Unit-/Type-Gates über Nx ausführen, bei Auth-/SDK-Serveränderungen zusätzlich `pnpm check:server-runtime`; Browsernavigation, Fokus und Leave-Guard gezielt prüfen.
- [ ] 5.4 arc42 03/05/06/08/11/12 aktualisieren, IAM-Pattern-Auswirkungen auf 04/09 prüfen; Datenbankschema nur bei tatsächlich erforderlicher Änderung ergänzen. Bestehenden Rollout-Prozess beibehalten.
- [ ] 5.5 OpenSpec strikt validieren und vor Abschluss Nachweise für die kritischen Invarianten am finalen HEAD prüfen; Freigabe für Implementierung und spätere Bereitstellung getrennt ausweisen.
