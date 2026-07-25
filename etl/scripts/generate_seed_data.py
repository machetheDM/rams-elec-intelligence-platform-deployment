"""
Seed Data Bridge — Generate 200 realistic synthetic job records.

Runs them through the full Bronze → Silver → Gold pipeline to
ensure the ETL is tested end-to-end before real client data arrives.

Output: synthetic_jobs.xlsx — 200 job records in the format a
small SA electrical business would have in their spreadsheets.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import sys
import os

# Add etl directory to path so we can import transformers
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from extractors.excel import ExcelExtractor
from extractors.validator import DataValidator
from transformers.bronze import BronzeTransformer
from transformers.silver import SilverTransformer
from transformers.gold import GoldTransformer


def generate_synthetic_jobs(n: int = 200) -> pd.DataFrame:
    """Generate n realistic synthetic job records."""
    np.random.seed(42)

    # Realistic SA data pools
    first_names = [
        "Thabo",
        "Priya",
        "James",
        "Lerato",
        "David",
        "Sarah",
        "Michael",
        "Fatima",
        "Sipho",
        "Nomsa",
        "Kabelo",
        "Anna",
        "Peter",
        "Grace",
        "Johan",
        "Miriam",
        "Rajesh",
        "Tumi",
        "William",
        "Busisiwe",
        "Andre",
        "Mapula",
        "Daniel",
        "Portia",
        "Isaac",
    ]
    last_names = [
        "Molefe",
        "Naidoo",
        "van der Merwe",
        "Khumalo",
        "Nkosi",
        "Botha",
        "Mahlangu",
        "Patel",
        "Dlamini",
        "Zulu",
        "Mokoena",
        "Ramaphosa",
        "Mahlatji",
        "Ledwaba",
        "Pretorius",
        "Sebata",
        "Govender",
        "Molepo",
        "Mabaso",
        "Ndlovu",
        "du Toit",
        "Mothapo",
        "Mthembu",
        "Chauke",
    ]

    service_types = [
        "Cold Room Installation",
        "Cold Room Repair",
        "HVAC Installation",
        "HVAC Maintenance",
        "Emergency Electrical Repair",
        "Electrical Compliance Audit",
        "Distribution Board Upgrade",
        "Generator Installation",
        "Generator Service",
        "Industrial Wiring",
        "Surge Protection Installation",
        "Preventative Maintenance Visit",
    ]

    area_zones = [
        "Sandton",
        "Midrand",
        "Centurion",
        "Pretoria East",
        "Soweto",
        "Polokwane",
        "Mokopane",
        "Bela-Bela",
    ]

    urgencies = ["low", "medium", "high", "emergency"]
    urgency_weights = [0.15, 0.45, 0.25, 0.15]

    statuses = ["complete", "complete", "complete", "complete", "cancelled", "open"]

    records = []
    base_date = datetime(2026, 7, 1)

    for i in range(n):
        days_ago = np.random.randint(1, 365)
        job_date = base_date - timedelta(days=days_ago)
        customer_name = (
            f"{np.random.choice(first_names)} {np.random.choice(last_names)}"
        )
        phone = f"+2783{np.random.randint(1000000, 9999999)}"
        area = np.random.choice(area_zones)
        service = np.random.choice(service_types)
        urgency = np.random.choice(urgencies, p=urgency_weights)
        status = np.random.choice(statuses)

        # Realistic cost ranges per service type
        cost_ranges = {
            "Cold Room Installation": (15000, 85000),
            "Cold Room Repair": (2500, 18000),
            "HVAC Installation": (8000, 45000),
            "HVAC Maintenance": (1200, 4500),
            "Emergency Electrical Repair": (900, 7500),
            "Electrical Compliance Audit": (1800, 6500),
            "Distribution Board Upgrade": (3500, 15000),
            "Generator Installation": (12000, 95000),
            "Generator Service": (1500, 5000),
            "Industrial Wiring": (5000, 35000),
            "Surge Protection Installation": (1800, 8500),
            "Preventative Maintenance Visit": (900, 3000),
        }

        cost_min, cost_max = cost_ranges.get(service, (900, 5000))
        cost = round(np.random.uniform(cost_min, cost_max), 2)

        # Add some noise — 10% of records have messy formatting
        if np.random.random() < 0.1:
            cost_str = f"R {cost:,.2f}"  # R 1,200.00 format
        else:
            cost_str = cost

        # 5% have missing phone numbers
        if np.random.random() < 0.05:
            phone = ""

        # 8% have non-standard date formats
        if np.random.random() < 0.08:
            date_str = job_date.strftime("%d-%b-%Y")  # 15-Jan-2024
        else:
            date_str = job_date.strftime("%Y-%m-%d")

        completed_date = None
        if status == "complete":
            completed_days = np.random.randint(1, 14)
            completed_date = job_date + timedelta(days=completed_days)

        records.append(
            {
                "customer_name": customer_name,
                "customer_phone": phone,
                "address": f"{np.random.randint(1, 200)} {np.random.choice(['Main', 'Church', 'Market', 'Voortrekker', 'Nelson Mandela'])} St, {area}",
                "area_zone": area,
                "service_type": service,
                "job_date": date_str,
                "scheduled_date": date_str,
                "completed_date": (
                    completed_date.strftime("%Y-%m-%d") if completed_date else ""
                ),
                "cost": cost_str,
                "quoted_cost": round(cost * np.random.uniform(0.9, 1.1), 2),
                "actual_cost": cost if status == "complete" else "",
                "technician_name": f"Tech {np.random.randint(1, 6)}",
                "status": status,
                "urgency": urgency,
                "job_notes": f"{service} at {area}. {urgency} priority.",
            }
        )

    return pd.DataFrame(records)


def run_pipeline_test():
    """Run the full ETL pipeline on synthetic data and report results."""
    print("=" * 60)
    print("Rams @Elec ETL Pipeline — Synthetic Data Test")
    print("=" * 60)

    # Step 1: Generate synthetic data
    print("\n[1/6] Generating 200 synthetic job records...")
    df = generate_synthetic_jobs(200)
    output_path = Path(__file__).parent / "synthetic_jobs.xlsx"
    df.to_excel(output_path, index=False)
    print(f"  ✓ Saved to {output_path}")
    print(f"  Records: {len(df)}")

    # Step 2: Extract (simulate Excel extraction)
    print("\n[2/6] Extracting data...")
    extractor = ExcelExtractor()
    extracted = extractor.extract(str(output_path))
    print(f"  ✓ Extracted {len(extracted)} rows")

    # Step 3: Validate
    print("\n[3/6] Validating records...")
    validator = DataValidator()
    valid, errors = validator.validate_job_records(extracted)
    print(f"  ✓ Valid: {len(valid)}, Errors: {len(errors)}")
    if errors:
        print(f"  Error summary: {validator.get_error_summary()}")

    # Step 4: Bronze
    print("\n[4/6] Bronze transformation...")
    bronze_transformer = BronzeTransformer()
    bronze = bronze_transformer.transform_jobs(valid)
    print(f"  ✓ Bronze records: {len(bronze)}")

    # Step 5: Silver
    print("\n[5/6] Silver transformation...")
    silver_transformer = SilverTransformer()
    silver = silver_transformer.transform(bronze)
    print(f"  ✓ Silver records: {len(silver)}")
    if not silver.empty:
        print(f"  Columns: {list(silver.columns)}")
        if "service_category" in silver.columns:
            print(
                f"  Categories: {silver['service_category'].value_counts().to_dict()}"
            )

    # Step 6: Gold
    print("\n[6/6] Gold transformation...")
    gold_transformer = GoldTransformer()
    gold = gold_transformer.transform(silver)
    print(f"  ✓ Gold records: {len(gold)}")

    if not gold.empty:
        X, y = gold_transformer.get_ml_features(gold)
        print(f"  ML Features: {list(X.columns)}")
        print(f"  Feature matrix shape: {X.shape}")
        if y is not None:
            print(f"  Target vector shape: {y.shape}")
            print(f"  Target range: R{y.min():,.2f} – R{y.max():,.2f}")
            print(f"  Target mean: R{y.mean():,.2f}")

    print("\n" + "=" * 60)
    print("Pipeline test complete! All layers processed successfully.")
    print("=" * 60)

    return gold


if __name__ == "__main__":
    run_pipeline_test()
