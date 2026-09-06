"""
SageMaker script-mode training entrypoint — Quote Estimator (XGBoost).

Runs *inside* the AWS-managed SageMaker XGBoost container, invoked by
launch_training_job.py's `sagemaker.xgboost.estimator.XGBoost.fit()`.

Deliberately dumb: it does no encoding, no ETL, no database access. All of
that (Gold layer -> encode_features -> train/test split -> CSV upload)
happens in launch_training_job.py *before* the training job is submitted, so
this script only ever sees already-numeric CSVs. That keeps train_model.py's
local path and this SageMaker path both training on features produced by the
same feature_encoding.py, without needing that module (or a database
connection) to exist inside the training container.

SageMaker conventions this follows:
  - hyperparameters arrive as --flag CLI args (SM_HP_* env vars are mapped by
    the container itself)
  - training/test data arrive as local files under SM_CHANNEL_<name>
  - the model artifact must be written to SM_MODEL_DIR — SageMaker tars
    everything under it into model.tar.gz and uploads it to S3 automatically
"""

import argparse
import json
import os

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()

    # Mirrors services/triage/train_model.py's params exactly, so the two
    # training paths are comparable — a difference in MAE/R² should mean
    # different data or infra, not different hyperparameters.
    parser.add_argument("--n-estimators", type=int, default=200)
    parser.add_argument("--max-depth", type=int, default=6)
    parser.add_argument("--learning-rate", type=float, default=0.05)
    parser.add_argument("--subsample", type=float, default=0.8)
    parser.add_argument("--colsample-bytree", type=float, default=0.8)
    parser.add_argument("--min-child-weight", type=int, default=3)
    parser.add_argument("--reg-alpha", type=float, default=0.1)
    parser.add_argument("--reg-lambda", type=float, default=1.0)

    parser.add_argument(
        "--model-dir", type=str, default=os.environ.get("SM_MODEL_DIR", "/opt/ml/model")
    )
    parser.add_argument(
        "--train",
        type=str,
        default=os.environ.get("SM_CHANNEL_TRAIN", "/opt/ml/input/data/train"),
    )
    parser.add_argument(
        "--test",
        type=str,
        default=os.environ.get("SM_CHANNEL_TEST", "/opt/ml/input/data/test"),
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    train_df = pd.read_csv(os.path.join(args.train, "train.csv"))
    test_df = pd.read_csv(os.path.join(args.test, "test.csv"))

    target_col = "actual_cost"
    feature_cols = [c for c in train_df.columns if c != target_col]

    X_train, y_train = train_df[feature_cols], train_df[target_col]
    X_test, y_test = test_df[feature_cols], test_df[target_col]

    model = xgb.XGBRegressor(
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        learning_rate=args.learning_rate,
        subsample=args.subsample,
        colsample_bytree=args.colsample_bytree,
        min_child_weight=args.min_child_weight,
        reg_alpha=args.reg_alpha,
        reg_lambda=args.reg_lambda,
        objective="reg:squarederror",
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    mae = float(mean_absolute_error(y_test, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    r2 = float(r2_score(y_test, y_pred))

    print(f"MAE={mae:.2f} RMSE={rmse:.2f} R2={r2:.4f}")
    print(f"feature_cols={feature_cols}")

    # SageMaker tars everything under model-dir into model.tar.gz and uploads
    # it to the S3 output path automatically — nothing here calls S3 directly.
    model.save_model(os.path.join(args.model_dir, "xgb_quote_estimator.pkl"))

    with open(os.path.join(args.model_dir, "feature_columns.json"), "w") as f:
        json.dump(feature_cols, f)

    # Mirrors train_model.py's metrics.json shape closely enough that the CI
    # regression check (sagemaker-train.yml) can read either with the same
    # field names.
    with open(os.path.join(args.model_dir, "metrics.json"), "w") as f:
        json.dump(
            {
                "mae": round(mae, 2),
                "rmse": round(rmse, 2),
                "r2": round(r2, 4),
                "training_samples": int(len(X_train)),
                "test_samples": int(len(X_test)),
                "data_source": "sagemaker_training_job",
            },
            f,
            indent=2,
        )


if __name__ == "__main__":
    main()
