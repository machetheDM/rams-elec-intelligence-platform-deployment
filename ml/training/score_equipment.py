"""
Rams @Elec — Equipment Risk Scorer (Module 10, Part E)

Loads the trained failure-recurrence model and scores all equipment,
writing risk_score and risk_scored_at back to the equipment table.

Only runs if a trained model exists (recurrence_model.json).

Run:
  py -3.14 ml/training/score_equipment.py            # local
  python ml/training/score_equipment.py               # Docker
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path

import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("equipment-scorer")

MODEL_DIR = Path(__file__).parent / "artifacts"
MODEL_PATH = MODEL_DIR / "recurrence_model.json"
METRICS_PATH = MODEL_DIR / "recurrence_metrics.json"

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/rams_elec",
)

URGENCY_MAP = {"low": 0, "medium": 1, "high": 2, "emergency": 3}


def score_all_equipment():
    """Score every piece of equipment using the latest completed job context."""
    if not MODEL_PATH.exists():
        logger.warning(
            f"No trained model at {MODEL_PATH} — run train_recurrence.py first"
        )
        return

    # Load metrics to get feature names
    metrics = json.loads(METRICS_PATH.read_text())
    if not metrics.get("trained"):
        logger.warning("Model was not successfully trained — skipping scoring")
        return

    feature_importance = metrics.get("feature_importance", {})
    feature_names = list(feature_importance.keys())
    if not feature_names:
        logger.error("No feature names in metrics — cannot score")
        return

    from xgboost import XGBClassifier

    model = XGBClassifier()
    model.load_model(str(MODEL_PATH))

    from sqlalchemy import create_engine, text
    import pandas as pd

    engine = create_engine(DATABASE_URL)

    # Get latest completed job per equipment
    query = text("""
        SELECT DISTINCT ON (e.id)
            e.id AS equipment_id,
            j.urgency,
            j.area_zone,
            j.actual_cost,
            st.category AS service_category,
            e.type AS equipment_type,
            EXTRACT(YEAR FROM AGE(NOW(), e.install_date)) AS equipment_age_years,
            j.technician_id
        FROM equipment e
        JOIN jobs j ON j.equipment_id = e.id AND j.status = 'complete'
        JOIN service_types st ON j.service_type_id = st.id
        ORDER BY e.id, j.completed_date DESC NULLS LAST
    """)

    with engine.connect() as conn:
        rows = conn.execute(query).mappings().all()

    if not rows:
        logger.info("No equipment with completed jobs — nothing to score")
        return

    df = pd.DataFrame(rows)
    equipment_ids = df["equipment_id"].values

    # Build feature matrix matching training features
    df["urgency_ord"] = df["urgency"].map(URGENCY_MAP).fillna(1)
    df["actual_cost"] = df["actual_cost"].fillna(0).astype(float)
    df["days_since_completion"] = 7  # default assumption for scoring
    df["equipment_age_years"] = df["equipment_age_years"].fillna(0).astype(float)

    cat_cols = ["service_category", "area_zone", "equipment_type"]
    for col in cat_cols:
        df[col] = df[col].fillna("unknown")

    dummies = pd.get_dummies(df[cat_cols], prefix=cat_cols, drop_first=True)
    numeric = df[
        ["urgency_ord", "actual_cost", "days_since_completion", "equipment_age_years"]
    ]
    X = pd.concat([numeric, dummies], axis=1)

    # Align columns to training features
    for col in feature_names:
        if col not in X.columns:
            X[col] = 0
    X = X[feature_names]

    risk_scores = model.predict_proba(X.values.astype(float))[:, 1]

    # Write back
    now = datetime.now()
    update_query = text("""
        UPDATE equipment
        SET risk_score = :score, risk_scored_at = :scored_at
        WHERE id = :equipment_id
    """)

    with engine.begin() as conn:
        for eid, score in zip(equipment_ids, risk_scores):
            conn.execute(
                update_query,
                {
                    "equipment_id": eid,
                    "score": float(np.round(score, 4)),
                    "scored_at": now,
                },
            )

    logger.info(f"Scored {len(equipment_ids)} equipment records")
    logger.info(f"Risk score range: {risk_scores.min():.4f} – {risk_scores.max():.4f}")
    logger.info(f"Mean risk score: {risk_scores.mean():.4f}")


if __name__ == "__main__":
    score_all_equipment()
