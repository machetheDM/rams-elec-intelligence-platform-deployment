"""
Quote Estimator — Canonical Feature Encoding
=============================================
Single source of truth for the XGBoost quote estimator's feature schema.

Both training (train_model.py) and inference (main.py's _build_features)
import from here. Before this module existed, the two sites each hardcoded
their own copy of these maps — harmless only by coincidence, since a
model's category/zone encoding at training time must exactly match the
encoding used to build feature vectors at inference time, or predictions
are silently wrong (the model was never told encoding X means "electrical",
it just learned that column value X correlates with certain costs).

The ETL Gold layer (etl/transformers/gold.py) encodes these same columns
independently, by sorting whatever categories/zones happen to appear in a
given batch and enumerating them — that encoding is only ever consistent
within a single run, and MUST NOT be used to train this model; use
`encode_features` below instead, which always maps a given category to the
same integer regardless of what else is in the batch.
"""

FEATURE_COLS = [
    "service_category_encoded",
    "urgency_flag",
    "area_zone_encoded",
    "equipment_age_years",
    "month",
    "day_of_week",
    "is_weekend",
]

CATEGORY_MAP = {
    "electrical": 0, "refrigeration": 1, "emergency": 2,
    "maintenance": 3, "installation": 4, "general": 5,
}
ZONE_MAP = {
    "Sandton": 0, "Midrand": 1, "Centurion": 2, "Pretoria East": 3,
    "Soweto": 4, "Polokwane": 5, "Mokopane": 6, "Bela-Bela": 7,
}
URGENCY_HIGH_VALUES = {"emergency", "high"}


def encode_urgency_flag(urgency: str) -> int:
    return 1 if str(urgency).lower() in URGENCY_HIGH_VALUES else 0


def encode_features(df):
    """Add service_category_encoded / area_zone_encoded / urgency_flag to a
    DataFrame that already has raw `service_category`, `area_zone`,
    `urgency` columns, using the fixed maps above (not a per-batch sort).

    Returns the same DataFrame with the three encoded columns added/overwritten.
    """
    df = df.copy()
    if "service_category" in df.columns:
        df["service_category_encoded"] = df["service_category"].map(CATEGORY_MAP).fillna(5).astype(int)
    if "area_zone" in df.columns:
        df["area_zone_encoded"] = df["area_zone"].map(ZONE_MAP).fillna(0).astype(int)
    if "urgency" in df.columns:
        df["urgency_flag"] = df["urgency"].apply(encode_urgency_flag)
    return df
