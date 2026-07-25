"""
Silver Layer Transformer — Cleaned, standardised, deduplicated records.

Operations:
- Standardise job types to service_types enum categories
- Normalise area zone names (fuzzy matching to known zones)
- Clean phone numbers to +27 format
- Extract numeric cost values from mixed formats
- Deduplicate records by key fields
- Fill missing values with sensible defaults where appropriate
"""

import pandas as pd
import re
from datetime import datetime
from typing import Optional


class SilverTransformer:
    """Transform Bronze data into Silver layer — clean and standardised."""

    # Category mapping: free-text job descriptions → standardised categories
    CATEGORY_KEYWORDS = {
        "electrical": [
            "electrical",
            "wiring",
            "db board",
            "distribution board",
            "circuit",
            "plug",
            "socket",
            "light",
            "power",
            "coc",
            "compliance",
            "audit",
            "surge",
            "inverter",
            "voltage",
            "earth",
            "ground",
        ],
        "refrigeration": [
            "cold room",
            "coldroom",
            "fridge",
            "freezer",
            "refrigeration",
            "cooling",
            "chiller",
            "condenser",
            "evaporator",
            "compressor",
            "temperature",
            "thermostat",
        ],
        "hvac": [
            "aircon",
            "air con",
            "air conditioner",
            "hvac",
            "ventilation",
            "duct",
            "heating",
            "climate",
        ],
        "emergency": [
            "emergency",
            "urgent",
            "asap",
            "immediately",
            "no power",
            "spark",
            "smoke",
            "burning",
            "fire",
            "flood",
            "leak",
            "not working",
            "broken",
            "failed",
            "down",
        ],
        "maintenance": [
            "maintenance",
            "service",
            "servicing",
            "check",
            "inspect",
            "preventative",
            "routine",
            "annual",
            "quarterly",
        ],
        "installation": [
            "install",
            "installation",
            "new",
            "setup",
            "fit",
            "build",
            "construct",
            "upgrade",
            "replace",
        ],
    }

    # Area zone fuzzy matching
    AREA_ZONE_ALIASES = {
        "sandton": "Sandton",
        "sandton cbd": "Sandton",
        "rivonia": "Sandton",
        "midrand": "Midrand",
        "halfway house": "Midrand",
        "centurion": "Centurion",
        "verwoerdburg": "Centurion",
        "pretoria east": "Pretoria East",
        "pretoria": "Pretoria East",
        "lynnwood": "Pretoria East",
        "garsfontein": "Pretoria East",
        "soweto": "Soweto",
        "orlando": "Soweto",
        "polokwane": "Polokwane",
        "pietersburg": "Polokwane",
        "mokopane": "Mokopane",
        "potgietersrus": "Mokopane",
        "bela-bela": "Bela-Bela",
        "bela bela": "Bela-Bela",
        "warmbaths": "Bela-Bela",
    }

    @staticmethod
    def classify_service_category(description: str) -> Optional[str]:
        """Classify a job description into a service category using keyword matching."""
        if not description or not isinstance(description, str):
            return None
        desc_lower = description.lower()
        scores = {}
        for category, keywords in SilverTransformer.CATEGORY_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in desc_lower)
            if score > 0:
                scores[category] = score
        if not scores:
            return "electrical"  # Default fallback
        return max(scores, key=scores.get)

    @staticmethod
    def normalise_area_zone(zone: str) -> Optional[str]:
        """Normalise area zone name using fuzzy matching."""
        if not zone or not isinstance(zone, str):
            return None
        zone_lower = zone.strip().lower()
        if zone_lower in SilverTransformer.AREA_ZONE_ALIASES:
            return SilverTransformer.AREA_ZONE_ALIASES[zone_lower]
        # Try partial match
        for alias, canonical in SilverTransformer.AREA_ZONE_ALIASES.items():
            if alias in zone_lower or zone_lower in alias:
                return canonical
        return zone.strip()  # Return as-is if no match

    @staticmethod
    def clean_phone(phone: str) -> Optional[str]:
        """Normalise SA phone number to +27XXXXXXXXX format."""
        if not phone or not isinstance(phone, str):
            return None
        raw = re.sub(r"[^\d+]", "", phone.strip())
        if raw.startswith("0"):
            raw = "+27" + raw[1:]
        elif raw.startswith("27") and not raw.startswith("+"):
            raw = "+" + raw
        elif len(raw) == 9 and raw.startswith(("6", "7", "8")):
            raw = "+27" + raw
        return raw if raw.startswith("+27") and len(raw) == 12 else None

    @staticmethod
    def extract_cost(value) -> Optional[float]:
        """Extract numeric cost from various formats."""
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value) if value >= 0 else None
        if isinstance(value, str):
            cleaned = (
                value.replace("R", "")
                .replace("r", "")
                .replace(" ", "")
                .replace(",", "")
            )
            try:
                return float(cleaned)
            except ValueError:
                return None
        return None

    def transform(self, bronze_df: pd.DataFrame) -> pd.DataFrame:
        """Transform Bronze records to Silver layer.

        Expands _raw_data JSON, applies cleaning and standardisation,
        deduplicates, and returns a clean DataFrame.
        """
        if bronze_df.empty:
            return pd.DataFrame()

        # Expand raw data from JSON
        records = []
        for _, row in bronze_df.iterrows():
            raw = row["_raw_data"]
            if isinstance(raw, dict):
                rec = {k: v for k, v in raw.items() if not k.startswith("_")}
                rec["_bronze_id"] = row["_bronze_id"]
                rec["_source_file"] = row["_source_file"]
                records.append(rec)

        if not records:
            return pd.DataFrame()

        silver = pd.DataFrame(records)

        # Standardise service category
        if "service_type" in silver.columns:
            silver["service_category"] = silver["service_type"].apply(
                self.classify_service_category
            )
        elif "job_description" in silver.columns:
            silver["service_category"] = silver["job_description"].apply(
                self.classify_service_category
            )

        # Normalise area zones
        if "area_zone" in silver.columns:
            silver["area_zone"] = silver["area_zone"].apply(self.normalise_area_zone)

        # Clean phone numbers
        if "customer_phone" in silver.columns:
            silver["customer_phone"] = silver["customer_phone"].apply(self.clean_phone)

        # Extract clean cost values
        for col in ["cost", "quoted_cost", "actual_cost"]:
            if col in silver.columns:
                silver[f"{col}_clean"] = silver[col].apply(self.extract_cost)

        # Deduplicate by key fields
        dedup_cols = ["customer_name", "job_date", "service_type"]
        available_cols = [c for c in dedup_cols if c in silver.columns]
        if available_cols:
            silver = silver.drop_duplicates(subset=available_cols, keep="first")

        silver["_silver_processed_at"] = datetime.now().isoformat()
        return silver
