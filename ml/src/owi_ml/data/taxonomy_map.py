OWI_CLASSES = [
    "plastic",
    "glass",
    "metal",
    "paper",
    "organic",
    "e_waste",
    "textile",
    "other_mixed",
]

# Public-dataset category names (TACO, TrashNet, Roboflow) → OWI top-level class.
# Public data pretrains generic material appearance; the local set fine-tunes the rest.
_SOURCE_TO_OWI = {
    # plastic
    "bottle": "plastic",
    "plastic bottle": "plastic",
    "pet bottle": "plastic",
    "plastic bag & wrapper": "plastic",
    "plastic film": "plastic",
    "other plastic": "plastic",
    "plastic": "plastic",
    "plastic container": "plastic",
    "styrofoam piece": "plastic",
    # glass
    "glass bottle": "glass",
    "glass jar": "glass",
    "broken glass": "glass",
    "glass": "glass",
    # metal
    "can": "metal",
    "aluminium foil": "metal",
    "metal": "metal",
    "pop tab": "metal",
    "aluminium can": "metal",
    "steel can": "metal",
    "scrap metal": "metal",
    # paper
    "paper": "paper",
    "cardboard": "paper",
    "carton": "paper",
    "paper cup": "paper",
    "tetra pak": "paper",
    "magazine paper": "paper",
    # organic
    "food waste": "organic",
    "organic": "organic",
    "food": "organic",
    "garden": "organic",
    # e-waste
    "e-waste": "e_waste",
    "battery": "e_waste",
    "electronics": "e_waste",
    # textile
    "textile": "textile",
    "cloth": "textile",
    "clothing": "textile",
    "trash": "other_mixed",
    "litter": "other_mixed",
    "unlabeled litter": "other_mixed",
}


def map_category(source_name: str) -> str:
    """Fold a source dataset's category into the OWI 8-class taxonomy; unknowns → other_mixed."""
    return _SOURCE_TO_OWI.get(source_name.strip().lower(), "other_mixed")
