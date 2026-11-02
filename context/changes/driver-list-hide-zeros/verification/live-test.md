# Live test — driver-list-hide-zeros (2026-11-02)

- PR #81 merged → main `02a0930`; Vercel production deploy `dpl_GdJ39EGjwCqdb6XYxBkEUpHeKjbz`.
- Prod bundle changed `index-DW0fx_cW.js` → `index-BEaZQuai.js`; it contains the fix:
  `qtyByLocation.map(v=>({text:v>0?String(v):"",...}))`.
- The agent could not click through prod: the Manager screen is behind the manager token, and the
  agent does not enter tokens on prod.
- Rendered PDF: the same source as main (`02a0930`) generated the driver PDF with pdfmake from the
  data of the 2.11 Warszawa batch (TRN-20261102-PAGO-5723b0, values copied from the operator's
  PDF) → `driver-pdf-after.pdf`. Location cells with 0 are blank; Razem matches the old PDF
  (5, 7, 24, 5, 13 / 2, 3, 6, 3, 2, 6, 2, 1).
  The second bar reads "SUP_MORY" only because the fixture had no supplier name.
- Operator confirmed on prod 2026-11-02: driver list downloads without zeros ("działa poprawnie").
