"""
Textract Fallback Extractor — for PDF job cards pdfplumber cannot read.

WHY THIS EXISTS
  pdf.py's PDFExtractor is regex-over-text, and works well for job cards that
  were generated as text (typed forms, exported PDFs). It has two honest
  failure modes:
    - "empty"  — pdfplumber extracted no text at all. Almost always a scanned
                 or photographed job card with no text layer.
    - "failed" — text was extracted, but none of the three fields the
                 pipeline treats as minimally required (customer_name,
                 job_date, service_type) matched any regex. Usually a layout
                 pdfplumber's linear text extraction scrambles — a table or
                 multi-column form where "Customer:" and the name end up on
                 unrelated lines once flattened to text.

  Textract's AnalyzeDocument (FeatureTypes=["FORMS"]) doesn't read a text
  stream — it reads the page image and reasons about visual key-value
  proximity. That fixes exactly the "failed" case (regex can't recover once
  layout is destroyed) and gives OCR for the "empty" case (no text layer at
  all). It is not a strictly-better replacement for pdfplumber: it costs real
  money per page (~$0.05 for AnalyzeDocument with FORMS, correct at time of
  writing — check current AWS Textract pricing before relying on this
  number), so it is wired in as an explicit, opt-in FALLBACK — never the
  first attempt.

KNOWN LIMITATION — SINGLE PAGE ONLY
  This uses the synchronous AnalyzeDocument API, which processes images
  (PNG/JPEG) or single-page PDFs directly from bytes. Multi-page PDFs require
  the asynchronous StartDocumentAnalysis + S3 + SNS workflow, which is a
  meaningfully bigger piece of infrastructure (a queue, a callback) for a
  feature that is itself a fallback for a minority of documents. Rams @Elec
  job cards are one page in practice — this is a deliberate scope limit, not
  an oversight, and a multi-page PDF here fails with a clear, caught error
  rather than a confusing one.
"""

import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from pdf import PDFExtractor

logger = logging.getLogger("etl.extractors.textract")

# Same canonical field names PDFExtractor.PATTERNS and ExcelExtractor.COLUMN_MAP
# use, so a Textract-recovered record slots into validator.py's
# REQUIRED_FIELDS check without any special-casing downstream.
_KEY_ALIASES: dict[str, str] = {
    "customer": "customer_name",
    "client": "customer_name",
    "name": "customer_name",
    "customer name": "customer_name",
    "client name": "customer_name",
    "phone": "customer_phone",
    "tel": "customer_phone",
    "contact": "customer_phone",
    "cell": "customer_phone",
    "mobile": "customer_phone",
    "address": "address",
    "site": "address",
    "location": "address",
    "date": "job_date",
    "job date": "job_date",
    "job type": "service_type",
    "service": "service_type",
    "work description": "service_type",
    "description": "service_type",
    "technician": "technician_name",
    "electrician": "technician_name",
    "engineer": "technician_name",
    "assigned": "technician_name",
    "cost": "cost",
    "amount": "cost",
    "total": "cost",
    "price": "cost",
    "notes": "job_notes",
    "comments": "job_notes",
    "observations": "job_notes",
}

# Formats the value side of a KEY_VALUE_SET can plausibly hand back — mirrors
# PDFExtractor._parse_sa_date's list. Reusing that method rather than
# duplicating it, imported below.
_CURRENCY_STRIP = re.compile(r"[Rr,\s]")


def _normalise_key(raw_key: str) -> Optional[str]:
    """Map a Textract-detected form key to a canonical field name.

    Textract returns the key exactly as printed, including trailing colons
    and inconsistent case ("Customer:", "CUSTOMER NAME", "Client Name:") —
    this strips punctuation and looks up the cleaned text.
    """
    cleaned = raw_key.strip().rstrip(":").strip().lower()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return _KEY_ALIASES.get(cleaned)


def _parse_cost(value: str) -> Optional[float]:
    if not value:
        return None
    try:
        return float(_CURRENCY_STRIP.sub("", value))
    except ValueError:
        return None


class TextractExtractor:
    """Fallback OCR/form extractor for PDF job cards pdfplumber cannot read.

    Never constructs a boto3 client until extract() is actually called —
    mirrors S3GoldLoader's "no credentials configured means skipped, not
    broken" contract, so importing this module never requires AWS
    credentials to be present.
    """

    def __init__(self, region: Optional[str] = None):
        self.region = region or os.getenv("AWS_REGION", "af-south-1")
        self._client = None

    def _get_client(self):
        if self._client is None:
            import boto3

            self._client = boto3.client("textract", region_name=self.region)
        return self._client

    def _key_value_pairs(self, blocks: list[dict]) -> dict[str, str]:
        """Reconstruct {key_text: value_text} from Textract's KEY_VALUE_SET
        blocks, which reference each other and child WORD blocks by Id
        rather than containing text directly.
        """
        block_by_id = {b["Id"]: b for b in blocks}

        def _text_of(block: dict) -> str:
            words = []
            for rel in block.get("Relationships", []):
                if rel["Type"] != "CHILD":
                    continue
                for child_id in rel["Ids"]:
                    child = block_by_id.get(child_id)
                    if child and child["BlockType"] == "WORD":
                        words.append(child.get("Text", ""))
            return " ".join(words)

        keys = [
            b
            for b in blocks
            if b["BlockType"] == "KEY_VALUE_SET" and "KEY" in b.get("EntityTypes", [])
        ]

        pairs: dict[str, str] = {}
        for key_block in keys:
            key_text = _text_of(key_block)
            value_text = ""
            for rel in key_block.get("Relationships", []):
                if rel["Type"] != "VALUE":
                    continue
                for value_id in rel["Ids"]:
                    value_block = block_by_id.get(value_id)
                    if value_block:
                        value_text = _text_of(value_block)
            if key_text:
                pairs[key_text] = value_text
        return pairs

    def extract(self, file_path: str) -> dict[str, Any]:
        """Run Textract AnalyzeDocument (FORMS) on a single-page PDF or
        image and return a dict shaped like PDFExtractor.extract()'s output.

        Never raises — an unreachable Textract, a multi-page PDF, or missing
        credentials all come back as a structured `_extraction_status: "error"`
        record with `_error` explaining why, so a batch run degrades one
        document at a time rather than aborting.
        """
        path = Path(file_path)
        base: dict[str, Any] = {
            "_source_file": path.name,
            "_source_type": path.suffix.lstrip(".").lower(),
            "_ingested_at": datetime.now().isoformat(),
            "_extraction_method": "textract",
        }

        try:
            with open(file_path, "rb") as f:
                document_bytes = f.read()
        except OSError as exc:
            return {
                **base,
                "_extraction_status": "error",
                "_error": f"Could not read file: {exc}",
            }

        try:
            client = self._get_client()
            response = client.analyze_document(
                Document={"Bytes": document_bytes},
                FeatureTypes=["FORMS"],
            )
        except (
            Exception
        ) as exc:  # noqa: BLE001 - AWS errors are varied; never crash the batch
            message = str(exc)
            hint = ""
            if "UnsupportedDocumentException" in message or "multi" in message.lower():
                hint = (
                    " (likely a multi-page PDF — this extractor only supports "
                    "single-page documents; see the module docstring)"
                )
            logger.warning(f"Textract call failed for {path.name}: {exc}{hint}")
            return {
                **base,
                "_extraction_status": "error",
                "_error": f"{exc.__class__.__name__}: {exc}{hint}",
            }

        pairs = self._key_value_pairs(response.get("Blocks", []))

        result = dict(base)
        for raw_key, raw_value in pairs.items():
            field = _normalise_key(raw_key)
            if not field or not raw_value:
                continue
            if field == "job_date":
                result[field] = PDFExtractor._parse_sa_date(raw_value)
            elif field == "cost":
                result[field] = _parse_cost(raw_value)
            else:
                result[field] = raw_value.strip()

        expected_fields = {"customer_name", "job_date", "service_type"}
        found = expected_fields & set(result.keys())
        if len(found) == len(expected_fields):
            result["_extraction_status"] = "complete"
        elif found:
            result["_extraction_status"] = "partial"
        else:
            result["_extraction_status"] = "failed"

        return result
