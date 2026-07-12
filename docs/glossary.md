# Glossary

| Term | Meaning in OWI |
|---|---|
| **CBO** | Community-Based Organization — a registered local nonprofit; Safi Cleaners and Recyclers is our anchor CBO. |
| **Observation** | The atomic data record: one photo event with location, time, and context (see data model). |
| **Bin registry** | The database of all managed bins: QR code, GPS, volume, host site, reference photo. |
| **Fill band** | One of 5 fill-level categories: empty / low / half / high / overflowing. |
| **Fill tap** | The collector's one-tap manual fill estimate — both immediate data and a training label. |
| **Bin health score** | Daily per-bin composite: fill %, overflow risk, days since collection → recommendation. |
| **Collect-today list** | The dashboard's ranked list of bins recommended for collection today (M2 output, M4 input). |
| **Golden test set** | ~500 locally captured, never-trained-on images; the only accuracy benchmark that gates releases. |
| **Sorting-site ground truth** | Actual weights/materials measured when Safi sorts collected waste — used to calibrate photo-derived estimates. |
| **Shadow mode** | Running a recommendation alongside the old process without acting on it, to measure agreement before adoption. |
| **Privacy gate** | Ingestion step that detects and blurs people/faces before any image is stored. |
| **Dumping candidate / DumpingSite** | Model-flagged accumulation (candidate) vs. human-confirmed location record (site). Only sites are recorded. |
| **Cleanliness index** | 0–100 composite score per area: litter density, overflow rate, dumping, collection reliability. |
| **Value ledger** | Running log of decisions Safi made differently because of OWI — the ultimate success measure. |
| **Small-cell suppression** | Open-API rule: aggregates from < 3 bins or < 20 observations are not published. |
| **CVRP** | Capacitated Vehicle Routing Problem — the optimization formulation behind M4 routes. |
| **TACO / TrashNet / ZeroWaste** | Public waste image datasets used for pretraining (see ML strategy). |
| **COCO format** | Standard annotation format for detection datasets; our labeling exports use it. |
| **WARM** | US EPA's Waste Reduction Model — candidate source for carbon factors (M7). |
| **DPA / ODPC** | Kenya Data Protection Act (2019) / Office of the Data Protection Commissioner. |
| **Ward** | Kenyan administrative subdivision — the smallest geography exposed on the open API. |
| **KES** | Kenyan Shilling. |
| **Safi** | Swahili for "clean." |
