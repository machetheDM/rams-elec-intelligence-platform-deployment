"""
Bronze Layer Transformer — Raw ingestion with source metadata.

Stores extracted records as-is with full provenance:
- source file name and type
- ingestion timestamp
- raw row index
- extraction status (for PDFs)
"""

import pandas as pd
from datetime import datetime
from typing import Any


class BronzeTransformer:
    """Transform extracted data into Bronze layer format.

    Bronze = raw data + source metadata. No cleaning, no deduplication.
    This preserves the original state for audit and reprocessing.
    """

    BRONZE_COLUMNS = [
        "_bronze_id",
        "_source_file",
        "_source_type",
        "_ingested_at",
        "_row_index",
        "_extraction_status",
        "_raw_data",
    ]

    def transform_jobs(self, df: pd.DataFrame) -> pd.DataFrame:
        """Transform job records to Bronze format.

        Stores the entire row as a JSON blob in _raw_data
        plus extracted metadata columns.
        """
        bronze = pd.DataFrame()
        bronze["_source_file"] = df.get("_source_file", "unknown")
        bronze["_source_type"] = df.get("_source_type", "unknown")
        bronze["_ingested_at"] = datetime.now().isoformat()
        bronze["_row_index"] = df.get("_row_index", range(len(df)))
        bronze["_extraction_status"] = "complete"
        bronze["_raw_data"] = df.apply(lambda row: row.to_dict(), axis=1)
        bronze["_bronze_id"] = bronze.apply(
            lambda r: f"{r['_source_file']}_{r['_row_index']}_{r['_ingested_at']}",
            axis=1,
        )
        return bronze

    def transform_pdf_records(self, records: list[dict]) -> pd.DataFrame:
        """Transform PDF-extracted records to Bronze format."""
        bronze = pd.DataFrame()
        bronze["_source_file"] = [r.get("_source_file", "unknown") for r in records]
        bronze["_source_type"] = "pdf"
        bronze["_ingested_at"] = datetime.now().isoformat()
        bronze["_row_index"] = range(len(records))
        bronze["_extraction_status"] = [
            r.get("_extraction_status", "unknown") for r in records
        ]
        bronze["_raw_data"] = [r for r in records]
        bronze["_bronze_id"] = bronze.apply(
            lambda r: f"{r['_source_file']}_{r['_row_index']}_{r['_ingested_at']}",
            axis=1,
        )
        return bronze
