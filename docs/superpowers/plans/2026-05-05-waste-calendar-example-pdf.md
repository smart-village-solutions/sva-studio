# Waste Calendar Example PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein generatornahes Beispiel-PDF fuer einen kommunalen Abfallkalender mit zwei Seiten, Platzhalterdaten und referenznaher Layoutwirkung erzeugen.

**Architecture:** Die Umsetzung bleibt repo-lokal als kleiner TypeScript-Generator unter `scripts/ops/`. Die Fachdaten fuer Monate, Fraktionen, Feiertage und Zusatzinfos werden deterministisch aus einer separaten Modellschicht erzeugt und anschliessend in eine kleine PDF-Schreibschicht gerendert, damit Datenlogik und Layoutlogik getrennt bleiben.

**Tech Stack:** TypeScript strict mode, Node.js, `node:test`, `node:assert/strict`, `tsx`, `pdftoppm` fuer visuelle QA

---

### Task 1: Dateimodell und Testgeruest anlegen

**Files:**
- Create: `scripts/ops/waste-calendar-example-pdf.test.ts`
- Create: `scripts/ops/waste-calendar-example-pdf.ts`
- Modify: `docs/superpowers/plans/2026-05-05-waste-calendar-example-pdf.md`

- [ ] **Step 1: Failing Tests fuer das Datenmodell schreiben**

```ts
test('buildWasteCalendarDocument returns exactly two half-year pages', () => {
  const document = buildWasteCalendarDocument();

  assert.equal(document.pages.length, 2);
  assert.deepEqual(
    document.pages.map((page) => page.months.map((month) => month.month)),
    [
      [1, 2, 3, 4, 5, 6],
      [7, 8, 9, 10, 11, 12],
    ]
  );
});
```

- [ ] **Step 2: Failing Tests fuer PDF-Erzeugung schreiben**

```ts
test('renderWasteCalendarPdf returns a valid two-page PDF buffer', () => {
  const pdf = renderWasteCalendarPdf(buildWasteCalendarDocument());

  assert.match(pdf.toString('latin1', 0, 8), /^%PDF-1\\./);
  assert.equal((pdf.toString('latin1').match(/\\/Type \\/Page\\b/g) ?? []).length, 2);
});
```

- [ ] **Step 3: Testlauf im roten Zustand bestaetigen**

Run: `node --import tsx --test scripts/ops/waste-calendar-example-pdf.test.ts`

Expected: FAIL wegen fehlender Exporte oder fehlender Implementierung.

### Task 2: Minimalen Generator grün bekommen

**Files:**
- Modify: `scripts/ops/waste-calendar-example-pdf.ts`
- Test: `scripts/ops/waste-calendar-example-pdf.test.ts`

- [ ] **Step 1: Minimale Typen und Platzhalter-Implementierung schreiben**

```ts
export type WasteCalendarDocument = {
  readonly pages: readonly WasteCalendarPage[];
};

export function buildWasteCalendarDocument(): WasteCalendarDocument {
  return { pages: [] };
}

export function renderWasteCalendarPdf(_document: WasteCalendarDocument): Buffer {
  return Buffer.from('%PDF-1.4\\n', 'latin1');
}
```

- [ ] **Step 2: Tests laufen lassen und gezielt die naechste fachliche Luecke bestimmen**

Run: `node --import tsx --test scripts/ops/waste-calendar-example-pdf.test.ts`

Expected: FAIL mit inhaltlicher Abweichung statt Importfehler.

- [ ] **Step 3: Datenmodell fuer Kopfbereich, Monate, Legende und Zusatzinfos implementieren**

```ts
return {
  pages: [
    buildHalfYearPage(2026, [1, 2, 3, 4, 5, 6]),
    buildHalfYearPage(2026, [7, 8, 9, 10, 11, 12]),
  ],
};
```

- [ ] **Step 4: Tests erneut laufen lassen**

Run: `node --import tsx --test scripts/ops/waste-calendar-example-pdf.test.ts`

Expected: PDF-Test noch rot, Datenmodell-Test gruen.

### Task 3: PDF-Schreibschicht implementieren

**Files:**
- Modify: `scripts/ops/waste-calendar-example-pdf.ts`
- Test: `scripts/ops/waste-calendar-example-pdf.test.ts`

- [ ] **Step 1: Kleine PDF-Helfer fuer Text, Linien und Flaechen implementieren**

```ts
type PdfPageCommand = string;

function drawText(commandList: PdfPageCommand[], x: number, y: number, size: number, text: string): void {
  commandList.push(`BT /F1 ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`);
}
```

- [ ] **Step 2: Referenznahes Layout fuer beide Halbjahresseiten rendern**

```ts
for (const page of document.pages) {
  renderHeader(commands, page);
  renderMonths(commands, page);
  renderFooter(commands, page);
}
```

- [ ] **Step 3: Tests im grünen Zustand bestaetigen**

Run: `node --import tsx --test scripts/ops/waste-calendar-example-pdf.test.ts`

Expected: PASS

### Task 4: Dateiausgabe und Artefaktpfad

**Files:**
- Modify: `scripts/ops/waste-calendar-example-pdf.ts`
- Create: `output/pdf/waste-calendar-example-2026.pdf`

- [ ] **Step 1: CLI-Einstieg fuer Dateischreiben ergaenzen**

```ts
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  writeWasteCalendarExamplePdf();
}
```

- [ ] **Step 2: Generator ausfuehren**

Run: `node --import tsx scripts/ops/waste-calendar-example-pdf.ts`

Expected: Datei `output/pdf/waste-calendar-example-2026.pdf` wird erzeugt.

- [ ] **Step 3: Testlauf erneut bestaetigen**

Run: `node --import tsx --test scripts/ops/waste-calendar-example-pdf.test.ts`

Expected: PASS

### Task 5: Verifikation und visuelle QA

**Files:**
- Verify: `output/pdf/waste-calendar-example-2026.pdf`

- [ ] **Step 1: PDF nach PNG rendern**

Run: `mkdir -p tmp/pdfs/waste-calendar-example && pdftoppm -png output/pdf/waste-calendar-example-2026.pdf tmp/pdfs/waste-calendar-example/page`

Expected: `page-1.png` und `page-2.png`

- [ ] **Step 2: Sichtpruefung durchfuehren**

Pruefen:
- zwei Seiten vorhanden
- sechs Monatsbloecke pro Seite
- graue Platzhalterflaechen sichtbar
- Legende und Zusatzinfos unterhalb des Kalenders
- keine abgeschnittenen Texte oder ueberschriebenen Inhalte

- [ ] **Step 3: Repo-Checks fuer geaenderte Artefakte laufen lassen**

Run:
- `pnpm check:file-placement`
- `node --import tsx --test scripts/ops/waste-calendar-example-pdf.test.ts`

Expected: PASS
