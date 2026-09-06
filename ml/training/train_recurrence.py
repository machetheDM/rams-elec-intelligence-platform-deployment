"""
Rams @Elec — Failure-Recurrence Model (Module 10, Part E)

Predicts the probability that a completed job's repair will fail within N days,
using post-service follow-up outcomes as labels.

Target: FollowUp.still_working = false (binary classification)

Features (from the job + equipment + follow-up context):
  - service_category (one-hot)
  - urgency (ordinal: low=0, medium=1, high=2, emergency=3)
  - area_zone (one-hot)
  - actual_cost (float)
  - days_since_completion (int)
  - equipment_type (one-hot)
  - equipment_age_years (float, from install_date)
  - technician_id (one-hot or target-encoded if cardinality is high)

OUTPUT: equipment.risk_score (0.0–1.0), written back per-equipment after
scoring. The customer portal shows this as a maintenance urgency indicator.

TRAINING GATE: refuses to train below MIN_LABELLED_FOLLOWUPS (100) to avoid
building a model on noise. This threshold is documented in CLAUDE.md and
docs/followup-agent.md.

Run:
  py -3.14 ml/training/train_recurrence.py            # local
  python ml/training/train_recurrence.py               # Docker
"""

import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("recurrence-model")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MIN_LABELLED_FOLLOWUPS = 100
MODEL_DIR = Path(__file__).parent / "artifacts"
METRICS_PATH = MODEL_DIR / "recurrence_metrics.json"

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/rams_elec",
)

URGENCY_MAP = {"low": 0, "medium": 1, "high": 2, "emergency": 3}


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------
def load_training_data():
    """Pull labelled follow-ups with their job + equipment context."""
    from sqlalchemy import create_engine, text

    engine = create_engine(DATABASE_URL)

    query = text("""
        SELECT
            f.still_working,
            f.days_since_completion,
            j.urgency,
            j.area_zone,
            j.actual_cost,
            st.category AS service_category,
            e.type AS equipment_type,
            EXTRACT(YEAR FROM AGE(NOW(), e.install_date)) AS equipment_age_years,
            j.technician_id
        FROM follow_ups f
        JOIN jobs j ON f.job_id = j.id
        JOIN service_types st ON j.service_type_id = st.id
        LEFT JOIN equipment e ON f.equipment_id = e.id
        WHERE f.response_received = true
          AND f.still_working IS NOT NULL
    """)

    with engine.connect() as conn:
        rows = conn.execute(query).mappings().all()

    return rows


# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------
def build_features(rows):
    """Convert raw rows to X (numpy) and y (numpy) arrays."""
    import pandas as pd

    df = pd.DataFrame(rows)

    if len(df) < MIN_LABELLED_FOLLOWUPS:
        return None, None, None

    # Target: 1 = failed (still_working = false), 0 = working
    y = (~df["still_working"].astype(bool)).astype(int).values

    # Numeric features
    df["urgency_ord"] = df["urgency"].map(URGENCY_MAP).fillna(1)
    df["actual_cost"] = df["actual_cost"].fillna(0).astype(float)
    df["days_since_completion"] = df["days_since_completion"].fillna(7).astype(float)
    df["equipment_age_years"] = df["equipment_age_years"].fillna(0).astype(float)

    # One-hot categorical
    cat_cols = ["service_category", "area_zone", "equipment_type"]
    for col in cat_cols:
        df[col] = df[col].fillna("unknown")

    dummies = pd.get_dummies(df[cat_cols], prefix=cat_cols, drop_first=True)

    numeric = df[
        ["urgency_ord", "actual_cost", "days_since_completion", "equipment_age_years"]
    ]
    X = pd.concat([numeric, dummies], axis=1)

    feature_names = list(X.columns)
    return X.values.astype(float), y, feature_names


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------
def train_model(X, y, feature_names):
    """Train an XGBoost classifier with 5-fold CV."""
    from sklearn.model_selection import cross_val_score, train_test_split
    from xgboost import XGBClassifier

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    model = XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        eval_metric="logloss",
        use_label_encoder=False,
    )

    model.fit(X_train, y_train)

    # Evaluate
    from sklearn.metrics import (
        accuracy_score,
        precision_score,
        recall_score,
        f1_score,
        roc_auc_score,
    )

    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": round(accuracy_score(y_test, y_pred), 4),
        "precision": round(precision_score(y_test, y_pred, zero_division=0), 4),
        "recall": round(recall_score(y_test, y_pred, zero_division=0), 4),
        "f1": round(f1_score(y_test, y_pred, zero_division=0), 4),
        "roc_auc": (
            round(roc_auc_score(y_test, y_proba), 4)
            if len(np.unique(y_test)) > 1
            else None
        ),
    }

    # Cross-validation
    cv_scores = cross_val_score(model, X, y, cv=5, scoring="f1")
    metrics["cv_f1_mean"] = round(cv_scores.mean(), 4)
    metrics["cv_f1_std"] = round(cv_scores.std(), 4)

    # Feature importance
    importance = dict(zip(feature_names, model.feature_importances_.tolist()))

    return model, metrics, importance, len(X_train), len(X_test)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    logger.info("Loading follow-up training data...")
    rows = load_training_data()
    logger.info(f"Found {len(rows)} labelled follow-ups")

    if len(rows) < MIN_LABELLED_FOLLOWUPS:
        logger.warning(
            f"Only {len(rows)} labelled follow-ups — need {MIN_LABELLED_FOLLOWUPS}. "
            f"Model training deferred."
        )
        # Write a metrics file indicating training was skipped
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        METRICS_PATH.write_text(
            json.dumps(
                {
                    "trained": False,
                    "reason": f"insufficient_data ({len(rows)}/{MIN_LABELLED_FOLLOWUPS})",
                    "labelled_count": len(rows),
                    "threshold": MIN_LABELLED_FOLLOWUPS,
                    "checked_at": datetime.now().isoformat(),
                },
                indent=2,
            )
        )
        logger.info(f"Wrote skip marker to {METRICS_PATH}")
        return

    logger.info("Building features...")
    X, y, feature_names = build_features(rows)

    if X is None:
        logger.error("Feature engineering returned None — aborting")
        return

    logger.info(f"Training on {X.shape[0]} samples, {X.shape[1]} features...")
    logger.info(
        f"Positive class (failed): {y.sum()}, Negative (working): {(1-y).sum()}"
    )

    model, metrics, importance, n_train, n_test = train_model(X, y, feature_names)

    # Save model
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODEL_DIR / "recurrence_model.json"
    model.save_model(str(model_path))
    logger.info(f"Model saved to {model_path}")

    # Save metrics
    full_metrics = {
        "trained": True,
        "trained_at": datetime.now().isoformat(),
        "training_samples": n_train,
        "test_samples": n_test,
        "total_labelled": len(rows),
        "positive_count": int(y.sum()),
        "negative_count": int((1 - y).sum()),
        "data_source": "follow_ups (post-service customer feedback)",
        **metrics,
        "feature_importance": importance,
    }
    METRICS_PATH.write_text(json.dumps(full_metrics, indent=2))
    logger.info(f"Metrics saved to {METRICS_PATH}")

    logger.info("Training complete:")
    for k, v in metrics.items():
        logger.info(f"  {k}: {v}")


if __name__ == "__main__":
    main()
