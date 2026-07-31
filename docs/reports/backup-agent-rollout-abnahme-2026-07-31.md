# Abnahme des zentralen Backup-Agenten am 31. Juli 2026

## Ergebnis

Der zentrale Backup-Agent und der Promote-Ablauf sind für Staging und Production abgenommen. Beide Umgebungen verwendeten denselben App-Image-Digest:

```text
sha256:a94a6bd9dd20541272d5a9979ef8aa89cc22e09f93a174879dc64672e21a6649
```

Der [Staging-Lauf 30639872781](https://github.com/smart-village-solutions/sva-studio/actions/runs/30639872781) war vollständig grün. Der [Production-Lauf 30640984666](https://github.com/smart-village-solutions/sva-studio/actions/runs/30640984666) erzeugte und verifizierte das Backup, führte Migration und Bootstrap aus und rollte denselben Digest aus. Der Lauf endete ausschließlich beim anschließenden Tenant-Smoke-Test rot, weil `hb-meinquartier` einen HTTP-Status 500 lieferte. Diese Tenant-Ausnahme wurde für die aktuelle Abnahme ausdrücklich akzeptiert; der globale Smoke-Vertrag wurde nicht abgeschwächt.

## Production-Nachweis

- Das Swarm-Service-Update war am 31. Juli 2026 um 17:35:28 Uhr MESZ abgeschlossen.
- Nach der vollständigen Konvergenzzeit von fünf Minuten lief der erwartete Image-Digest.
- `/health/live` und `/health/ready` lieferten jeweils HTTP 200.
- Die Login-Endpunkte von `bb-bad-belzig`, `bb-guben`, `de-musterhausen` und `de-studio-sandbox` lieferten jeweils HTTP 302 und leiteten zu ihrem Keycloak-Realm um.
- `hb-meinquartier` blieb bei HTTP 500 und ist die dokumentierte, akzeptierte Ausnahme dieser Abnahme.
- Es blieben keine temporären Tenant-Reparatur- oder `pg_dump`-Diagnosedienste im Swarm zurück.

## Backup-Nachweis

Der Production-Auftrag `gha-30640984666-4` wurde am 31. Juli 2026 um 17:34:00 Uhr MESZ erfolgreich abgeschlossen.

```text
Objekt: prod/2026-07-31T15-33-57-313Z/a94a6bd9dd20541272d5a9979ef8aa89cc22e09f93a174879dc64672e21a6649/gha-30640984666-4.dump
Größe: 282547 Bytes
SHA-256: b9e8fdf41402828602e6c00ce750c35972ba8fbc67a802d605ca62804f78ce55
```

Das Ergebnisobjekt meldete `succeeded`. Ein separater S3-`HEAD` gegen MinIO bestätigte Objektgröße, ETag und Änderungszeit. Zugangsdaten oder andere Geheimnisse wurden weder ausgegeben noch in diesen Nachweis übernommen.

## Operative Korrekturen während der Abnahme

- Die Runtime-Konfiguration im GitHub-Environment `prod` wurde ohne Ausgabe von Geheimnissen normalisiert. Dadurch wird der JSON-Keyring nicht mehr mit zusätzlichen literalen Hochkommas ausgeliefert.
- Fünf vorhandene Tenant-Ciphertexte wurden über einen einmaligen Reparaturdienst verifiziert. Der Dienst überschrieb keine vorhandenen Werte und wurde anschließend entfernt.
- Der Backup-Agent war noch mit einer gelöschten Production-Overlay-Netzwerk-ID verbunden. Seine Netzwerkbindung wurde auf das aktuelle Netzwerk `studio_default` korrigiert; danach waren `pg_dump`, Upload, Download und Archivprüfung erfolgreich.
- Der zuerst ausgerollte neue App-Digest wurde nach einem fehlgeschlagenen Readiness-Smoke zunächst auf den vorherigen App-Digest zurückgerollt. Datenbankmigrationen wurden nicht zurückgerollt. Nach Korrektur und erneuter Prüfung wurde der Zieldigest kontrolliert erneut ausgerollt.

## Einordnung der Wiederherstellbarkeit

Der Nachweis bestätigt ein wiederherstellbares PostgreSQL-Custom-Dump vor den mutierenden Production-Schritten. Er ist kein vollständiger Rollback aller externen Systeme: Änderungen in Keycloak, MinIO-Objekten oder anderen angebundenen Diensten sind nicht automatisch Bestandteil dieses Datenbank-Backups.
