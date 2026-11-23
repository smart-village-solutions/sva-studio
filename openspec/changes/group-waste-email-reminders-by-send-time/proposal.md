# Änderung: Abfuhrerinnerungen bei gleichem Zustellzeitpunkt bündeln

## Why

Wer am selben Abholtag mehrere Abfallarten mit demselben Zustellzeitpunkt abonniert hat, erhält derzeit mehrere E-Mails. Bei gleichem Standardbetreff kann die erste E-Mail wie eine überholte Nachricht wirken. Der JF hat für dieses Zeitfenster eine gemeinsame Nachricht beschlossen, die alle zugehörigen Abholungen nennt.

## What Changes

- Die vorhandene Berechnung der Abhol- und Versandzeitpunkte liefert die fachlichen Mitglieder einer Nachricht. Der Planer bündelt sie nach Abo, wirksamem Abholdatum und ursprünglich berechnetem Versandzeitpunkt.
- Die E-Mail und die bestehende Versandübersicht zeigen sämtliche betroffenen Fraktionen. Die Nachricht führt die Hinweise bei der jeweils zugehörigen Fraktion und enthält den vorhandenen Abmeldelink.
- Beim Übergang berücksichtigt der Planer bereits versandte und beanspruchte Einzelaufträge. Der bestehende Dispatcher liest beide gespeicherten Auftragsformen.

## Impact

- Betroffen ist der Versandvertrag in `public-waste-calendar`. Der Versandpfad nutzt weiterhin die bestehende Waste-Outbox und die zentrale Mail-Transport-Schnittstelle. DOI-Nachrichten und Push-Nachrichten folgen ihren eigenen bestehenden Aufträgen.
- Betroffen sind Waste-Runtime, E-Mail-Vorlagen, Auftragsabgleich und die Zustellhistorie im bestehenden Monitoring. Architekturbezug sind [Bausteinsicht](../../../docs/architecture/05-building-block-view.md), [Laufzeitsicht](../../../docs/architecture/06-runtime-view.md) und [Querschnittskonzepte](../../../docs/architecture/08-cross-cutting-concepts.md).

## Freigabeentscheidung

Die lokale Implementierung wurde am 23. November 2026 freigegeben. Nachträge nach Beginn des Versands lösen keine automatische zweite E-Mail aus.

Wenn nach dem Beginn eines Versandversuchs unklar ist, ob der Versanddienst die E-Mail angenommen hat, bleiben ihre Abholungen für den automatischen Versand reserviert. Der Status muss im Monitoring als ungeklärt erkennbar sein. Eine erneute Übergabe braucht einen verifizierten Nichtannahmenachweis oder eine ausdrückliche Entscheidung für den Einzelfall. Der Betrieb soll vor der Implementierung die Zuständigkeit und den Umgang mit solchen Fällen bestätigen.
