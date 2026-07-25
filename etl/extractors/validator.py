"""
Data Validator for Rams @Elec ETL Pipeline.

Validates extracted records and flags failures to etl_error_log table.
Never silently drops records — all failures are logged with context.
"""

import pandas as pd
from datetime import datetime
from typing import Any


class DataValidator:
    """Validate extracted records against business rules."""

    # Required fields per record type
    REQUIRED_FIELDS = {
        "job": ["customer_name", "job_date", "service_type"],
        "customer": ["customer_name", "customer_phone"],
        "equipment": ["customer_name", "type"],
    }

    # Valid enum values
    VALID_SERVICE_CATEGORIES = [
        "electrical",
        "refrigeration",
        "emergency",
        "maintenance",
        "installation",
    ]
    VALID_JOB_STATUSES = ["open", "assigned", "in_progress", "complete", "cancelled"]
    VALID_URGENCIES = ["low", "medium", "high", "emergency"]
    VALID_EQUIPMENT_TYPES = [
        "cold_room",
        "hvac",
        "electrical_panel",
        "generator",
        "other",
    ]
    VALID_AREA_ZONES = [
        "Sandton",
        "Midrand",
        "Centurion",
        "Pretoria East",
        "Soweto",
        "Polokwane",
        "Mokopane",
        "Bela-Bela",
    ]

    def __init__(self):
        self.errors: list[dict] = []

    def _add_error(
        self,
        source_file: str,
        row_index: int | None,
        field_name: str | None,
        raw_value: Any,
        error_type: str,
        error_message: str,
    ):
        """Log a validation error."""
        self.errors.append(
            {
                "source_file": source_file,
                "row_index": row_index,
                "field_name": field_name,
                "raw_value": str(raw_value) if raw_value is not None else None,
                "error_type": error_type,
                "error_message": error_message,
                "created_at": datetime.now(),
            }
        )

    def validate_job_records(
        self, df: pd.DataFrame
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        """Validate job records DataFrame.

        Returns:
            (valid_records, error_records) — both DataFrames
        """
        valid_mask = pd.Series(True, index=df.index)
        source_file = (
            df.get("_source_file", pd.Series(["unknown"] * len(df))).iloc[0]
            if "_source_file" in df.columns
            else "unknown"
        )

        for idx, row in df.iterrows():
            row_idx = row.get("_row_index", idx)

            # Check required fields
            for field in self.REQUIRED_FIELDS["job"]:
                if (
                    field not in row
                    or pd.isna(row[field])
                    or str(row[field]).strip() == ""
                ):
                    valid_mask.at[idx] = False
                    self._add_error(
                        source_file,
                        row_idx,
                        field,
                        row.get(field),
                        "missing_required",
                        f"Required field '{field}' is missing or empty",
                    )

            # Validate cost is non-negative
            for cost_field in ["cost", "quoted_cost", "actual_cost"]:
                if cost_field in row and not pd.isna(row[cost_field]):
                    if row[cost_field] < 0:
                        valid_mask.at[idx] = False
                        self._add_error(
                            source_file,
                            row_idx,
                            cost_field,
                            row[cost_field],
                            "validation",
                            f"Cost field '{cost_field}' is negative",
                        )
                    if row[cost_field] > 1_000_000:
                        valid_mask.at[idx] = False
                        self._add_error(
                            source_file,
                            row_idx,
                            cost_field,
                            row[cost_field],
                            "validation",
                            f"Cost field '{cost_field}' exceeds R1,000,000 — likely data entry error",
                        )

            # Validate date is not in the future for completed jobs
            if "completed_date" in row and not pd.isna(row["completed_date"]):
                if (
                    isinstance(row["completed_date"], datetime)
                    and row["completed_date"] > datetime.now()
                ):
                    valid_mask.at[idx] = False
                    self._add_error(
                        source_file,
                        row_idx,
                        "completed_date",
                        row["completed_date"],
                        "validation",
                        "Completed date is in the future",
                    )

            # Validate phone format
            if "customer_phone" in row and not pd.isna(row["customer_phone"]):
                phone = str(row["customer_phone"])
                if not phone.startswith("+27"):
                    valid_mask.at[idx] = False
                    self._add_error(
                        source_file,
                        row_idx,
                        "customer_phone",
                        phone,
                        "parsing",
                        "Phone number not in +27 format",
                    )

        valid = df[valid_mask].copy()
        errors = df[~valid_mask].copy()
        return valid, errors

    def validate_customer_records(
        self, df: pd.DataFrame
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        """Validate customer records DataFrame."""
        valid_mask = pd.Series(True, index=df.index)
        source_file = (
            df.get("_source_file", pd.Series(["unknown"] * len(df))).iloc[0]
            if "_source_file" in df.columns
            else "unknown"
        )

        for idx, row in df.iterrows():
            row_idx = row.get("_row_index", idx)

            for field in self.REQUIRED_FIELDS["customer"]:
                if (
                    field not in row
                    or pd.isna(row[field])
                    or str(row[field]).strip() == ""
                ):
                    valid_mask.at[idx] = False
                    self._add_error(
                        source_file,
                        row_idx,
                        field,
                        row.get(field),
                        "missing_required",
                        f"Required field '{field}' is missing",
                    )

            # Validate area zone
            if "area_zone" in row and not pd.isna(row["area_zone"]):
                zone = str(row["area_zone"]).strip()
                if zone not in self.VALID_AREA_ZONES:
                    valid_mask.at[idx] = False
                    self._add_error(
                        source_file,
                        row_idx,
                        "area_zone",
                        zone,
                        "validation",
                        f"Unknown area zone '{zone}'. Must be one of: {self.VALID_AREA_ZONES}",
                    )

        valid = df[valid_mask].copy()
        errors = df[~valid_mask].copy()
        return valid, errors

    def get_error_summary(self) -> dict:
        """Return summary of validation errors."""
        if not self.errors:
            return {"total_errors": 0, "by_type": {}, "by_file": {}}

        by_type = {}
        by_file = {}
        for err in self.errors:
            etype = err["error_type"]
            fname = err["source_file"]
            by_type[etype] = by_type.get(etype, 0) + 1
            by_file[fname] = by_file.get(fname, 0) + 1

        return {
            "total_errors": len(self.errors),
            "by_type": by_type,
            "by_file": by_file,
        }

    def clear_errors(self):
        """Reset error log for a new validation run."""
        self.errors = []
