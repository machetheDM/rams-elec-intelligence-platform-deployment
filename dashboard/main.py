"""
Rams @Elec — Internal Analytics Dashboard (Streamlit)

6-page admin dashboard for business intelligence.
Accessible only to admin role users via token-based auth.

Run: streamlit run main.py
"""

import os
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import streamlit as st
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="Rams @Elec Analytics",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Auth check (simple token-based for admin)
# ---------------------------------------------------------------------------
if "authenticated" not in st.session_state:
    st.session_state.authenticated = False

if not st.session_state.authenticated:
    st.title("Rams @Elec Analytics")
    token = st.text_input("Enter admin access token", type="password")
    if st.button("Access Dashboard"):
        if token == os.getenv("ADMIN_TOKEN", "rams-elec-admin-2026"):
            st.session_state.authenticated = True
            st.rerun()
        else:
            st.error("Invalid token")
    st.stop()

# ---------------------------------------------------------------------------
# Database connection
# ---------------------------------------------------------------------------
@st.cache_resource
def get_engine():
    db_url = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@localhost:5432/ramsatelec",
    )
    return create_engine(db_url)

engine = get_engine()

@st.cache_data(ttl=300)
def query_df(sql: str) -> pd.DataFrame:
    with engine.connect() as conn:
        return pd.read_sql(text(sql), conn)

# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------
st.sidebar.title("⚡ Rams @Elec Analytics")
page = st.sidebar.radio(
    "Navigation",
    ["Business Overview", "Inquiry Analytics", "Revenue & Forecasting",
     "Equipment & Maintenance", "Technician Performance", "Load-Shedding Impact"],
)

st.sidebar.divider()
st.sidebar.caption(f"Data refreshed: {datetime.now().strftime('%H:%M')}")
if st.sidebar.button("Logout"):
    st.session_state.authenticated = False
    st.rerun()

# ---------------------------------------------------------------------------
# 1. BUSINESS OVERVIEW
# ---------------------------------------------------------------------------
if page == "Business Overview":
    st.title("Business Overview")
    st.caption("Key metrics at a glance")

    # Metrics
    try:
        total_jobs = query_df("SELECT COUNT(*) as cnt FROM jobs")["cnt"].iloc[0]
        jobs_this_month = query_df(
            "SELECT COUNT(*) as cnt FROM jobs WHERE created_at >= date_trunc('month', CURRENT_DATE)"
        )["cnt"].iloc[0]
        jobs_last_month = query_df(
            "SELECT COUNT(*) as cnt FROM jobs WHERE created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND created_at < date_trunc('month', CURRENT_DATE)"
        )["cnt"].iloc[0]
        revenue_this_month = query_df(
            "SELECT COALESCE(SUM(actual_cost), 0) as rev FROM jobs WHERE status = 'complete' AND completed_date >= date_trunc('month', CURRENT_DATE)"
        )["rev"].iloc[0]
        avg_job_value = query_df(
            "SELECT AVG(actual_cost) as avg_cost FROM jobs WHERE status = 'complete'"
        )["avg_cost"].iloc[0]
        conversion = query_df(
            "SELECT COUNT(*) FILTER (WHERE status = 'converted') * 100.0 / NULLIF(COUNT(*), 0) as rate FROM inquiries"
        )["rate"].iloc[0]
    except Exception as e:
        st.error(f"Database error: {e}")
        st.stop()

    col1, col2, col3, col4, col5 = st.columns(5)
    col1.metric("Total Jobs", total_jobs)
    col2.metric("Jobs This Month", jobs_this_month, delta=int(jobs_this_month - jobs_last_month))
    col3.metric("Revenue This Month", f"R{revenue_this_month:,.0f}")
    col4.metric("Avg Job Value", f"R{avg_job_value:,.0f}" if avg_job_value else "N/A")
    col5.metric("Conversion Rate", f"{conversion:.1f}%" if conversion else "N/A")

    st.divider()

    # Jobs by status donut
    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Jobs by Status")
        try:
            status_df = query_df(
                "SELECT status, COUNT(*) as cnt FROM jobs GROUP BY status ORDER BY cnt DESC"
            )
            fig = px.pie(status_df, values="cnt", names="status", hole=0.5,
                         color_discrete_sequence=px.colors.qualitative.Set2)
            fig.update_traces(textinfo="label+value")
            st.plotly_chart(fig, use_container_width=True)
        except Exception:
            st.info("No job data available")

    with col2:
        st.subheader("Technician Utilisation")
        try:
            util_df = query_df("""
                SELECT t.name, COUNT(j.id) as completed,
                       (SELECT COUNT(*) FROM jobs WHERE technician_id = t.id) as total
                FROM technicians t
                LEFT JOIN jobs j ON t.id = j.technician_id AND j.status = 'complete'
                GROUP BY t.id, t.name
            """)
            if not util_df.empty:
                util_df["utilisation"] = util_df["completed"] / util_df["total"].max() * 100
                fig = px.bar(util_df, x="name", y="utilisation", color="name",
                             labels={"utilisation": "Utilisation %", "name": ""})
                fig.update_layout(showlegend=False)
                st.plotly_chart(fig, use_container_width=True)
        except Exception:
            st.info("No technician data available")

# ---------------------------------------------------------------------------
# 2. INQUIRY ANALYTICS
# ---------------------------------------------------------------------------
elif page == "Inquiry Analytics":
    st.title("Inquiry Analytics")
    st.caption("Track inquiry volume, sources, and conversion")

    try:
        inquiries_df = query_df("""
            SELECT id, source, classified_type, urgency_score, status, created_at
            FROM inquiries ORDER BY created_at DESC
        """)
    except Exception:
        inquiries_df = pd.DataFrame()

    if inquiries_df.empty:
        st.info("No inquiry data available. Seed the database first.")
        st.stop()

    # Date filter
    date_range = st.date_input("Date Range", value=(
        datetime.now() - timedelta(days=90), datetime.now()
    ))
    if len(date_range) == 2:
        inquiries_df["created_at"] = pd.to_datetime(inquiries_df["created_at"])
        mask = (inquiries_df["created_at"] >= pd.Timestamp(date_range[0])) & \
               (inquiries_df["created_at"] <= pd.Timestamp(date_range[1]))
        inquiries_df = inquiries_df[mask]

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("Inquiry Volume Over Time")
        daily = inquiries_df.set_index("created_at").resample("D").size().reset_index(name="count")
        fig = px.line(daily, x="created_at", y="count", markers=True)
        fig.update_layout(xaxis_title="", yaxis_title="Inquiries")
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        st.subheader("By Service Category")
        cat_counts = inquiries_df["classified_type"].value_counts().reset_index()
        cat_counts.columns = ["category", "count"]
        fig = px.bar(cat_counts, x="category", y="count", color="category")
        fig.update_layout(showlegend=False, xaxis_title="")
        st.plotly_chart(fig, use_container_width=True)

    col3, col4 = st.columns(2)
    with col3:
        st.subheader("By Source")
        source_counts = inquiries_df["source"].value_counts().reset_index()
        source_counts.columns = ["source", "count"]
        fig = px.pie(source_counts, values="count", names="source", hole=0.4)
        st.plotly_chart(fig, use_container_width=True)

    with col4:
        st.subheader("By Status")
        status_counts = inquiries_df["status"].value_counts().reset_index()
        status_counts.columns = ["status", "count"]
        fig = px.bar(status_counts, x="status", y="count", color="status")
        fig.update_layout(showlegend=False, xaxis_title="")
        st.plotly_chart(fig, use_container_width=True)

    # CSV export
    csv = inquiries_df.to_csv(index=False)
    st.download_button("📥 Export to CSV", csv, "inquiries_export.csv", "text/csv")

# ---------------------------------------------------------------------------
# 3. REVENUE & FORECASTING
# ---------------------------------------------------------------------------
elif page == "Revenue & Forecasting":
    st.title("Revenue & Forecasting")
    st.caption("Monthly revenue trends and Prophet forecast")

    try:
        revenue_df = query_df("""
            SELECT DATE_TRUNC('month', completed_date) as month,
                   SUM(actual_cost) as revenue,
                   COUNT(*) as job_count
            FROM jobs WHERE status = 'complete' AND actual_cost IS NOT NULL
            GROUP BY month ORDER BY month
        """)
    except Exception:
        revenue_df = pd.DataFrame()

    if revenue_df.empty:
        st.info("No revenue data available")
        st.stop()

    revenue_df["month"] = pd.to_datetime(revenue_df["month"])

    st.subheader("Monthly Revenue Trend")
    fig = make_subplots(specs=[[{"secondary_y": True}]])
    fig.add_trace(go.Bar(x=revenue_df["month"], y=revenue_df["revenue"], name="Revenue (R)", marker_color="#f59e0b"), secondary_y=False)
    fig.add_trace(go.Scatter(x=revenue_df["month"], y=revenue_df["job_count"], name="Job Count", mode="lines+markers", line=dict(color="#3b82f6")), secondary_y=True)
    fig.update_layout(xaxis_title="", hovermode="x unified")
    fig.update_yaxes(title_text="Revenue (R)", secondary_y=False)
    fig.update_yaxes(title_text="Job Count", secondary_y=True)
    st.plotly_chart(fig, use_container_width=True)

    # Prophet forecast
    st.subheader("3-Month Revenue Forecast")
    try:
        from prophet import Prophet
        prophet_df = revenue_df[["month", "revenue"]].copy()
        prophet_df.columns = ["ds", "y"]
        prophet_df = prophet_df.dropna()

        if len(prophet_df) >= 6:
            m = Prophet(interval_width=0.8)
            m.fit(prophet_df)
            future = m.make_future_dataframe(periods=3, freq="ME")
            forecast = m.predict(future)

            fig = go.Figure()
            fig.add_trace(go.Scatter(x=forecast["ds"], y=forecast["yhat"], mode="lines", name="Forecast", line=dict(color="#f59e0b")))
            fig.add_trace(go.Scatter(x=forecast["ds"], y=forecast["yhat_upper"], mode="lines", name="Upper Bound", line=dict(dash="dot", color="gray"), fill=None))
            fig.add_trace(go.Scatter(x=forecast["ds"], y=forecast["yhat_lower"], mode="lines", name="Lower Bound", line=dict(dash="dot", color="gray"), fill="tonexty"))
            fig.add_trace(go.Scatter(x=prophet_df["ds"], y=prophet_df["y"], mode="markers", name="Actual", marker=dict(color="black", size=6)))
            fig.update_layout(xaxis_title="", yaxis_title="Revenue (R)", hovermode="x unified")
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("Need at least 6 months of data for forecasting. Currently have " + str(len(prophet_df)) + " months.")
    except ImportError:
        st.info("Prophet not installed. Run: pip install prophet")
    except Exception as e:
        st.warning(f"Forecast unavailable: {e}")

    # Revenue by service category
    st.subheader("Revenue by Service Category")
    try:
        cat_rev = query_df("""
            SELECT st.category, SUM(j.actual_cost) as revenue
            FROM jobs j JOIN service_types st ON j.service_type_id = st.id
            WHERE j.status = 'complete' AND j.actual_cost IS NOT NULL
            GROUP BY st.category ORDER BY revenue DESC
        """)
        fig = px.bar(cat_rev, x="category", y="revenue", color="category", text_auto=".2s")
        fig.update_layout(showlegend=False, xaxis_title="", yaxis_title="Revenue (R)")
        st.plotly_chart(fig, use_container_width=True)
    except Exception:
        pass

# ---------------------------------------------------------------------------
# 4. EQUIPMENT & MAINTENANCE
# ---------------------------------------------------------------------------
elif page == "Equipment & Maintenance":
    st.title("Equipment & Maintenance")
    st.caption("Track equipment health and maintenance compliance")

    try:
        equip_df = query_df("""
            SELECT type, COUNT(*) as cnt FROM equipment GROUP BY type ORDER BY cnt DESC
        """)
        overdue_df = query_df("""
            SELECT e.type, e.brand, e.model, c.name as customer, ms.scheduled_date,
                   EXTRACT(DAY FROM NOW() - ms.scheduled_date) as days_overdue
            FROM maintenance_schedules ms
            JOIN equipment e ON ms.equipment_id = e.id
            JOIN customers c ON ms.customer_id = c.id
            WHERE ms.status = 'overdue'
            ORDER BY days_overdue DESC
        """)
        upcoming_df = query_df("""
            SELECT e.type, e.brand, c.name as customer, ms.scheduled_date
            FROM maintenance_schedules ms
            JOIN equipment e ON ms.equipment_id = e.id
            JOIN customers c ON ms.customer_id = c.id
            WHERE ms.status = 'pending' AND ms.scheduled_date <= NOW() + INTERVAL '30 days'
            ORDER BY ms.scheduled_date
        """)
    except Exception as e:
        st.error(f"Database error: {e}")
        st.stop()

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Equipment by Type")
        fig = px.pie(equip_df, values="cnt", names="type", hole=0.5)
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        total_equip = equip_df["cnt"].sum()
        total_overdue = len(overdue_df)
        compliance_rate = ((total_equip - total_overdue) / total_equip * 100) if total_equip > 0 else 0
        st.metric("Maintenance Compliance", f"{compliance_rate:.1f}%")
        st.metric("Overdue Maintenance", total_overdue)

    st.divider()

    st.subheader("⚠️ Overdue Maintenance")
    if not overdue_df.empty:
        st.dataframe(overdue_df, use_container_width=True, hide_index=True)
    else:
        st.success("No overdue maintenance — all equipment is up to date!")

    st.subheader("📅 Upcoming Maintenance (Next 30 Days)")
    if not upcoming_df.empty:
        st.dataframe(upcoming_df, use_container_width=True, hide_index=True)
    else:
        st.info("No maintenance scheduled in the next 30 days.")

# ---------------------------------------------------------------------------
# 5. TECHNICIAN PERFORMANCE
# ---------------------------------------------------------------------------
elif page == "Technician Performance":
    st.title("Technician Performance")
    st.caption("Jobs completed, average completion time, and area coverage")

    try:
        tech_df = query_df("""
            SELECT t.name, COUNT(j.id) as jobs_completed,
                   AVG(EXTRACT(DAY FROM j.completed_date - j.scheduled_date)) as avg_days,
                   AVG(j.actual_cost) as avg_job_value
            FROM technicians t
            LEFT JOIN jobs j ON t.id = j.technician_id AND j.status = 'complete'
            GROUP BY t.id, t.name ORDER BY jobs_completed DESC
        """)
        area_df = query_df("""
            SELECT t.name, j.area_zone, COUNT(*) as jobs
            FROM technicians t
            JOIN jobs j ON t.id = j.technician_id AND j.status = 'complete'
            GROUP BY t.name, j.area_zone ORDER BY jobs DESC
        """)
    except Exception as e:
        st.error(f"Database error: {e}")
        st.stop()

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Jobs Completed per Technician")
        fig = px.bar(tech_df, x="name", y="jobs_completed", color="name", text_auto=True)
        fig.update_layout(showlegend=False, xaxis_title="")
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        st.subheader("Average Job Value per Technician")
        fig = px.bar(tech_df, x="name", y="avg_job_value", color="name", text_auto=".2s")
        fig.update_layout(showlegend=False, xaxis_title="", yaxis_title="Avg Value (R)")
        st.plotly_chart(fig, use_container_width=True)

    st.subheader("Area Coverage Heatmap")
    if not area_df.empty:
        pivot = area_df.pivot_table(values="jobs", index="name", columns="area_zone", fill_value=0)
        fig = px.imshow(pivot, text_auto=True, aspect="auto", color_continuous_scale="YlOrBr")
        fig.update_layout(xaxis_title="", yaxis_title="")
        st.plotly_chart(fig, use_container_width=True)

    st.subheader("Technician Details")
    st.dataframe(tech_df, use_container_width=True, hide_index=True)

# ---------------------------------------------------------------------------
# 6. LOAD-SHEDDING IMPACT
# ---------------------------------------------------------------------------
elif page == "Load-Shedding Impact":
    st.title("Load-Shedding Impact Analysis")
    st.caption("Correlation between load-shedding and emergency inquiries")

    try:
        ls_events = query_df("""
            SELECT area_zone, stage, start_time, end_time
            FROM loadshedding_events ORDER BY start_time DESC
        """)
        emergency_inquiries = query_df("""
            SELECT created_at, area_zone
            FROM inquiries WHERE classified_type = 'emergency'
            ORDER BY created_at
        """)
    except Exception:
        ls_events = pd.DataFrame()
        emergency_inquiries = pd.DataFrame()

    if ls_events.empty:
        st.info("No load-shedding data available")
        st.stop()

    ls_events["start_time"] = pd.to_datetime(ls_events["start_time"])
    ls_events["date"] = ls_events["start_time"].dt.date

    st.subheader("Load-Shedding Events by Stage")
    stage_counts = ls_events["stage"].value_counts().sort_index().reset_index()
    stage_counts.columns = ["stage", "count"]
    fig = px.bar(stage_counts, x="stage", y="count", color="stage", text_auto=True)
    fig.update_layout(showlegend=False, xaxis_title="Stage", yaxis_title="Events")
    st.plotly_chart(fig, use_container_width=True)

    st.subheader("Events by Area Zone")
    zone_counts = ls_events["area_zone"].value_counts().reset_index()
    zone_counts.columns = ["area_zone", "count"]
    fig = px.bar(zone_counts, x="area_zone", y="count", color="area_zone")
    fig.update_layout(showlegend=False, xaxis_title="")
    st.plotly_chart(fig, use_container_width=True)

    if not emergency_inquiries.empty:
        st.subheader("Emergency Inquiries vs Load-Shedding")
        emergency_inquiries["created_at"] = pd.to_datetime(emergency_inquiries["created_at"])
        emergency_inquiries["date"] = emergency_inquiries["created_at"].dt.date
        daily_emergency = emergency_inquiries.groupby("date").size().reset_index(name="emergency_count")
        daily_emergency["date"] = pd.to_datetime(daily_emergency["date"])

        daily_ls = ls_events.groupby("date").size().reset_index(name="ls_events")
        daily_ls["date"] = pd.to_datetime(daily_ls["date"])

        merged = pd.merge(daily_emergency, daily_ls, on="date", how="outer").fillna(0)
        if len(merged) > 3:
            corr = merged["emergency_count"].corr(merged["ls_events"])
            st.metric("Correlation (emergency inquiries vs load-shedding events)", f"{corr:.3f}")

            fig = px.scatter(merged, x="ls_events", y="emergency_count", trendline="ols",
                             labels={"ls_events": "Load-Shedding Events", "emergency_count": "Emergency Inquiries"})
            st.plotly_chart(fig, use_container_width=True)

st.sidebar.divider()
st.sidebar.caption("Rams @Elec Intelligence Platform v1.0")
