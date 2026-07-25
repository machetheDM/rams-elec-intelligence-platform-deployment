"""
Excel/CSV Extractor for Rams @Elec ETL Pipeline.

Handles common SA business data messiness:
- Inconsistent date formats (2024/01/15, 15-Jan-2024, 15/01/2024)
- Mixed currency formats (R1200, 1200, R 1,200.00, R1 200)
- Missing values, duplicate rows, merged cells
"""

import pandas as pd
import re
from datetime import datetime
from pathlib import Path
from typing import Optional


class ExcelExtractor:
    """Extract job records, customer lists, and pricing sheets from Excel/CSV."""

    # Known column name variations → standardised names
    COLUMN_MAP = {
        # Customer fields
        "customer": "customer_name",
        "client": "customer_name",
        "client_name": "customer_name",
        "name": "customer_name",
        "customer name": "customer_name",
        # Phone fields
        "phone": "customer_phone",
        "contact": "customer_phone",
        "tel": "customer_phone",
        "telephone": "customer_phone",
        "cell": "customer_phone",
        "mobile": "customer_phone",
        "phone number": "customer_phone",
        # Address/area
        "address": "address",
        "area": "area_zone",
        "suburb": "area_zone",
        "location": "area_zone",
        "zone": "area_zone",
        # Job fields
        "job_type": "service_type",
        "service": "service_type",
        "work_type": "service_type",
        "category": "service_type",
        "description": "job_description",
        "work_done": "job_description",
        "notes": "job_notes",
        # Cost fields
        "cost": "cost",
        "price": "cost",
        "amount": "cost",
        "total": "cost",
        "charge": "cost",
        "quoted": "quoted_cost",
        "quote": "quoted_cost",
        "actual": "actual_cost",
        # Date fields
        "date": "job_date",
        "job_date": "job_date",
        "completed": "completed_date",
        "completion_date": "completed_date",
        "scheduled": "scheduled_date",
        # Technician
        "technician": "technician_name",
        "tech": "technician_name",
        "electrician": "technician_name",
        "assigned_to": "technician_name",
        # Status
        "status": "status",
        "job_status": "status",
        # Urgency
        "urgency": "urgency",
        "priority": "urgency",
    }

    @staticmethod
    def _normalise_column_names(df: pd.DataFrame) -> pd.DataFrame:
        """Map messy column names to standardised names."""
        df.columns = [col.strip().lower().replace("  ", " ") for col in df.columns]
        df.rename(columns=ExcelExtractor.COLUMN_MAP, inplace=True)
        return df

    @staticmethod
    def _parse_sa_currency(value) -> Optional[float]:
        """Parse South African currency formats to float.
        Handles: R1200, 1200, R 1,200.00, R1 200, 'R 1 200.50'
        """
        if value is None or (isinstance(value, str) and value.strip() == ""):
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            cleaned = value.replace("R", "").replace("r", "").replace(" ", "")
            cleaned = cleaned.replace(",", "")
            try:
                return float(cleaned)
            except ValueError:
                return None
        return None

    @staticmethod
    def _parse_sa_date(value) -> Optional[datetime]:
        """Parse various SA date formats to datetime."""
        if value is None or (isinstance(value, str) and value.strip() == ""):
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, pd.Timestamp):
            return value.to_pydatetime()

        date_str = str(value).strip()
        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%d-%b-%Y",
            "%d %b %Y",
            "%d %B %Y",
            "%Y-%m-%d %H:%M:%S",
            "%d/%m/%Y %H:%M",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        return None

    @staticmethod
    def _clean_phone(value) -> Optional[str]:
        """Normalise SA phone numbers to +27 format."""
        if value is None or (isinstance(value, str) and value.strip() == ""):
            return None
        raw = (
            str(value)
            .strip()
            .replace(" ", "")
            .replace("-", "")
            .replace("(", "")
            .replace(")", "")
        )
        # Handle numbers starting with 0 (e.g. 0831234567 → +27831234567)
        if raw.startswith("0"):
            raw = "+27" + raw[1:]
        elif raw.startswith("27") and not raw.startswith("+"):
            raw = "+" + raw
        elif len(raw) == 9 and raw.startswith("8"):
            raw = "+27" + raw
        return raw if raw.startswith("+27") else None

    def extract(self, file_path: str, sheet_name: int | str = 0) -> pd.DataFrame:
        """Extract data from Excel or CSV file into a standardised DataFrame.

        Args:
            file_path: Path to .xlsx, .xls, or .csv file
            sheet_name: Sheet name or index for Excel files

        Returns:
            DataFrame with standardised column names and source metadata
        """
        path = Path(file_path)
        if path.suffix.lower() in (".xlsx", ".xls"):
            df = pd.read_excel(file_path, sheet_name=sheet_name)
        elif path.suffix.lower() == ".csv":
            df = pd.read_csv(file_path)
        else:
            raise ValueError(f"Unsupported file format: {path.suffix}")

        # Remove completely empty rows and columns
        df = df.dropna(how="all").dropna(axis=1, how="all")

        # Normalise column names
        df = self._normalise_column_names(df)

        # Add source metadata
        df["_source_file"] = path.name
        df["_source_type"] = path.suffix.lower()
        df["_ingested_at"] = datetime.now().isoformat()
        df["_row_index"] = range(len(df))

        # Parse currency columns
        for col in ["cost", "quoted_cost", "actual_cost"]:
            if col in df.columns:
                df[col] = df[col].apply(self._parse_sa_currency)

        # Parse date columns
        for col in ["job_date", "completed_date", "scheduled_date"]:
            if col in df.columns:
                df[col] = df[col].apply(self._parse_sa_date)

        # Clean phone numbers
        if "customer_phone" in df.columns:
            df["customer_phone"] = df["customer_phone"].apply(self._clean_phone)

        return df
