# Dandora image qualitative check

- **Model:** `../artifacts/classifier.onnx`
- **SHA-256:** `f7573f1d68dd661669046a0d0cc355adafafa7b58542a8dfdd2a5ccfed4a7c30`
- **Runtime:** ONNX Runtime CPU with the API's production 224 × 224 RGB ImageNet preprocessing
- **Purpose:** qualitative inference only; these scene photos have no image-level material ground truth and are not an accuracy or release-gate evaluation.
- **Sources:** Wikimedia Commons photos, licensed CC BY-SA 4.0; linked below with attribution.

The classifier was trained for material appearance in individual waste-item images.
Dump-site scenes contain many materials and are outside that image-level labeling
contract. The top class and confidence below describe only the model's output for
each whole frame; they do not establish which materials are present, their amount,
or model accuracy.

The API privacy gate was applied before inference. Its person detector did not
detect every visible person in these samples. This is a qualitative warning, not a
privacy-detector benchmark; the images were used only from temporary local files
and were not added to OWI storage or its datasets.

| Commons source | Attribution | License | Top prediction | Confidence | Next scores | Person detections / gate |
|---|---|---|---|---:|---|---|
| [A dumpsite.jpg](https://commons.wikimedia.org/wiki/File:A_dumpsite.jpg) | Jenniferteresa1999 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `other_mixed` | 0.9449 | `metal` 0.0189; `glass` 0.0118 | 0 / clean |
| [Dandora 1.jpg](https://commons.wikimedia.org/wiki/File:Dandora_1.jpg) | Falkue | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `glass` | 0.4347 | `paper` 0.2483; `other_mixed` 0.1673 | 1 / blurred |
| [Dandora 2.jpg](https://commons.wikimedia.org/wiki/File:Dandora_2.jpg) | Falkue | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `plastic` | 0.5321 | `organic` 0.2969; `glass` 0.0584 | 0 / clean |
| [Dandora 3.jpg](https://commons.wikimedia.org/wiki/File:Dandora_3.jpg) | Falkue | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `other_mixed` | 0.8201 | `plastic` 0.0746; `organic` 0.0450 | 2 / blurred |

## What this establishes

- The exported ONNX artifact loads and runs on real-world dump-site scene photos with the API preprocessing contract.
- `other_mixed` is a plausible scene-level output for two frames, but this is not evidence of its precision or recall on local items.
- In this small sample, the person detector returned no boxes for `Dandora 2.jpg` despite visible people and only partial detections in other frames. Do not treat the privacy gate as a guarantee that every person is blurred.
- Local classifier validation remains blocked until a representative, locally labeled OWI/Safi field set and active model/version provenance are available.
