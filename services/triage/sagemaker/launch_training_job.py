"""
Launch a SageMaker Training Job for the quote estimator, and register the
result in the SageMaker Model Registry.

This is the AWS-native counterpart to services/triage/train_model.py — same
feature encoding (feature_encoding.py), same hyperparameters, same held-out
MAE/R² evaluation, different infrastructure. Neither replaces the other:
train_model.py stays the fast local/CI path; this is what actually runs on
SageMaker training compute and produces a Model Package Group entry.

Reads Gold data from the S3 Parquet the ETL pipeline writes
(etl/loaders/s3_loader.py) via the Glue table this project's glue.tf
catalogs — falls back to a local Postgres `gold_jobs` read if the S3 data
lake has nothing yet, so this is runnable the same day Phase 0 lands, before
a full day's worth of Gold partitions exist.

Run:
    python launch_training_job.py --role-arn arn:aws:iam::<account>:role/rams-elec-sagemaker-execution

Requires: pip install sagemaker boto3 (see requirements-sagemaker.txt)
"""

import argparse
import io
import logging
import os
import sys
from datetime import datetime, timezone

import boto3
import pandas as pd
from sklearn.model_selection import train_test_split

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))  # services/triage/
from feature_encoding import FEATURE_COLS, encode_features  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("launch_training_job")

TARGET_COL = "actual_cost"


def _load_gold_from_s3(bucket: str, prefix: str, region: str) -> pd.DataFrame:
    """Read every Gold Parquet partition under s3://{bucket}/{prefix}/ and
    concatenate them. Uses boto3 + pyarrow directly rather than the Glue
    table, so this has no dependency on the crawler having run yet.
    """
    s3 = boto3.client("s3", region_name=region)
    paginator = s3.get_paginator("list_objects_v2")
    frames = []

    for page in paginator.paginate(Bucket=bucket, Prefix=f"{prefix}/"):
        for obj in page.get("Contents", []):
            if not obj["Key"].endswith(".parquet"):
                continue
            body = s3.get_object(Bucket=bucket, Key=obj["Key"])["Body"].read()
            frames.append(pd.read_parquet(io.BytesIO(body), engine="pyarrow"))

    if not frames:
        return pd.DataFrame()

    return pd.concat(frames, ignore_index=True)


def _load_gold_from_postgres(database_url: str) -> pd.DataFrame:
    """Fallback when the S3 data lake has no partitions yet — reuses the
    same gold_jobs table train_model.py reads locally."""
    from sqlalchemy import create_engine, text

    engine = create_engine(database_url)
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT * FROM gold_jobs WHERE actual_cost IS NOT NULL")
        )
        rows = result.fetchall()
        columns = result.keys()
    return pd.DataFrame(rows, columns=columns) if rows else pd.DataFrame()


def prepare_data(args: argparse.Namespace) -> tuple[pd.DataFrame, pd.DataFrame, str]:
    df = pd.DataFrame()
    source = "none"

    if args.bucket:
        df = _load_gold_from_s3(args.bucket, args.gold_prefix, args.region)
        source = f"s3://{args.bucket}/{args.gold_prefix}/"

    if df.empty and args.database_url:
        logger.info("No S3 Gold partitions found — falling back to Postgres gold_jobs")
        df = _load_gold_from_postgres(args.database_url)
        source = "postgres:gold_jobs"

    if df.empty:
        raise RuntimeError(
            "No training data available from S3 or Postgres. Run the ETL "
            "pipeline (or generate_seed_data.py) at least once before launching "
            "a SageMaker training job."
        )

    if (
        "service_category" in df.columns
        and "service_category_encoded" not in df.columns
    ):
        df = encode_features(df)

    missing = [c for c in FEATURE_COLS if c not in df.columns]
    if missing:
        raise RuntimeError(f"Gold data is missing expected feature columns: {missing}")

    df = df[FEATURE_COLS + [TARGET_COL]].dropna(subset=[TARGET_COL])
    logger.info(f"Loaded {len(df)} labelled rows from {source}")

    train_df, test_df = train_test_split(df, test_size=0.2, random_state=42)
    return train_df, test_df, source


def upload_channels(
    bucket: str, region: str, train_df: pd.DataFrame, test_df: pd.DataFrame
) -> tuple[str, str]:
    """Write train/test CSVs to S3 under a timestamped prefix and return the
    two channel URIs the Estimator will read from."""
    s3 = boto3.client("s3", region_name=region)
    run_ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    base = f"sagemaker/input/{run_ts}"

    for name, frame in (("train", train_df), ("test", test_df)):
        buf = io.StringIO()
        frame.to_csv(buf, index=False)
        s3.put_object(
            Bucket=bucket,
            Key=f"{base}/{name}/{name}.csv",
            Body=buf.getvalue(),
            ServerSideEncryption="AES256",
        )

    return f"s3://{bucket}/{base}/train/", f"s3://{bucket}/{base}/test/"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bucket", default=os.getenv("RAMS_ELEC_ARTIFACTS_BUCKET"))
    parser.add_argument("--gold-prefix", default=os.getenv("GOLD_S3_PREFIX", "gold"))
    parser.add_argument("--region", default=os.getenv("AWS_REGION", "af-south-1"))
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    parser.add_argument(
        "--role-arn",
        required=True,
        help="terraform output sagemaker_execution_role_arn",
    )
    parser.add_argument("--model-package-group", default="rams-elec-quote-estimator")
    parser.add_argument("--instance-type", default="ml.m5.large")
    parser.add_argument(
        "--wait",
        action="store_true",
        help="Block until the training job finishes (default: submit and exit).",
    )
    args = parser.parse_args()

    if not args.bucket:
        raise SystemExit(
            "No bucket configured. Pass --bucket or set RAMS_ELEC_ARTIFACTS_BUCKET "
            "(terraform output artifacts_bucket)."
        )

    train_df, test_df, source = prepare_data(args)
    train_uri, test_uri = upload_channels(args.bucket, args.region, train_df, test_df)
    logger.info(f"Uploaded training channels: {train_uri} / {test_uri}")

    # Imported here, not at module top — sagemaker is a heavy optional
    # dependency (requirements-sagemaker.txt) that nothing else in this file
    # needs until this exact point.
    import sagemaker
    from sagemaker.inputs import TrainingInput
    from sagemaker.xgboost.estimator import XGBoost

    session = sagemaker.Session(boto_session=boto3.Session(region_name=args.region))

    estimator = XGBoost(
        entry_point="train.py",
        source_dir=os.path.dirname(__file__),
        framework_version="1.7-1",
        instance_type=args.instance_type,
        instance_count=1,
        role=args.role_arn,
        sagemaker_session=session,
        hyperparameters={
            "n-estimators": 200,
            "max-depth": 6,
            "learning-rate": 0.05,
            "subsample": 0.8,
            "colsample-bytree": 0.8,
            "min-child-weight": 3,
            "reg-alpha": 0.1,
            "reg-lambda": 1.0,
        },
        # A single m5.large training job here runs a few minutes on a few
        # hundred rows — max_run is a backstop against a hung job billing
        # for hours, not a tuning knob.
        max_run=1800,
        tags=[{"Key": "Project", "Value": "Rams @Elec Intelligence Platform"}],
    )

    estimator.fit(
        {
            "train": TrainingInput(train_uri, content_type="text/csv"),
            "test": TrainingInput(test_uri, content_type="text/csv"),
        },
        wait=args.wait,
        logs=args.wait,
    )

    if not args.wait:
        logger.info(
            f"Training job '{estimator.latest_training_job.name}' submitted "
            "without waiting (--wait not set). Registration is skipped — "
            "run again with --wait, or register manually once it completes."
        )
        return

    model_package = estimator.register(
        content_types=["text/csv"],
        response_types=["text/csv"],
        inference_instances=["ml.m5.large"],
        transform_instances=["ml.m5.large"],
        model_package_group_name=args.model_package_group,
        approval_status="PendingManualApproval",
        description=f"Trained on {len(train_df) + len(test_df)} rows from {source}",
    )
    logger.info(f"Registered model package: {model_package.model_package_arn}")


if __name__ == "__main__":
    main()
