"""
Gold Layer Transformer — Feature-engineered records for ML consumption.

Derived columns added:
- job_duration_days: days between scheduled and completed date
- cost_per_hour: actual_cost / typical_duration_hours
- area_zone_category: grouped zone (Gauteng / Limpopo)
- urgency_flag: binary — 1 if emergency/high, 0 otherwise
- equipment_age_at_service: years between install_date and job_date
- is_weekend_job: whether the job was on a weekend
- month: month of job for seasonality analysis
- day_of_week: day of week for scheduling patterns
"""

import pandas as pd
import numpy as np
from datetime import datetime


class GoldTransformer:
    """Transform Silver data into Gold layer — ML-ready features."""

    AREA_ZONE_GROUPS = {
        "Sandton": "Gauteng",
        "Midrand": "Gauteng",
        "Centurion": "Gauteng",
        "Pretoria East": "Gauteng",
        "Soweto": "Gauteng",
        "Polokwane": "Limpopo",
        "Mokopane": "Limpopo",
        "Bela-Bela": "Limpopo",
    }

    URGENCY_MAP = {
        "emergency": 1,
        "high": 1,
        "medium": 0,
        "low": 0,
    }

    def transform(self, silver_df: pd.DataFrame) -> pd.DataFrame:
        """Transform Silver records to Gold layer with ML features."""
        if silver_df.empty:
            return pd.DataFrame()

        gold = silver_df.copy()

        # Job duration in days
        if "completed_date" in gold.columns and "job_date" in gold.columns:
            gold["completed_date"] = pd.to_datetime(
                gold["completed_date"], errors="coerce"
            )
            gold["job_date"] = pd.to_datetime(gold["job_date"], errors="coerce")
            gold["job_duration_days"] = (
                gold["completed_date"] - gold["job_date"]
            ).dt.total_seconds() / 86400
            gold["job_duration_days"] = gold["job_duration_days"].clip(0, 365)

        # Cost per hour (use clean cost if available)
        cost_col = "cost_clean" if "cost_clean" in gold.columns else "cost"
        if cost_col in gold.columns:
            gold["cost_per_hour"] = gold[cost_col] / gold.get(
                "typical_duration_hours", pd.Series([4] * len(gold))
            )
            gold["cost_per_hour"] = gold["cost_per_hour"].replace(
                [np.inf, -np.inf], np.nan
            )

        # Area zone group
        if "area_zone" in gold.columns:
            gold["area_zone_group"] = (
                gold["area_zone"].map(self.AREA_ZONE_GROUPS).fillna("Other")
            )

        # Urgency flag
        if "urgency" in gold.columns:
            gold["urgency_flag"] = (
                gold["urgency"].str.lower().map(self.URGENCY_MAP).fillna(0).astype(int)
            )

        # Equipment age at service
        if "install_date" in gold.columns and "job_date" in gold.columns:
            gold["install_date"] = pd.to_datetime(gold["install_date"], errors="coerce")
            gold["equipment_age_days"] = (
                gold["job_date"] - gold["install_date"]
            ).dt.total_seconds() / 86400
            gold["equipment_age_years"] = gold["equipment_age_days"] / 365.25
            gold["equipment_age_years"] = gold["equipment_age_years"].clip(0, 50)

        # Temporal features
        if "job_date" in gold.columns:
            gold["job_date"] = pd.to_datetime(gold["job_date"], errors="coerce")
            gold["month"] = gold["job_date"].dt.month
            gold["day_of_week"] = gold["job_date"].dt.dayofweek
            gold["is_weekend"] = gold["day_of_week"].isin([5, 6]).astype(int)
            gold["quarter"] = gold["job_date"].dt.quarter

        # Service category encoding (for ML)
        if "service_category" in gold.columns:
            categories = gold["service_category"].dropna().unique()
            cat_map = {cat: i for i, cat in enumerate(sorted(categories))}
            gold["service_category_encoded"] = gold["service_category"].map(cat_map)

        # Area zone encoding (for ML)
        if "area_zone" in gold.columns:
            zones = gold["area_zone"].dropna().unique()
            zone_map = {z: i for i, z in enumerate(sorted(zones))}
            gold["area_zone_encoded"] = gold["area_zone"].map(zone_map)

        gold["_gold_processed_at"] = datetime.now().isoformat()
        return gold

    def get_ml_features(
        self, gold_df: pd.DataFrame
    ) -> tuple[pd.DataFrame, pd.Series | None]:
        """Extract feature matrix X and target vector y for ML training.

        Features: service_category_encoded, urgency_flag, area_zone_encoded,
                  equipment_age_years, month, day_of_week, is_weekend, cost_per_hour

        Target: actual_cost (if available)
        """
        feature_cols = [
            "service_category_encoded",
            "urgency_flag",
            "area_zone_encoded",
            "equipment_age_years",
            "month",
            "day_of_week",
            "is_weekend",
            "cost_per_hour",
        ]

        available_features = [c for c in feature_cols if c in gold_df.columns]
        X = gold_df[available_features].copy()

        # Fill NaN with median
        for col in X.columns:
            if X[col].isna().any():
                X[col] = X[col].fillna(X[col].median())

        y = None
        target_col = (
            "actual_cost"
            if "actual_cost" in gold_df.columns
            else "cost_clean" if "cost_clean" in gold_df.columns else None
        )
        if target_col and target_col in gold_df.columns:
            y = gold_df[target_col].copy()

        return X, y
