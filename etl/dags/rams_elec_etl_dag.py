"""
Airflow DAG: Rams @Elec ETL Pipeline

Schedule: manual trigger for initial load, then weekly incremental runs.
Tasks: extract → validate → transform_bronze → transform_silver → transform_gold → load

Usage:
    airflow dags trigger rams_elec_etl
    airflow dags trigger rams_elec_etl --conf '{"mode": "full"}'
"""

from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.email import EmailOperator
from airflow.models import Variable
import sys
import os

# Add etl directory to path
ETL_PATH = os.path.join(os.path.dirname(__file__), "..", "..")
sys.path.insert(0, ETL_PATH)

from extractors.excel import ExcelExtractor
from extractors.pdf import PDFExtractor
from extractors.validator import DataValidator
from transformers.bronze import BronzeTransformer
from transformers.silver import SilverTransformer
from transformers.gold import GoldTransformer
from loaders.postgres_loader import PostgresLoader

default_args = {
    "owner": "ramsatelec",
    "depends_on_past": False,
    "email_on_failure": True,
    "email_on_retry": False,
    "email": ["ops@ramsatelec.co.za"],
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="rams_elec_etl",
    default_args=default_args,
    description="Rams @Elec ETL Pipeline — Bronze → Silver → Gold",
    schedule_interval=None,  # Manual trigger for initial load
    start_date=datetime(2026, 7, 1),
    catchup=False,
    tags=["ramsatelec", "etl"],
) as dag:

    def extract_excel(**context):
        """Extract job records from Excel/CSV files."""
        data_dir = Variable.get("etl_data_dir", "/opt/airflow/data")
        extractor = ExcelExtractor()
        all_dfs = []

        for f in os.listdir(data_dir):
            if f.endswith((".xlsx", ".xls", ".csv")):
                filepath = os.path.join(data_dir, f)
                try:
                    df = extractor.extract(filepath)
                    all_dfs.append(df)
                    print(f"Extracted {len(df)} rows from {f}")
                except Exception as e:
                    print(f"ERROR extracting {f}: {e}")

        if all_dfs:
            import pandas as pd

            combined = pd.concat(all_dfs, ignore_index=True)
            context["task_instance"].xcom_push(
                key="excel_data", value=combined.to_dict()
            )
            print(f"Total extracted: {len(combined)} rows")
        else:
            context["task_instance"].xcom_push(key="excel_data", value={})
            print("No Excel/CSV files found")

    def extract_pdfs(**context):
        """Extract job cards from PDF files."""
        data_dir = Variable.get("etl_data_dir", "/opt/airflow/data")
        extractor = PDFExtractor()
        pdf_dir = os.path.join(data_dir, "pdfs")
        if os.path.exists(pdf_dir):
            records = extractor.extract_batch(pdf_dir)
            context["task_instance"].xcom_push(key="pdf_data", value=records)
            print(f"Extracted {len(records)} PDF records")
        else:
            context["task_instance"].xcom_push(key="pdf_data", value=[])
            print("No PDF directory found")

    def validate(**context):
        """Validate extracted records."""
        ti = context["task_instance"]
        import pandas as pd

        excel_data = ti.xcom_pull(key="excel_data", task_ids="extract_excel")
        pdf_data = ti.xcom_pull(key="pdf_data", task_ids="extract_pdfs")

        validator = DataValidator()
        valid_records = []
        error_records = []

        # Validate Excel data
        if excel_data:
            df = pd.DataFrame.from_dict(excel_data)
            valid, errors = validator.validate_job_records(df)
            if not valid.empty:
                valid_records.append(valid)
            if not errors.empty:
                error_records.append(errors)

        # Validate PDF data
        if pdf_data:
            for rec in pdf_data:
                if rec.get("_extraction_status") == "failed":
                    validator._add_error(
                        rec.get("_source_file", "unknown"),
                        None,
                        None,
                        None,
                        "extraction",
                        rec.get("_error", "PDF extraction failed"),
                    )

        # Push results
        if valid_records:
            import pandas as pd

            combined = pd.concat(valid_records, ignore_index=True)
            ti.xcom_push(key="valid_data", value=combined.to_dict())
            print(f"Valid records: {len(combined)}")
        else:
            ti.xcom_push(key="valid_data", value={})

        ti.xcom_push(key="validation_errors", value=validator.errors)
        print(f"Validation errors: {len(validator.errors)}")
        print(validator.get_error_summary())

    def transform_bronze(**context):
        """Transform valid data to Bronze layer."""
        ti = context["task_instance"]
        import pandas as pd

        valid_data = ti.xcom_pull(key="valid_data", task_ids="validate")
        if not valid_data:
            print("No valid data to transform")
            return

        df = pd.DataFrame.from_dict(valid_data)
        transformer = BronzeTransformer()
        bronze = transformer.transform_jobs(df)
        ti.xcom_push(key="bronze_data", value=bronze.to_dict())
        print(f"Bronze records: {len(bronze)}")

    def transform_silver(**context):
        """Transform Bronze to Silver layer."""
        ti = context["task_instance"]
        import pandas as pd

        bronze_data = ti.xcom_pull(key="bronze_data", task_ids="transform_bronze")
        if not bronze_data:
            print("No bronze data to transform")
            return

        bronze_df = pd.DataFrame.from_dict(bronze_data)
        transformer = SilverTransformer()
        silver = transformer.transform(bronze_df)
        ti.xcom_push(key="silver_data", value=silver.to_dict())
        print(f"Silver records: {len(silver)}")

    def transform_gold(**context):
        """Transform Silver to Gold layer with ML features."""
        ti = context["task_instance"]
        import pandas as pd

        silver_data = ti.xcom_pull(key="silver_data", task_ids="transform_silver")
        if not silver_data:
            print("No silver data to transform")
            return

        silver_df = pd.DataFrame.from_dict(silver_data)
        transformer = GoldTransformer()
        gold = transformer.transform(silver_df)
        ti.xcom_push(key="gold_data", value=gold.to_dict())
        print(f"Gold records: {len(gold)}")

    def load_to_db(**context):
        """Load data into PostgreSQL."""
        ti = context["task_instance"]
        import pandas as pd

        # Load validation errors
        errors = ti.xcom_pull(key="validation_errors", task_ids="validate")
        loader = PostgresLoader()
        if errors:
            count = loader.load_errors(errors)
            print(f"Loaded {count} validation errors")

        # Load customers and jobs from Silver
        silver_data = ti.xcom_pull(key="silver_data", task_ids="transform_silver")
        if silver_data:
            silver_df = pd.DataFrame.from_dict(silver_data)
            cust_count = loader._upsert_customers(silver_df)
            job_count = loader._upsert_jobs(silver_df)
            print(f"Upserted {cust_count} customers, {job_count} jobs")

        # Load Gold data
        gold_data = ti.xcom_pull(key="gold_data", task_ids="transform_gold")
        if gold_data:
            gold_df = pd.DataFrame.from_dict(gold_data)
            result = loader.load_gold_data(gold_df)
            print(f"Gold load result: {result}")

        loader.close()

    def on_failure_alert(**context):
        """Send alert on pipeline failure."""
        task_instance = context["task_instance"]
        print(f"ALERT: Task {task_instance.task_id} failed!")
        print(f"Log: {task_instance.log_url}")

    # Define task dependencies
    extract_excel_task = PythonOperator(
        task_id="extract_excel",
        python_callable=extract_excel,
    )

    extract_pdfs_task = PythonOperator(
        task_id="extract_pdfs",
        python_callable=extract_pdfs,
    )

    validate_task = PythonOperator(
        task_id="validate",
        python_callable=validate,
    )

    transform_bronze_task = PythonOperator(
        task_id="transform_bronze",
        python_callable=transform_bronze,
    )

    transform_silver_task = PythonOperator(
        task_id="transform_silver",
        python_callable=transform_silver,
    )

    transform_gold_task = PythonOperator(
        task_id="transform_gold",
        python_callable=transform_gold,
    )

    load_task = PythonOperator(
        task_id="load_to_db",
        python_callable=load_to_db,
    )

    alert_task = PythonOperator(
        task_id="on_failure_alert",
        python_callable=on_failure_alert,
        trigger_rule="one_failed",
    )

    # DAG structure
    [extract_excel_task, extract_pdfs_task] >> validate_task >> transform_bronze_task
    transform_bronze_task >> transform_silver_task >> transform_gold_task >> load_task
    [
        validate_task,
        transform_bronze_task,
        transform_silver_task,
        transform_gold_task,
        load_task,
    ] >> alert_task
