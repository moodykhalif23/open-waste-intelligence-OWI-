CLASSES = [
    ("plastic", "#2563eb"),
    ("glass", "#0891b2"),
    ("metal", "#64748b"),
    ("paper", "#d97706"),
    ("organic", "#15803d"),
    ("e_waste", "#7c3aed"),
    ("textile", "#db2777"),
    ("other_mixed", "#78716c"),
]

PROJECT_TITLE = "OWI Waste Detection"


def label_config() -> str:
    labels = "\n".join(
        f'    <Label value="{name}" background="{color}"/>' for name, color in CLASSES
    )
    return f"""<View>
  <Image name="image" value="$image" zoom="true"/>
  <RectangleLabels name="waste" toName="image">
{labels}
  </RectangleLabels>
</View>"""
