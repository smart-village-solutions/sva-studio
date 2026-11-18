# Change: SSF-Organisationsschlüssel und gezielte Zugangsübertragung im Studio

## Status und Umfang

Am 18. November 2026 ausdrücklich zur Implementierung freigegeben. Grundlage sind die abgestimmten Figma-Abläufe und die
Klarstellungen vom 18. November 2026: Persönliche „Zugangsschlüssel“ sind
Passphrasen. Vorhandene Daten sind entbehrliche Testdaten; eine Migration des
bisherigen Recovery-Verfahrens ist nicht erforderlich. Dieser Vorschlag löscht
keine Daten und erteilt keine Freigabe für eine Löschung oder einen Rollout.

Das bestehende SSF-Plugin bietet Aufzeichnungsrichtlinien, aber keine Verwaltung
von Organisationsschlüsseln und keine gezielte Zugangsübertragung. Die neuen
Seiten erweitern dieses Plugin für Organisationsverantwortliche; ein neues
Package oder eine zweite Verwaltung von Aufzeichnungsdaten ist nicht nötig.

Der zusätzlich genehmigte SSF-Change `remove-sensitive-action-reauthentication` ersetzt die frühere Forderung nach aktionsbezogener MFA. Eine gültige Mandantensitzung genügt für berechtigte Aktionen.

## Why

Organisationsverantwortliche sollen den Organisationsschlüssel selbst verwahren
und damit gezielt Zugänge zu Aufzeichnungen wiederherstellen oder übertragen.
Die bisherigen Schlüsselanteile und Freigabezeremonien entsprechen diesem
Zielbild nicht. Studio stellt die Verwaltung bereit, während das SSF-Gateway die
verbindlichen Schlüsselversionen, Aufzeichnungen und Zugangsrechte verwaltet.

## What Changes

- Zwei mandantengebundene Seiten unter Smart Speech Flow: Organisationsschlüssel
  und Zugänge verwalten; bestehende Studio-Komponenten und Navigation verwenden.
- Organisationsschlüssel im Browser erzeugen, sichern und erst nach bestätigter
  Sicherung aktivieren; beim Ersetzen gelten neue Schlüssel nur für neue
  Aufzeichnungen. Private Schlüssel werden niemals an einen Server übertragen.
- Ausgewählte Aufzeichnungen für eine ausdrücklich bestätigte Zielperson lokal
  umschlüsseln, ohne Gesprächsinhalte zu laden oder anzuzeigen.
- Die explizite Berechtigung `ssf.recording.access.transfer` einführen; reine
  Organisationsadministration gewährt sie nicht automatisch.
- Einen serverseitigen Gateway-Client mit einem per Token Exchange erhaltenen
  Benutzer-Token integrieren. Das Gateway prüft die gültige Sitzung und die aktuelle Berechtigung.
  Die MFA-Richtlinie gilt beim Mandantenlogin.
- Die bestehende persönliche Passphrase und `recording.passphraseFileEnabled`
  unverändert weiterverwenden. Keine persönliche Private-Key-Importfunktion.

## Impact

- Affected specs: `ssf-organisation-key-management` (neue Plugin-Fähigkeit).
- Affected code: `packages/plugin-ssf` (Navigation, Seiten, lokale Kryptografie,
  DTOs, Gateway-Client, Serverhandler, Übersetzungen), gezielte Host-Capability in
  `packages/auth-runtime` und `packages/plugin-sdk`, bestehende Keycloak-
  Client-Provisionierung und Tests.
- Affected arc42 sections: 03 Kontext, 05 Bausteine, 06 Laufzeit, 08 Security,
  11 Risiken und 12 Glossar; bei erweitertem IAM-Pattern zusätzlich 04/09 prüfen.
- Abhängigkeit: SSF-Vorschlag `update-recording-key-lifecycle` definiert den
  verbindlichen Gateway-Vertrag. Beide Vorschläge gemeinsam prüfen.
- Kein neuer Studio-Datenspeicher für Organisationsschlüssel oder Aufzeichnungen;
  keine Migration alter Recovery-Daten, keine Änderung gewöhnlicher Gespräche,
  keine Übernahme der SSF-Gesprächs- oder Prüfungsoberfläche ins Studio.

## Review-Punkte

- Gateway besitzt Schlüsselversionen und Zugangsentscheidungen; Studio besitzt
  weder eine konkurrierende aktive Version noch private Schlüssel.
- Token Exchange muss das ursprüngliche Benutzer-Subjekt und die ursprüngliche
  Anmeldezeit erhalten, sofern diese im Session-Token vorhanden ist.
- Zugangsübertragung benötigt eine explizite Berechtigung und bestätigt den
  genauen Umfang sowie die tatsächliche Zielschlüsselversion.
