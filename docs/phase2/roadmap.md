# Phase 2 Roadmap

Features documented but NOT built — deferred because they require data infrastructure the client doesn't yet have.

---

## Feature 1: IoT Predictive Maintenance Hub

### Why Deferred
Rams @Elec has no sensors installed at client premises. Training on fabricated sensor data would have no real-world validity and would be misleading to demonstrate.

> **Partially superseded by Module 10** (`docs/followup-agent.md`). The goal behind this feature
> — knowing which equipment is likely to fail again — needs a *failure label*, not necessarily
> sensors. A customer answering "no, it's not working" days after a repair is that label,
> gathered through a channel the business already uses.
>
> This does not make the IoT hub unnecessary. Sensor telemetry is continuous, objective and
> high-resolution; customer reports are sparse, subjective and response-biased. Module 10 buys a
> real label at the cost of precision, which makes this feature **non-blocking** rather than
> obsolete.

### Architecture When Ready
- **Data Ingestion**: MQTT broker receiving streams from IoT sensors (temperature, vibration, current draw, humidity) installed on client cold rooms, generators, and HVAC units
- **Storage**: New `sensor_readings` table in PostgreSQL with timescale partitioning
- **Anomaly Detection**: Isolation Forest model trained on normal operating baselines, detecting deviations that precede equipment failure
- **Prediction**: Survival analysis (Cox proportional hazards) for time-to-failure estimation
- **Integration**: Anomaly scores flow into Gold layer → Streamlit dashboard shows equipment health scores → n8n triggers preemptive maintenance alerts via WhatsApp
- **Model Retraining**: Airflow DAG retrains anomaly detection weekly as new sensor data accumulates

---

## Feature 2: Computer Vision Fault Detection

### Why Deferred
No labeled training dataset of electrical/refrigeration fault images exists. A demo using generic pre-trained models (e.g., ImageNet weights) would produce meaningless results on domain-specific equipment faults.

### Architecture When Ready
- **Image Capture**: Mobile app or portal upload for technicians to photograph equipment during inspections
- **Model**: Fine-tuned ResNet-50 or YOLOv8 on a labeled dataset of common fault types (corroded terminals, burnt contactors, iced evaporator coils, oil leaks, belt wear)
- **Training Pipeline**: Labeled images stored in `inspection_images` table → Airflow DAG triggers fine-tuning → model artifacts tracked in MLflow
- **Inference**: New CV microservice (FastAPI) accepts image uploads → returns fault probability scores + bounding boxes
- **Integration**: Fault detection results linked to job records → triggers dispatch recommendations → feeds equipment health dashboard

---

## Feature 3: GPS-Based Smart Dispatch Routing

### Why Deferred
Requires real-time GPS data from technician mobile devices. No tracking infrastructure exists — Rams @Elec technicians currently use phone calls for coordination.

### Architecture When Ready
- **GPS Ingestion**: Mobile app sends periodic location pings to a new `technician_locations` table
- **Route Optimization**: Google Maps Directions API or OR-Tools constraint solver computes optimal technician routes considering:
  - Real-time traffic
  - Technician skillset match to job requirements
  - Current location proximity
  - Job urgency weighting
- **Integration**: Dispatch FastAPI enhanced with `/dispatch/optimize-route` endpoint → returns ordered job sequence with ETAs → technician mobile view shows turn-by-turn directions
- **Dashboard**: Admin map view showing real-time technician positions and job statuses

---

## Feature 4: Full SANS Compliance Automation

### Why Deferred
Certificates of Compliance (COC) are legal documents under South African law (Occupational Health and Safety Act, Electrical Installation Regulations). Only a registered electrical contractor may issue a valid COC. Auto-generation creates legal liability.

### What's Built Instead (Phase 1)
Document preparation assistant that pre-populates COC templates with customer data, watermarked "DRAFT — Requires Registered Electrician Signature."

### Architecture When Ready
- **Digital COC Workflow**: Registered electrician reviews AI-prepared draft within the portal → digitally signs using SAQA-recognised e-signature provider → final PDF generated with signature + timestamp
- **Compliance Checklist**: Interactive SANS 10142 checklist embedded in portal → electrician confirms each item → system auto-generates COC sections
- **Audit Trail**: Every COC version stored with full history → who prepared, who reviewed, who signed, timestamps
- **Renewal Tracking**: Airflow DAG monitors COC expiry dates → n8n triggers renewal reminders 90/60/30 days before expiry
