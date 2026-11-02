# Live test — driver-list-hide-zeros (2026-11-02)

- PR #81 merged → main `02a0930`; Vercel production deploy `dpl_GdJ39EGjwCqdb6XYxBkEUpHeKjbz`.
- Prod bundle changed `index-DW0fx_cW.js` → `index-BEaZQuai.js`; it contains the fix:
  `qtyByLocation.map(v=>({text:v>0?String(v):"",...}))`.
- The agent could not click through prod: the Manager screen is behind the manager token, and the
  agent does not enter tokens on prod.
- Local reproduction (not a prod capture): the same source as main (`02a0930`) rendered the driver
  PDF with pdfmake from a fixture whose values were copied by hand from the operator's 2.11
  Warszawa batch PDF. Location cells with 0 came out blank and Razem matched the old PDF. The
  second bar read "SUP_MORY" only because the fixture had no supplier name. The rendered PDF is
  not committed — the repo is public and it carried real batch quantities.
- Prod evidence is the operator's confirmation alone: on 2026-11-02 the driver list downloaded
  from prod without zeros ("działa poprawnie").
