# Report sample analysis — additive tile calibration

## Evidence and scope

The private API handoff contains 30 local images and 30 manifest records. All 30 SHA-256 hashes match their files; content hashes and source identities are each unique, and report lists agree. Hash uniqueness does not prove different photographed sheets: no complete independent visual duplicate audit was performed. The handoff reports no confirmed visual duplicates. This is a selected, non-random sample from 10 locations, with photo posting dates 2026-01-04 through 2026-11-03; posting dates do not establish paper business dates or years. Images, identities and cell-level observations stay outside Git.

The 632 extracted cells comprise 617 daily and 15 SUMA cells. No duplicate report/product/column/role keys were found. SUMA is excluded from all daily metrics: it can repeat daily quantities and its completeness is unknown. Null is not zero. No missing cell is imputed. Readable daily totals are not individual loss events. The extraction is preliminary, and representative inspection is not full transcription validation.

Four representative source images were visually inspected. Two clearly show 1/2 and 3/4 avocado, and another shows 1/3. The last is preserved as an original fraction, not an exact finite decimal: the proposed 3-decimal canonical representation cannot express it exactly and its entry needs explicit operator handling. For falafel, one form uses bare 1 while another uses bare 1 and 2 in a kg-labelled row; a label alone does not establish whether the writer meant kg or pieces. All nine handoff falafel entries attributed as kg and at least 1 are conservatively excluded, as are unit-unknown cells; no package-weight or piece conversion is assumed. Halloumi grams and very small alleged piece quantities are likewise excluded rather than converted. Other errors or unit ambiguities may remain. The private handoff was not modified.

## Recommendations and recomputation

`calibrated-catalog.json` is the sanitized implementation catalog, with paper kg stored as kg and presented in g; paper pieces remain szt. Each tap adds, including repeated and mixed tiles. Manual entry remains necessary. `supported` means at least five independent reports with eligible daily values, not proof of optimal presets or production accuracy; fewer than five is `provisional` / uncalibrated. Uniform 50/100/250 g prioritizes simple repeated additions over selecting only the most common daily totals. Piece values are tailored for observed fractions; these are starting choices, not estimates of individual loss events. Boxes remain deferred.

Of 617 daily cells, 527 are eligible and 90 excluded for unreadability, incompatible/unknown unit, nonpositive value, or the explicit ambiguities above. Only exact quantities with a compatible unit are compared. Kilograms are multiplied by 1000 exactly; a piece remains a piece. Exact reachability uses unlimited repeated and mixed additions and minimum tap count; values not representable by the tiles are unreachable. A fraction such as 1/3 is not rounded to claim reachability. The counts below show independent reports, daily observations, exact one tap, exact at most two, exact at most three, and exact reachable at any number of taps. Maximum is the greatest minimum tap count among reachable observations; manual entry may be more practical for large values.

| Product ID | Display | Additions | Reports | Daily | 1 tap | ≤2 | ≤3 | Reachable | Max taps | Status |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| avocado | szt | 0.25/0.5/1 | 12 | 15 | 9 | 14 | 14 | 14 | 2 | cautious |
| tomato | g | 50/100/250 | 17 | 33 | 12 | 24 | 30 | 32 | 10 | cautious |
| arugula | g | 50/100/250 | 18 | 33 | 17 | 29 | 30 | 31 | 5 | cautious |
| salad_mix | g | 50/100/250 | 17 | 27 | 11 | 23 | 24 | 24 | 3 | cautious |
| feta_block | g | 50/100/250 | 2 | 2 | 0 | 0 | 0 | 1 | 18 | uncalibrated |
| halloumi_reha | szt | 1/2/5 | 8 | 11 | 9 | 11 | 11 | 11 | 2 | cautious |
| tirokafteri_8kg | g | 50/100/250 | 2 | 2 | 0 | 1 | 1 | 2 | 12 | uncalibrated |
| tzatziki_5kg | g | 50/100/250 | 2 | 3 | 1 | 1 | 1 | 1 | 1 | uncalibrated |
| falafel_1kg | g | 50/100/250 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | uncalibrated |
| fries_aviko_2_5kg | g | 50/100/250 | 29 | 117 | 44 | 91 | 105 | 105 | 3 | cautious |
| sweet_potato_fries_2_27kg | g | 50/100/250 | 20 | 53 | 27 | 42 | 42 | 44 | 4 | cautious |
| gyros | g | 50/100/250 | 21 | 62 | 8 | 36 | 43 | 45 | 8 | cautious |
| pita | szt | 0.5/1/2 | 29 | 118 | 93 | 115 | 118 | 118 | 3 | cautious |
| souvlaki_chicken | szt | 1/2/5 | 17 | 36 | 31 | 34 | 35 | 36 | 5 | cautious |
| souvlaki_pork | szt | 1/2/5 | 7 | 8 | 7 | 7 | 8 | 8 | 3 | cautious |
| chickpea_mix | g | 50/100/250 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | uncalibrated |
| barley_mix | g | 50/100/250 | 3 | 3 | 1 | 1 | 1 | 3 | 5 | uncalibrated |

Counts are recomputed from the handoff, not an independent verification of each handwritten cell. The reachability denominator is the Daily column per product, not all 30 reports. A non-reachable amount is not a zero or an error; it requires manual input. Values above three taps are retained in the any-tap column so the usability cost is visible. The 1/3 avocado is included as a readable fraction but unreachable by the chosen tiles; storage cannot preserve it exactly at 3 decimal places.

## Verification and next step

- Verified 30 files, hashes and source identity uniqueness, agreement between manifest and extraction report lists, and absence of duplicate cell keys. The primary agent additionally inspected a private contact sheet of all 30 images: the sheets contain entries and no obvious repeated document was found. This is a visual plausibility check, not a complete cell-by-cell transcription audit or proof of full source coverage.
- Recomputed all 17 product counts and exact minimum-tap coverage from 617 daily entries; kept 15 SUMA cells separate. Representative visual review covered four images, including fractional avocado and falafel ambiguity; it did not verify all 30 or every extraction.
- Next: use the sanitized catalog in the implementation, keep explicit manual entry and unit validation, and validate the interaction with operators and a real period before treating presets as established. Resolve fractional piece precision and anomalous units with operators rather than inventing conversions.
