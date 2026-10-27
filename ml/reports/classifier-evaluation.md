# Material classifier evaluation

- **Model:** `artifacts/classifier.onnx`
- **SHA-256:** `f7573f1d68dd661669046a0d0cc355adafafa7b58542a8dfdd2a5ccfed4a7c30`
- **Runtime:** ONNX Runtime CPU; OWI API image preprocessing (224 × 224 RGB, ImageNet normalization)
- **Evaluation data:** frozen 15% golden split from `datasets/merged` (4103 images)
- **Split:** same filename-hash split used by training; these images are excluded from training
- **Sources:** gdv2 (CC BY 4.0), trashnet (MIT)
- **Scope note:** these are licensed public-dataset photos, not a local OWI field/pilot sample; results may not represent local waste streams.

## Overall results

| Images | Accuracy | Macro-F1 | Release gate (macro-F1 ≥ 0.80) |
|---:|---:|---:|:---:|
| 4103 | 0.9637 | 0.9502 | PASS |

## Priority: `other_mixed`

- Precision **0.7143**, recall **0.9554**, F1 **0.8174** (support: 157).
- Missed `other_mixed` cases (recall): `plastic` (3), `paper` (2), `e_waste` (1), `metal` (1).
- False positives (precision): `paper` (33), `plastic` (23), `metal` (2), `textile` (2).

## Per-class metrics

| Actual class | Precision | Recall | F1 | Support |
|---|---:|---:|---:|---:|
| `other_mixed` | 0.7143 | 0.9554 | 0.8174 | 157 |
| `e_waste` | 0.9720 | 1.0000 | 0.9858 | 243 |
| `glass` | 0.9725 | 0.9532 | 0.9628 | 556 |
| `metal` | 0.9377 | 0.9723 | 0.9547 | 325 |
| `organic` | 0.9853 | 1.0000 | 0.9926 | 268 |
| `paper` | 0.9933 | 0.9399 | 0.9659 | 949 |
| `plastic` | 0.9347 | 0.9189 | 0.9267 | 530 |
| `textile` | 0.9981 | 0.9935 | 0.9958 | 1075 |

## Confusion matrix

Rows are actual labels; columns are ONNX predictions. Class order prioritizes `other_mixed`.

| Actual ↓ / Predicted → | `other_mixed` | `e_waste` | `glass` | `metal` | `organic` | `paper` | `plastic` | `textile` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `other_mixed` | 150 | 1 | 0 | 1 | 0 | 2 | 3 | 0 |
| `e_waste` | 0 | 243 | 0 | 0 | 0 | 0 | 0 | 0 |
| `glass` | 0 | 0 | 530 | 7 | 0 | 0 | 19 | 0 |
| `metal` | 2 | 2 | 0 | 316 | 0 | 2 | 3 | 0 |
| `organic` | 0 | 0 | 0 | 0 | 268 | 0 | 0 | 0 |
| `paper` | 33 | 3 | 0 | 8 | 3 | 892 | 8 | 2 |
| `plastic` | 23 | 0 | 14 | 4 | 0 | 2 | 487 | 0 |
| `textile` | 2 | 1 | 1 | 1 | 1 | 0 | 1 | 1068 |

## Representative image checks

ONNX predictions below are run on held-out public waste photos. `other_mixed` is listed first; examples include missed mixed items and paper/plastic items incorrectly classified as mixed.

| Actual | Predicted | Confidence | Result | Image |
|---|---|---:|---|---|
| `other_mixed` | `paper` | 0.5393 | review | [trashnet_other_mixed_117.jpg](../datasets/merged/other_mixed/trashnet_other_mixed_117.jpg) |
| `other_mixed` | `plastic` | 0.5851 | review | [gdv2_other_mixed_545.jpg](../datasets/merged/other_mixed/gdv2_other_mixed_545.jpg) |
| `other_mixed` | `e_waste` | 0.3621 | review | [gdv2_other_mixed_826.jpg](../datasets/merged/other_mixed/gdv2_other_mixed_826.jpg) |
| `other_mixed` | `paper` | 0.4928 | review | [trashnet_other_mixed_13.jpg](../datasets/merged/other_mixed/trashnet_other_mixed_13.jpg) |
| `other_mixed` | `plastic` | 0.4498 | review | [trashnet_other_mixed_108.jpg](../datasets/merged/other_mixed/trashnet_other_mixed_108.jpg) |
| `other_mixed` | `plastic` | 0.6116 | review | [gdv2_other_mixed_82.jpg](../datasets/merged/other_mixed/gdv2_other_mixed_82.jpg) |
| `other_mixed` | `other_mixed` | 0.9219 | correct | [gdv2_other_mixed_531.jpg](../datasets/merged/other_mixed/gdv2_other_mixed_531.jpg) |
| `other_mixed` | `other_mixed` | 0.5730 | correct | [gdv2_other_mixed_159.jpg](../datasets/merged/other_mixed/gdv2_other_mixed_159.jpg) |
| `other_mixed` | `other_mixed` | 0.9768 | correct | [gdv2_other_mixed_120.jpg](../datasets/merged/other_mixed/gdv2_other_mixed_120.jpg) |
| `other_mixed` | `other_mixed` | 0.9724 | correct | [gdv2_other_mixed_1079.jpg](../datasets/merged/other_mixed/gdv2_other_mixed_1079.jpg) |
| `other_mixed` | `other_mixed` | 0.9957 | correct | [gdv2_other_mixed_333.jpg](../datasets/merged/other_mixed/gdv2_other_mixed_333.jpg) |
| `other_mixed` | `other_mixed` | 0.9266 | correct | [gdv2_other_mixed_199.jpg](../datasets/merged/other_mixed/gdv2_other_mixed_199.jpg) |
| `e_waste` | `e_waste` | 0.9646 | correct | [gdv2_e_waste_267.jpg](../datasets/merged/e_waste/gdv2_e_waste_267.jpg) |
| `glass` | `plastic` | 0.3319 | review | [gdv2_glass_2710.jpg](../datasets/merged/glass/gdv2_glass_2710.jpg) |
| `metal` | `plastic` | 0.4996 | review | [gdv2_metal_1334.jpg](../datasets/merged/metal/gdv2_metal_1334.jpg) |
| `organic` | `organic` | 0.7257 | correct | [gdv2_organic_1122.jpg](../datasets/merged/organic/gdv2_organic_1122.jpg) |
| `paper` | `other_mixed` | 0.3463 | review | [gdv2_paper_3565.jpg](../datasets/merged/paper/gdv2_paper_3565.jpg) |
| `plastic` | `other_mixed` | 0.3923 | review | [gdv2_plastic_1504.jpg](../datasets/merged/plastic/gdv2_plastic_1504.jpg) |
| `textile` | `e_waste` | 0.5348 | review | [gdv2_textile_2448.jpg](../datasets/merged/textile/gdv2_textile_2448.jpg) |
