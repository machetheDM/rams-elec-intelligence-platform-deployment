"""
S3 Loader — writes the Gold layer to the AWS data lake, alongside Postgres.

This is additive, not a replacement. PostgresLoader.load_gold_data() remains
the source `gold_jobs` reads from today; this loader gives SageMaker (Phase 1)
and Athena (Phase 4) a Parquet copy to read from without hitting production
Postgres for training/analytics queries.

Bucket: reuses the existing `artifacts` bucket from terraform/aws/s3.tf
(private, versioned, SSE-S3) under a `gold/` prefix — no new bucket, no new
storage cost line beyond what that module's README already accounts for.

Partitioning: by ingestion date (`dt=YYYY-MM-DD`) so the Glue Crawler
(terraform/aws/glue.tf) can register a partitioned table and Athena queries
can prune by date instead of scanning the whole prefix.
"""

import io
import os
from datetime import datetime, timezone
from typing import Optional

import pandas as pd


class S3GoldLoader:
    """Write the Gold DataFrame to S3 as Parquet, partitioned by ingestion date."""

    def __init__(
        self,
        bucket: Optional[str] = None,
        prefix: str = "gold",
        region: Optional[str] = None,
    ):
        self.bucket = bucket or os.getenv("RAMS_ELEC_ARTIFACTS_BUCKET")
        self.prefix = prefix
        self.region = region or os.getenv("AWS_REGION", "af-south-1")

        if not self.bucket:
            # Not fatal — the Postgres path is still the source of truth. Callers
            # (the DAG, generate_seed_data.py) should treat a missing bucket as
            # "S3 write skipped", not as a pipeline failure.
            self._client = None
        else:
            import boto3

            self._client = boto3.client("s3", region_name=self.region)

    @property
    def enabled(self) -> bool:
        return self._client is not None

    def load(self, gold_df: pd.DataFrame, run_id: Optional[str] = None) -> dict:
        """Write Gold records to s3://{bucket}/{prefix}/dt=YYYY-MM-DD/{run_id}.parquet.

        Returns a dict describing what happened rather than raising on a missing
        bucket, so a laptop run without AWS credentials configured degrades to
        "skipped" instead of failing the whole ETL run.
        """
        if gold_df.empty:
            return {"status": "skipped", "reason": "empty_dataframe"}

        if not self.enabled:
            return {"status": "skipped", "reason": "no_bucket_configured"}

        run_date = datetime.now(timezone.utc)
        run_id = run_id or run_date.strftime("%H%M%S")
        key = (
            f"{self.prefix}/dt={run_date.strftime('%Y-%m-%d')}/"
            f"gold_jobs_{run_id}.parquet"
        )

        buffer = io.BytesIO()
        # pyarrow is the parquet engine; declared in etl/requirements.txt.
        gold_df.to_parquet(buffer, engine="pyarrow", index=False)
        buffer.seek(0)

        self._client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=buffer.getvalue(),
            ServerSideEncryption="AES256",
        )

        return {
            "status": "written",
            "bucket": self.bucket,
            "key": key,
            "rows": len(gold_df),
        }
