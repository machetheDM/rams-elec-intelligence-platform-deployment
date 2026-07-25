"""
PostgreSQL Loader for Rams @Elec ETL Pipeline.

Uses SQLAlchemy (not Prisma) for the ETL service layer.
Idempotent upserts — running the pipeline twice does not create duplicates.
"""

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from datetime import datetime
from typing import Optional
import os


class PostgresLoader:
    """Load transformed data into PostgreSQL with idempotent upserts."""

    def __init__(self, database_url: Optional[str] = None):
        self.database_url = database_url or os.getenv("DATABASE_URL")
        if not self.database_url:
            raise ValueError("DATABASE_URL not provided and not set in environment")
        self.engine: Engine = create_engine(self.database_url)

    def _upsert_customers(self, df: pd.DataFrame) -> int:
        """Upsert customers — match on phone number."""
        if df.empty:
            return 0

        count = 0
        with self.engine.begin() as conn:
            for _, row in df.iterrows():
                phone = row.get("customer_phone")
                if not phone or pd.isna(phone):
                    continue

                result = conn.execute(
                    text("SELECT id FROM customers WHERE phone = :phone"),
                    {"phone": phone},
                ).fetchone()

                if result:
                    conn.execute(
                        text("""
                            UPDATE customers
                            SET name = :name, email = :email, address = :address,
                                area_zone = :area_zone, updated_at = NOW()
                            WHERE id = :id
                        """),
                        {
                            "id": result[0],
                            "name": row.get("customer_name", "Unknown"),
                            "email": row.get("email"),
                            "address": row.get("address"),
                            "area_zone": row.get("area_zone"),
                        },
                    )
                else:
                    conn.execute(
                        text("""
                            INSERT INTO customers (name, email, phone, address, area_zone)
                            VALUES (:name, :email, :phone, :address, :area_zone)
                        """),
                        {
                            "name": row.get("customer_name", "Unknown"),
                            "email": row.get("email"),
                            "phone": phone,
                            "address": row.get("address"),
                            "area_zone": row.get("area_zone", "Unknown"),
                        },
                    )
                count += 1
        return count

    def _upsert_jobs(self, df: pd.DataFrame) -> int:
        """Upsert jobs — match on customer + date + service type combination."""
        if df.empty:
            return 0

        count = 0
        with self.engine.begin() as conn:
            for _, row in df.iterrows():
                customer_name = row.get("customer_name")
                job_date = row.get("job_date")
                service_type = row.get("service_type")

                if pd.isna(customer_name) or pd.isna(job_date):
                    continue

                # Find customer ID
                phone = row.get("customer_phone")
                cust_result = None
                if phone and not pd.isna(phone):
                    cust_result = conn.execute(
                        text(
                            "SELECT id, area_zone FROM customers WHERE phone = :phone"
                        ),
                        {"phone": phone},
                    ).fetchone()

                if not cust_result:
                    continue

                customer_id = cust_result[0]
                area_zone = row.get("area_zone") or cust_result[1]

                # Find service type ID by name match
                svc_result = conn.execute(
                    text("SELECT id FROM service_types WHERE name ILIKE :name LIMIT 1"),
                    {"name": f"%{service_type}%"},
                ).fetchone()

                service_type_id = svc_result[0] if svc_result else None

                # Check for existing job
                existing = conn.execute(
                    text("""
                        SELECT id FROM jobs
                        WHERE customer_id = :customer_id
                          AND DATE(scheduled_date) = DATE(:scheduled_date)
                          AND service_type_id = :service_type_id
                        LIMIT 1
                    """),
                    {
                        "customer_id": customer_id,
                        "scheduled_date": str(job_date)[:10] if job_date else None,
                        "service_type_id": service_type_id,
                    },
                ).fetchone()

                cost_val = row.get("cost_clean") or row.get("cost")
                if existing:
                    conn.execute(
                        text("""
                            UPDATE jobs
                            SET quoted_cost = COALESCE(:quoted_cost, quoted_cost),
                                actual_cost = COALESCE(:actual_cost, actual_cost),
                                job_notes = COALESCE(:job_notes, job_notes)
                            WHERE id = :id
                        """),
                        {
                            "id": existing[0],
                            "quoted_cost": (
                                float(cost_val)
                                if cost_val and not pd.isna(cost_val)
                                else None
                            ),
                            "actual_cost": (
                                float(cost_val)
                                if cost_val and not pd.isna(cost_val)
                                else None
                            ),
                            "job_notes": row.get("job_notes"),
                        },
                    )
                else:
                    conn.execute(
                        text("""
                            INSERT INTO jobs (customer_id, service_type_id, status, urgency,
                                              area_zone, scheduled_date, quoted_cost, job_notes)
                            VALUES (:customer_id, :service_type_id, 'complete', 'medium',
                                    :area_zone, :scheduled_date, :quoted_cost, :job_notes)
                        """),
                        {
                            "customer_id": customer_id,
                            "service_type_id": service_type_id,
                            "area_zone": area_zone,
                            "scheduled_date": str(job_date)[:10] if job_date else None,
                            "quoted_cost": (
                                float(cost_val)
                                if cost_val and not pd.isna(cost_val)
                                else None
                            ),
                            "job_notes": row.get("job_notes"),
                        },
                    )
                count += 1
        return count

    def load_errors(self, errors: list[dict]) -> int:
        """Load validation errors into etl_error_log table."""
        if not errors:
            return 0

        with self.engine.begin() as conn:
            for err in errors:
                conn.execute(
                    text("""
                        INSERT INTO etl_error_log (source_file, row_index, field_name,
                                                   raw_value, error_type, error_message)
                        VALUES (:source_file, :row_index, :field_name,
                                :raw_value, :error_type, :error_message)
                    """),
                    err,
                )
        return len(errors)

    def load_gold_data(self, df: pd.DataFrame) -> dict:
        """Load Gold layer data into PostgreSQL for ML consumption.

        Stores in a dedicated gold_jobs table (created if not exists).
        """
        if df.empty:
            return {"jobs_loaded": 0}

        with self.engine.begin() as conn:
            # Ensure gold table exists
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS gold_jobs (
                    id SERIAL PRIMARY KEY,
                    service_category TEXT,
                    service_category_encoded INTEGER,
                    urgency_flag INTEGER,
                    area_zone TEXT,
                    area_zone_encoded INTEGER,
                    area_zone_group TEXT,
                    equipment_age_years FLOAT,
                    job_duration_days FLOAT,
                    cost_per_hour FLOAT,
                    month INTEGER,
                    day_of_week INTEGER,
                    is_weekend INTEGER,
                    quarter INTEGER,
                    actual_cost FLOAT,
                    _gold_processed_at TIMESTAMP,
                    _source_file TEXT
                )
            """))

            # Truncate and reload (Gold is rebuilt each run)
            conn.execute(text("TRUNCATE gold_jobs"))

            gold_cols = [
                "service_category",
                "service_category_encoded",
                "urgency_flag",
                "area_zone",
                "area_zone_encoded",
                "area_zone_group",
                "equipment_age_years",
                "job_duration_days",
                "cost_per_hour",
                "month",
                "day_of_week",
                "is_weekend",
                "quarter",
            ]
            available = [c for c in gold_cols if c in df.columns]

            count = 0
            for _, row in df.iterrows():
                values = {c: row.get(c) for c in available}
                values["actual_cost"] = row.get("actual_cost") or row.get("cost_clean")
                values["_gold_processed_at"] = datetime.now()
                values["_source_file"] = row.get("_source_file", "unknown")

                # Build dynamic INSERT
                cols = ", ".join(values.keys())
                placeholders = ", ".join(f":{k}" for k in values.keys())
                conn.execute(
                    text(f"INSERT INTO gold_jobs ({cols}) VALUES ({placeholders})"),
                    {k: v if not pd.isna(v) else None for k, v in values.items()},
                )
                count += 1

        return {"gold_jobs_loaded": count}

    def close(self):
        """Dispose the database engine."""
        self.engine.dispose()
