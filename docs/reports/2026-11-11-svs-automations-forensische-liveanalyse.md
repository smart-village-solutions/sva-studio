# SVS Automations: forensische Live-Analyse

Stand: 11. November 2026, Erhebung ungefähr 15:49–15:55 Uhr Europe/Berlin.

## Ergebnis

Der frühere Payload-/MongoDB-Stack ist als kompromittiert zu behandeln. In den untersuchten Bereichen des Hosts und der 19 verbliebenen Container wurden keine weiteren belastbaren Kompromittierungsindikatoren gefunden. Das ist **kein Nachweis eines sauberen Gesamtsystems**. n8n enthält weiterhin eine bekannte kritische Sicherheitslücke; mehrere Supabase-Dienste sind direkt über öffentliche Ports erreichbar.

Es wurde lesend untersucht. Während dieser Analyse wurden keine Dienste neu gestartet, Programme aktualisiert, Logs gelöscht oder verdächtige Dateien ausgeführt. Die Untersuchung umfasst keine Offline-Datenträgerabbilder, RAM-Abbilder oder unabhängige Prüfung des Kernels und sämtlicher Images.

## 1. Kritisch: belegter Vorfall im ehemaligen Payload-/MongoDB-Stack

**Auswirkung:** Fremder Code beziehungsweise Persistenz im Payload-Container und eine offenbar gelöschte Anwendungsdatenbank sind belegt; ein Datenabfluss ist weder nachgewiesen noch ausgeschlossen.

Vor dem bereits beauftragten Entfernen der beiden Container wurden folgende Befunde erhoben:

- Ausführbare ELF-Dateien unter `/tmp/rbot`, `/tmp/rbot.x86_64`, `/app/rbot`, `/tmp/sw` und mehreren versteckten `/tmp/.svc_*`-Pfaden.
- Root-Crontab und Root-`.bashrc` des Containers referenzierten `sys-update-daemon`.
- Die Datenbank `svs-automations-data-hub` enthielt zehn leere Sammlungen, einschließlich `users`, `media` und Pipedrive-Sammlungen.
- Daneben existierte `READ__ME_TO_RECOVER_YOUR_DATA` mit einer Notiz zu Bitcoin und Datenlöschung. Deren ObjectId-Zeitstempel war `2026-02-19T18:06:33Z`; er ist kein gesicherter Angriffszeitpunkt.

Die erhaltene Konfigurationssicherung zeigt bei MongoDB keine Root-Zugangsdaten in den Initialisierungsvariablen und keinen `--auth`- oder Keyfile-Schalter. Vor dem Entfernen konnte der lokale MongoDB-Client ohne Zugangsdaten die Datenbanken und Sammlungen abfragen. Port 27017 war außerdem vom Untersuchungsrechner aus erreichbar. Das ist ein plausibler, eigenständiger Zugangsweg für die Datenbanklöschung. Ob die Löschung und der Angriff auf Payload denselben Ursprung hatten, bleibt offen.

Aus noch vorhandenen unteren Image-Layern ließ sich die frühere Payload-Version bestimmen: Next.js **15.4.4**, React **19.1.1**, Payload **3.50.0**. Next.js 15.4.4 liegt vor dem für React2Shell dokumentierten Fix 15.4.8. Für betroffene App-Router-Anwendungen ist damit ein weiterer plausibler Angriffsweg vorhanden. Die tatsächliche Ausnutzung dieses CVE wurde nicht nachgewiesen. Quelle: [Next.js-Advisory CVE-2025-66478](https://nextjs.org/blog/CVE-2025-66478).

Der entfernte Payload-Container war nicht privilegiert und hatte keine Host-/Volume-Mounts. In seiner Prozessumgebung lagen `PAYLOAD_SECRET` und `DATABASE_URI`. Ein Vergleich der nichtleeren längeren Werte mit den Umgebungsvariablen der verbleibenden Container ergab keine identischen Werte. Diese begrenzte Prüfung erfasst weder verschlüsselte n8n-Credentials noch andere Dateien oder externe Dienste.

**Status:** Die Container `payload` und `mongo` wurden vor Beginn dieser Analyse auf Nutzerauftrag entfernt. Ihre Volumes und die gespeicherte Deploymentdefinition bleiben erhalten. Die beschreibbaren Container-Layer und ihre Docker-Logs stehen für eine erneute Untersuchung nicht mehr zur Verfügung. Die betreffenden Befunde beruhen daher auf den vorherigen Live-Abfragen und der Konfigurationssicherung.

## 2. Kritisch: n8n weiterhin von einer Codeausführungslücke betroffen

**Auswirkung:** Ein authentifizierter Angreifer mit Workflow-Schreibrechten kann über präparierte Expressions Code mit den Rechten des n8n-Prozesses ausführen und dadurch potenziell auf dessen gespeicherte Zugangsdaten zugreifen.

- Laufende, aus der installierten Paketdatei gelesene Version: **1.123.9**.
- Betroffen von **CVE-2026-25049 / GHSA-6cqr-8cfr-67f8**; der Hersteller nennt für diese Lücke unter anderem 1.123.17 als gepatchte Version. Das ist keine vollständige aktuelle Upgradeempfehlung für alle inzwischen veröffentlichten Lücken.
- Der Container läuft als Benutzer `node`, ohne Privileged-Modus oder Docker-Socket.
- Ein vorhandenes Benutzerkonto; MFA laut Datenbankmetadaten deaktiviert.
- Neun Workflows, davon drei aktiv. In den gespeicherten Workflowdefinitionen keine Treffer auf die bekannten Malware-Namen, Download-in-Shell-Muster oder die geprüften Prozess-/Encoded-Execution-Muster.
- Zehn gespeicherte Credential-Einträge. Die Werte wurden nicht ausgegeben oder entschlüsselt.
- Nur 20 gespeicherte Execution-Datensätze; diese Historie ist kein vollständiger Nachweis aller vergangenen Ausführungen.
- Der beschreibbare Container-Layer enthält einen n8n-Webcache. Im persistenten n8n-Verzeichnis wurden acht Dateien geprüft; keine passenden Indikatoren und keine installierten Community-Node-Pakete im geprüften Manifest.

**Bewertung:** Sicherheitslücke bestätigt, erfolgreiche Ausnutzung oder Credential-Diebstahl nicht nachgewiesen. Quelle: [Hersteller-Advisory](https://github.com/n8n-io/n8n/security/advisories/GHSA-6cqr-8cfr-67f8).

## 3. Hoch: öffentliche Supabase-Ports umgehen die erwartete UFW-Abgrenzung

Die Ports **5432, 6543, 4000, 8000 und 8443** sind per Docker an öffentliche Interfaces gebunden und waren vom Untersuchungsrechner aus erreichbar. Der ehemalige MongoDB-Port **27017 war nach der Containerentfernung beim erneuten Drei-Sekunden-Verbindungstest nicht mehr erreichbar**.

UFW erlaubt nominell nur 22, 80 und 443. Docker-Publishing wird jedoch vor den maßgeblichen UFW-INPUT-Regeln verarbeitet; UFW allein begrenzt diese Zugriffe nicht. Das beobachtete Verhalten entspricht der [Docker-Dokumentation](https://docs.docker.com/engine/network/packet-filtering-firewalls/#docker-and-ufw).

Öffentliche Erreichbarkeit ist kein Beleg für Datenzugriff ohne Anmeldung:

- Die PostgreSQL-HBA-Regeln verlangen für die privaten Netze und die allgemeinen IPv4-/IPv6-Netze `scram-sha-256`. Loopback-TCP-Regeln erlauben `trust`; daraus folgt keine öffentliche Trust-Freigabe.
- Supabase Studio besitzt die Traefik-Middleware `studio-auth`. Ein anonymer HTTPS-Aufruf der Startseite ergab **401**.
- Portainer und n8n antworten auf ihre Startseiten mit 200. Ein ausgeliefertes Login-Frontend belegt keinen anonymen administrativen Zugriff; geschützte Daten-/Administrationsaktionen wurden nicht ausgeführt.

**Bewertung:** Unnötige beziehungsweise bisher nicht begründete Angriffsfläche; kein Nachweis einer Supabase-Kompromittierung.

## 4. Mittel: Docker-Steuerzugriff vergrößert mögliche Schadensausbreitung

Portainer und Watchtower haben einen schreibbar eingebundenen Docker-Socket. Traefik und Supabase Vector haben einen als read-only eingebundenen Socket; ein read-only Bind-Mount ist keine verlässliche Beschränkung der über einen Unix-Socket möglichen API-Operationen.

Der frühere Payload-Container besaß selbst keinen Socket-Mount. Er teilte sich jedoch das `proxy`-Netz mit mehreren Anwendungen und Verwaltungsdiensten. Ein tatsächlicher Übergang auf diese Dienste oder den Host wurde nicht festgestellt. Keiner der 19 geprüften verbleibenden Container läuft privilegiert oder im Host-PID-Modus.

## 5. Ergebnisse je System

| System | Untersuchte Evidenz | Ergebnis und Grenze |
|---|---|---|
| Ubuntu-Host | Prozesse und Executable-Pfade, ausgewählte Persistenzverzeichnisse, Startup-Dateien, Root-Schlüssel, Auth-Logs, Paketprüfsummen, Verbindungen | Keine zusätzlichen belastbaren Indikatoren; keine vollständige Rootkit-/Offline-Prüfung |
| n8n | Workflow- und Kontometadaten, Versionsdatei, persistente Dateien, Container-Layer, Logstichprobe | Keine passenden Angriffsindikatoren; kritische ungepatchte Lücke und MFA aus |
| City Apps | Container-Layer, typische Malware-Ablageorte, Prozess-/Netzwerkaufnahme, Logs | Beschreibbarer Layer ohne reguläre Dateien; keine passenden Indikatoren. Image-/Quellcodeintegrität nicht vollständig geprüft |
| DeutschlandApp | Container-Layer, Malware-Ablageorte, Verbindungen, Logstichprobe | Nur zwei reguläre Dateien im Layer; vermeintlicher Logtreffer war der User-Agent `SaaSBrowserBot` |
| Traefik | Mounts, Container-Layer, Proxy-Authentifizierungslabels, Verbindungen, Logs | Keine passenden Indikatoren; Docker-Socket vorhanden, keine Access-Logs für historische Zuordnung |
| Portainer | Container-/Mountmetadaten, Container-Layer, Verbindungen und Logs | Keine passenden Indikatoren; Verwaltungsdatenbank wurde nicht vollständig forensisch dekodiert |
| Supabase, 13 Container | Container-Layer und bekannte Ablageorte, Logstichproben, DB-Rollen/-Extensions/-Verbindungen, HBA-/Persistenzkonfiguration, Edge-Functions-Dateien | Keine zusätzlichen belastbaren Indikatoren; umfangreiche Anwendungsdaten wurden nicht inhaltlich geprüft |
| Watchtower | Container-/Mountmetadaten, Layer, Verbindungen und Logs | Keine passenden Indikatoren; Docker-Socket und Registry-Konfigurationsdatei eingebunden |

### Hostbefunde im Einzelnen

- 162 Prozesse in der ersten Momentaufnahme; kein passender verdächtiger Executable-Pfad unter anderem für `rbot`, `.svc_*`, `sys-update-daemon`, `xmrig`, `kinsing` oder `kdevtmpfsi`; keine auffälligen Executables aus `/tmp` oder `/dev/shm` in dieser Aufnahme.
- Kein passender Treffer in den geprüften Cron-/Systemd-Persistenzdateien, `/tmp`, `/var/tmp`, `/dev/shm` und `/root/.config`; kein `/etc/ld.so.preload`.
- Nur `root` mit UID 0. In der gefundenen Root-`authorized_keys` genau der bekannte lokale RSA-Schlüssel; Dateimodifikation vom 9. August 2025.
- Sechs erhaltene Auth-Logdateien ausgewertet. Die dabei erkannten 22 erfolgreichen SSH-Anmeldungen nutzten denselben bekannten RSA-Schlüssel und dieselbe Quelladresse wie die aktuelle Untersuchung. Keine weiteren erfolgreichen Anmeldungen in dieser Auswertung; fehlende oder manipulierte Historie ist damit nicht ausgeschlossen.
- Effektives SSH: Passwortanmeldung deaktiviert, Root-Zugang per Schlüssel erlaubt.
- `dpkg --verify` für OpenSSH-Client/-Server, Coreutils, Bash, Procps, Systemd, libc6 und Python-Minimal meldete nur die erwartete Änderung an `/etc/systemd/journald.conf`. Das ist ein Abgleich gegen die lokale Paketdatenbank, keine unabhängige Vertrauensbasis.
- Öffentliche Verbindungen waren in den Aufnahmen SSH, Acronis-Prozessen und eingehendem Traefik-Webverkehr zugeordnet. Die Acronis-Zieladressen wurden nicht unabhängig beim Hersteller verifiziert; eine einzelne Netzwerkaufnahme erfasst keine früheren oder kurzlebigen Verbindungen.
- Keine fehlgeschlagenen Systemd-Units; Systemzustand `running`.

### Supabasebefunde im Einzelnen

- Schreibbare Layer aller 13 Container auf reguläre Dateien und unerwartete ausführbare ELF-Dateien außerhalb üblicher Bibliotheks-/Paketpfade untersucht. Keine passenden zusätzlichen ELF-Indikatoren gefunden.
- Zwei persistente Edge-Functions-Dateien mit zusammen etwa 3 KiB auf die bekannten Indikatorbegriffe untersucht; kein Treffer.
- Supabase Studio enthält Next.js **16.0.10**. Diese Version enthält die in den herangezogenen Dezember-2025-Advisories genannten Fixes; daraus folgt keine Aussage, dass alle späteren Lücken gepatcht sind. Quellen: [React2Shell-Advisory](https://nextjs.org/blog/CVE-2025-66478), [Security Update vom 11. Dezember 2025](https://nextjs.org/blog/security-update-2025-12-11).
- Datenbanken `_supabase` und `postgres`; geprüfte Login-/Superuserrollen mit Supabase-typischen Namen. Keine fremd benannte Rolle in dieser Auswahl. Bekannte Namen können missbraucht werden; eine Rollenbaseline fehlt.
- Momentane DB-Verbindungen nur lokal oder aus privaten Netzen. Kein öffentlicher DB-Client in dieser Aufnahme; Pooler können öffentliche Clients hinter privaten Backendverbindungen verbergen.
- Keine bekannten Malware-/Temp-Pfad-Indikatoren in den geprüften Preload-/Archive-Einstellungen. Keine Tabelle `cron.job` in der geprüften Datenbank; kein Nachweis eines dortigen Cron-Jobs. Die erste Abfrage über `postgres` endete wegen eingeschränkter Metadatenrechte; HBA und Persistenzeinstellungen wurden separat als `supabase_admin` gelesen.

## 6. Beweisgrenzen und bereits erfolgte Änderungen

1. Vor dieser Analyse wurden auf Nutzerauftrag ein IONOS-Hard-Reset, eine Journalbereinigung und die Entfernung von Payload/MongoDB durchgeführt. Frühere RAM-Inhalte, gelöschte Container-Layer/-Logs und bereinigte Journale sind nicht Bestandteil dieser Untersuchung.
2. Docker-Logs wurden pro verbliebenem Container auf maximal die letzten 3 MiB begrenzt ausgewertet. Kleine Logs wurden vollständig erfasst. Keine passende Malware-Zeichenfolge bedeutet nicht, dass keine Ausnutzung vorlag.
3. Traefik hat keine konfigurierten Access-Logs. Eine lückenlose Zuordnung von HTTP-Anfragen zu den früheren Angriffen ist nicht möglich.
4. Gespeicherte Anwendungsdaten wurden aus Datenschutzgründen nur über notwendige Metadaten untersucht. Keine Mailinhalte, Credential-Werte, Zugangstokens, privaten Schlüssel oder Datenbank-Datensätze in diesem Bericht.
5. Alle Befunde stammen aus einem laufenden, möglicherweise beeinflussten System. Es fehlt ein unveränderliches Datenträgerabbild mit unabhängiger Integritätsprüfung und formaler Beweismittelkette.
6. Kein aktiver Exploit-Test, kein Schadprogrammstart und kein Malware-/Credential-Upload an externe Prüfdienste.
7. Die vorbereitete Docker-Logrotation ist noch nicht durch Container-Neuerstellung aktiviert. Während dieser Analyse wurden keine weiteren Logs entfernt. Die sieben vorbereiteten Compose-Dateien wurden gegen ihre Sicherungen geprüft: semantisch nur `logging` ergänzt.

## 7. Empfohlene nächste Schritte

1. **Evidenz vor weiteren Änderungen erhalten:** verbleibende Logs, Konfigurationen und relevante Volumes geschützt sichern; für eine vertiefte Untersuchung einen Datenträgersnapshot beziehungsweise ein Offline-Abbild und bei Bedarf flüchtige Evidenz gesondert planen. Noch keine automatischen Aufräum- oder Redeployläufe.
2. **Öffentliche Direktports begrenzen:** benötigte externe Datenbank-/API-Verbindungen ermitteln, danach Zugriff gezielt auf notwendige Quellen beziehungsweise private Netze beschränken. Keine pauschale Firewalländerung, die legitime Nutzer aussperrt.
3. **n8n absichern:** Workfloweditor-/Adminzugriff begrenzen, MFA einführen und ein Update auf einen aktuell unterstützten, gepatchten Stand einschließlich Backup, Kompatibilitätsprüfung und Funktionstest planen.
4. **Zugangsdaten risikobasiert behandeln:** frühere Payload-Secrets als exponiert behandeln und Wiederverwendung außerhalb des gelöschten Stacks klären. Für n8n-, Supabase-, Portainer- und Registry-Zugänge ist ein Abfluss derzeit nicht belegt; deren Rotation bei weiterem Verdacht oder Host-Neuaufbau kontrolliert einplanen, einschließlich abhängiger Integrationen.
5. **Neuaufbau als Wiederherstellungsoption:** für belastbares Vertrauen einen frischen Host mit geprüften Images und gezielt übernommenen Daten bevorzugen. Alte Images und persistente Konfigurationen nicht ungeprüft wieder starten; die gespeicherte Payload-Deploymentdefinition sollte nicht versehentlich erneut deployt werden.

Keiner dieser Änderungsschritte wurde im Rahmen dieses Analyseauftrags ausgeführt.
