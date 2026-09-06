"""
PDF Job Card Extractor for Rams @Elec ETL Pipeline.

Extracts structured fields from PDF job cards using pdfplumber.
Handles typical SA electrical/refrigeration job card layouts.
"""

import logging
import pdfplumber
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger("etl.extractors.pdf")


class PDFExtractor:
    """Extract job card fields from PDF documents."""

    # Regex patterns for common job card fields
    PATTERNS = {
        "customer_name": [
            r"(?:Customer|Client|Name)[:\s]+([A-Za-z\s]+?)(?:\n|$)",
            r"(?:CUSTOMER|CLIENT)[:\s]+([A-Za-z\s]+)",
        ],
        "customer_phone": [
            r"(?:Phone|Tel|Contact|Cell)[:\s]+([\d\s\-\(\)\+]+)",
            r"(?:PHONE|TEL|CONTACT)[:\s]+([\d\s\-\(\)\+]+)",
        ],
        "address": [
            r"(?:Address|Site|Location)[:\s]+(.+?)(?:\n|$)",
            r"(?:ADDRESS|SITE)[:\s]+(.+)",
        ],
        "job_date": [
            r"(?:Date)[:\s]+(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
            r"(?:DATE)[:\s]+(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
        ],
        "service_type": [
            r"(?:Job\s*Type|Service|Work\s*Description)[:\s]+(.+?)(?:\n|$)",
            r"(?:JOB\s*TYPE|SERVICE)[:\s]+(.+)",
        ],
        "technician_name": [
            r"(?:Technician|Electrician|Engineer|Assigned)[:\s]+([A-Za-z\s]+?)(?:\n|$)",
            r"(?:TECHNICIAN|ENGINEER)[:\s]+([A-Za-z\s]+)",
        ],
        "cost": [
            r"(?:Cost|Amount|Total|Price)[:\s]+R?\s*([\d\s,\.]+)",
            r"(?:COST|AMOUNT|TOTAL)[:\s]+R?\s*([\d\s,\.]+)",
        ],
        "job_notes": [
            r"(?:Notes|Comments|Observations)[:\s]+(.+?)(?:\n\n|\n$|$)",
            r"(?:NOTES|COMMENTS)[:\s]+(.+)",
        ],
    }

    @staticmethod
    def _parse_sa_date(value: str) -> Optional[datetime]:
        """Parse date string to datetime."""
        if not value:
            return None
        value = value.strip()
        formats = [
            "%d/%m/%Y",
            "%d-%m-%Y",
            "%d/%m/%y",
            "%d-%m-%y",
            "%Y/%m/%d",
            "%Y-%m-%d",
            "%d %b %Y",
            "%d %B %Y",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        return None

    @staticmethod
    def _parse_cost(value: str) -> Optional[float]:
        """Parse cost string to float."""
        if not value:
            return None
        cleaned = (
            value.replace("R", "").replace("r", "").replace(" ", "").replace(",", "")
        )
        try:
            return float(cleaned)
        except ValueError:
            return None

    def extract(self, file_path: str, use_textract_fallback: bool = False) -> dict:
        """Extract job card fields from a PDF file.

        Args:
            file_path: Path to PDF job card
            use_textract_fallback: If pdfplumber's regex extraction comes
                back "empty" (no text layer — a scan) or "failed" (text
                found, but no expected field matched — usually destroyed
                layout), retry with AWS Textract's form-aware OCR instead of
                giving up. Off by default: Textract costs real money per
                call, and most job cards in this pipeline are typed PDFs
                that pdfplumber handles fine. See extractors/textract.py's
                module docstring for the single-page limitation.

        Returns:
            Dictionary of extracted fields with source metadata
        """
        path = Path(file_path)
        full_text = ""

        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    full_text += text + "\n"

        if not full_text.strip():
            result = {
                "_source_file": path.name,
                "_source_type": "pdf",
                "_ingested_at": datetime.now().isoformat(),
                "_extraction_status": "empty",
                "_error": "No text extracted from PDF",
            }
            return self._maybe_textract_fallback(
                file_path, result, use_textract_fallback
            )

        result = {
            "_source_file": path.name,
            "_source_type": "pdf",
            "_ingested_at": datetime.now().isoformat(),
            "_extraction_status": "partial",
            "_raw_text": full_text[:2000],  # Store first 2000 chars for audit
        }

        for field, patterns in self.PATTERNS.items():
            for pattern in patterns:
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    value = match.group(1).strip()
                    if field == "job_date":
                        value = self._parse_sa_date(value)
                    elif field == "cost":
                        value = self._parse_cost(value)
                    result[field] = value
                    break

        # Determine extraction completeness
        expected_fields = {"customer_name", "job_date", "service_type"}
        found = expected_fields & set(result.keys())
        if len(found) == len(expected_fields):
            result["_extraction_status"] = "complete"
        elif len(found) == 0:
            result["_extraction_status"] = "failed"

        return self._maybe_textract_fallback(file_path, result, use_textract_fallback)

    @staticmethod
    def _maybe_textract_fallback(
        file_path: str, pdfplumber_result: dict, use_textract_fallback: bool
    ) -> dict:
        """If pdfplumber came back "empty" or "failed" and the caller opted
        in, retry with Textract and return whichever result actually found
        the expected fields.

        The pdfplumber result is kept as a base and Textract's fields
        layered on top — not replaced outright — so a partial pdfplumber
        match (e.g. it found customer_name but not job_date) survives even
        if Textract's form detection misses that same field under a
        differently-worded key.
        """
        if not use_textract_fallback or pdfplumber_result["_extraction_status"] not in (
            "empty",
            "failed",
        ):
            return pdfplumber_result

        # Imported here, not at module top — this is the one path that
        # needs boto3 and AWS credentials, and most runs of this extractor
        # never take it. Relative import, matching extractors/__init__.py's
        # convention — this module is always loaded as part of the
        # `extractors` package (see rams_elec_etl_dag.py's
        # `from extractors.pdf import PDFExtractor`), never standalone.
        from .textract import TextractExtractor

        logger.info(
            f"pdfplumber status='{pdfplumber_result['_extraction_status']}' for "
            f"{pdfplumber_result['_source_file']} — retrying with Textract"
        )
        textract_result = TextractExtractor().extract(file_path)

        merged = {
            **pdfplumber_result,
            **{k: v for k, v in textract_result.items() if v not in (None, "")},
        }
        # Whichever attempt found more of the expected fields wins the
        # reported status — merging fields but keeping pdfplumber's "failed"
        # status when Textract also failed would misreport a record that is
        # in fact still unusable.
        merged["_extraction_status"] = textract_result.get(
            "_extraction_status", pdfplumber_result["_extraction_status"]
        )
        return merged

    def extract_batch(
        self, directory: str, use_textract_fallback: bool = False
    ) -> list[dict]:
        """Extract all PDFs in a directory.

        Args:
            directory: Path to directory containing PDF job cards
            use_textract_fallback: See extract()'s docstring.

        Returns:
            List of extracted field dictionaries
        """
        results = []
        pdf_dir = Path(directory)
        for pdf_file in pdf_dir.glob("*.pdf"):
            try:
                result = self.extract(
                    str(pdf_file), use_textract_fallback=use_textract_fallback
                )
                results.append(result)
            except Exception as e:
                results.append(
                    {
                        "_source_file": pdf_file.name,
                        "_source_type": "pdf",
                        "_ingested_at": datetime.now().isoformat(),
                        "_extraction_status": "error",
                        "_error": str(e),
                    }
                )
        return results
