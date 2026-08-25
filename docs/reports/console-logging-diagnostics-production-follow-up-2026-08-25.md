# Production-Nachprüfung der Logging-Diagnostik am 25. August 2026

## Rollout-Zuordnung

Der aktuelle Production-Promote-Run `32780430715` lief erfolgreich für Revision `39206ba4cc3a9d735d604f744ec00b015a6811ec` und Digest `sha256:42c6513675373387b6715b043b9c03bc96b5ef3a83fd751591f7f02ab86ea523`. Die Revision enthält den Merge-Commit `99cf66c25edc1363b20ae73c0e59a4f36eb1f953` des Changes `harden-console-logging-diagnostics` nachweislich in ihrer Git-Ancestry.

## Auswertung des aktiven Transports

Die Loki-Auswertung betrachtete das Production-Fenster vom 24. August 2026, 15:00 UTC, bis zum 25. August 2026, 15:00 UTC. In diesem Fenster lagen 29.245 Ereignisse für `studio_app`. Von den als JSON auswertbaren Leveln entfielen 26.716 auf `debug`, 1.497 auf `info`, 899 auf `warn` und 58 auf `error`; 70 Zeilen meldeten einen JSON-Parserfehler und werden nicht als strukturierter Vertragsnachweis gewertet.

Die zuvor inventarisierten hochvolumigen Erfolgsmeldungen für Credential-/Token-Cache, Routing-Dispatch, Konfigurationsladen und Projektionsseiten erschienen jeweils nullmal auf `info`. Die Auth-Fehlergrenze erzeugte 57-mal das kanonische Ereignis `Auth route failed during tenant auth resolution`; keine Request-ID erschien dabei mehrfach und das frühere innere Ereignis `tenant_auth_resolution_failed` erschien nullmal. Für `tenant_auth_callback_result` wurden 18 korrelierte Ereignisse und kein altes `Auth callback failed` gefunden. Audit- und Mutationssignale blieben vorhanden.

Die Redaction-Prüfung exportierte keine Rohwerte. Alle 402 Vorkommen des Feldnamens `projection_scope_key` wurden in der Stichprobe ausschließlich mit `[REDACTED]` beobachtet. Die Canary-Unit-Tests für Server- und Browser-/OTEL-Redaction sind grün. Vorhandene Trace-IDs waren nicht zu beanstanden; im Fenster war für die geprüften HTTP-Ereignisse keine Trace-ID gesetzt, was dem optionalen Trace-Vertrag entspricht.

## Gefundener Blocker

Die zwei strukturierten HTTP-Erfolgsmeldungen mit `method` gehörten zu `mainserver_poi_update` und enthielten weder `request_id` noch `trace_id`. Damit ist der Production-Vertrag aus Task 6.7 nicht erfüllt.

Ein Reproduktionstest mit zwei getrennt evaluierten Kopien von `@sva/server-runtime` zeigte die Ursache: Jede Modulkopie besaß zuvor einen eigenen modul-lokalen `AsyncLocalStorage`. Der Server-Entry setzte den Kontext dadurch in einem anderen Carrier als der Mainserver-Logger ihn las. Der Carrier wird nun über einen versionierten, pro Node-Prozess gemeinsamen `Symbol.for(...)`-Schlüssel geteilt. Der neue Test schlägt vor dem Fix fehl und ist danach zusammen mit Type- und Server-Runtime-Gate grün.

## Abschlussgrenze

Der betroffene Delivery-Slice wird nicht weiter aktiviert oder archiviert. Die Korrektur muss zuerst gemergt und über den kanonischen Rollout nach Production gelangen. Danach ist dieselbe Abfrageklasse erneut auszuwerten. Task 6.7 und der daran gebundene Abschluss bleiben bis zu diesem Live-Nachweis offen; ein pauschales Zurückrollen der bereits wirksamen Redaction- und Severity-Härtung wäre gegenüber dem isolierten Korrelationsfix unverhältnismäßig und ist nicht erfolgt.
