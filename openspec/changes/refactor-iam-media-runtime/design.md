## Context

`iam-media/core.ts` enthält die öffentlichen Handler der Medienruntime, wiederholte HTTP-Abläufe und mehrere fachlich unabhängige Flows. Die Medienliste verbindet registrierte DB-Assets mit nicht registrierten Objekten aus einem extern pro Tenant isolierten S3-Bucket. Uploads erzeugen Varianten synchron.

## Goals / Non-Goals

- Goals: kleinere fachliche Module, weniger Duplikate, echte Cursor-Paginierung, kurze DB-Transaktionen und race-sichere Upload-Finalisierung
- Non-Goals: asynchrone Verarbeitung, automatische Recovery, Governance-Erweiterungen, neue Medientypen oder ein allgemeines HTTP-Framework

## Decisions

- `core.ts` bleibt öffentliche Fassade; Handler werden nach Bibliothek/Assets, Uploads, Content-Speicheroperationen und Referenzen gruppiert.
- Gemeinsame Request-Helfer bleiben konkret auf IAM-Medien zugeschnitten.
- Der Cursor ist versioniert, Base64url-kodiert und bindet letzten Storage-Key sowie normalisierte Filter. DB und S3 verwenden dieselbe binäre S3-Reihenfolge und lesen jeweils strikt nach diesem Key. Bei begrenzten Quellseiten wird nur bis zum kleineren sicher gelesenen Scan-Stand ausgegeben und der Cursor nach vollständiger Ausgabe dieses Bereichs bis dorthin vorgeschoben; registrierte Assets gewinnen bei der Deduplizierung.
- Die Sortierung wechselt bewusst von einer globalen Zeit- zu einer aufsteigenden Storage-Key-Reihenfolge. Unregistrierte Bucket-Suche verwendet ein S3-Präfix; registrierte Assets behalten die Metadatensuche.
- Der erlaubte Statusübergang `pending -> uploaded` dient als atomarer Claim und erzeugt ein eindeutiges Fencing-Token. Die Session-Laufzeit begrenzt diesen ersten Claim. Frische Claims bleiben exklusiv; ein seit zehn Minuten unveränderter `uploaded`-Claim darf unabhängig von der inzwischen abgelaufenen Upload-URL durch einen späteren Abschlussaufruf mit neuem Token atomar übernommen werden. Varianten werden unter claim-isolierten Storage-Keys erzeugt und erst durch die token-geschützte Finalisierung veröffentlicht. Ein abgelöster Verarbeiter entfernt ausschließlich seine eigenen unveröffentlichten Varianten. Bereits validierte Abschlüsse bleiben idempotent.
- S3-Lesen, Inhaltsprüfung, Sharp-Verarbeitung und S3-Schreiben laufen ohne offene DB-Transaktion. Teilweise Schreibfehler entfernen claim-isolierte Varianten, lassen den Upload-Claim aber für die zeitgesteuerte Recovery reclaimbar. Eine kurze Finalisierungstransaktion prüft die tatsächliche Quote und persistiert alle DB-Änderungen gemeinsam; bei provisorischen Assets sperrt sie zusätzlich die Content-Speicheroperation und akzeptiert nur offene Upload-Phasen.
- Für die Quotenprüfung wird keine Reservierung angelegt. Bei Ablehnung werden Original und erzeugte Varianten kompensierend entfernt.

## Risks / Trade-offs

- Die Medienliste liefert keine exakte Gesamtzahl mehr und sortiert nicht mehr global nach Aktualität. Dafür ist ihre Laufzeit nicht länger an die Gesamtgröße des Buckets gekoppelt.
- Die Übernahme eines abgelaufenen Claims erfolgt lazy durch einen erneuten Abschlussaufruf. Damit bleibt kein zusätzlicher Recovery-Worker zu betreiben; bis zum Ablauf der zehnminütigen Lease erhält ein paralleler Request weiterhin einen Konflikt.
- Kompensierendes S3-Cleanup ist nicht transaktional. Fehler werden deshalb sichtbar protokolliert und nicht als erfolgreicher Abschluss ausgegeben.

## Migration Plan

Server und Studio-Frontend werden im selben Runtime-Artefakt gemeinsam umgestellt. Alte Listenparameter werden nach dem Rollout explizit abgelehnt; Datenbank- oder Bestandsdatenmigrationen sind nicht erforderlich.

## Open Questions

Keine.
