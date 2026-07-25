"""
Rams @Elec — Knowledge Base Embedding Script

Chunks knowledge base documents, embeds with sentence-transformers,
and stores in a FAISS index for the RAG chatbot.

Documents embedded:
1. SANS 10142 key sections (summarised, non-copyrighted explanations)
2. Rams @Elec service catalog
3. FAQ document
4. Load-shedding protection guide

Run: python embed_knowledge_base.py
"""

import os
import logging
from pathlib import Path

from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("embed_kb")

FAISS_INDEX_PATH = os.getenv("FAISS_INDEX_PATH", "./knowledge_base/faiss_index")

# =============================================================================
# KNOWLEDGE BASE DOCUMENTS
# =============================================================================

KNOWLEDGE_BASE = [
    # -------------------------------------------------------------------------
    # 1. SANS 10142 Key Sections (summarised, educational use only)
    # -------------------------------------------------------------------------
    {
        "title": "SANS 10142 — Overview",
        "content": """
SANS 10142 is the South African National Standard for the Wiring of Premises.
It specifies the minimum safety requirements for low-voltage electrical installations
in residential, commercial, and industrial buildings across South Africa.

Key principles of SANS 10142:
- All electrical installations must be designed and constructed to ensure safety
  of persons, livestock, and property against dangers from electrical incidents.
- Installations must comply with the Occupational Health and Safety Act (OHSA)
  and the Electrical Installation Regulations.
- A valid Certificate of Compliance (COC) is required for every new installation,
  alteration, or property transfer in South Africa.

Only a registered electrical contractor with the Department of Employment and Labour
may issue a Certificate of Compliance. The COC is valid for two years from the date
of inspection.
""",
    },
    {
        "title": "SANS 10142 — Circuit Breakers and Protection",
        "content": """
SANS 10142 requires that all electrical circuits be protected against overcurrent
and earth fault conditions.

Key requirements:
- Each final circuit must be protected by a circuit breaker or fuse rated
  appropriately for the conductor size.
- Earth leakage protection (earth leakage relay) with a rated residual operating
  current not exceeding 30mA must be provided for socket-outlet circuits,
  bathroom circuits, and outdoor circuits.
- Distribution boards must be clearly labelled indicating which circuit each
  breaker controls.
- The main switch must be readily accessible and clearly identified.

Common compliance issues found during audits:
- Missing earth leakage protection on plug circuits
- Overloaded circuits (too many sockets on one breaker)
- Incorrectly rated circuit breakers for the cable size
- Distribution board not labelled
- No main earth connection or poor earth resistance
""",
    },
    {
        "title": "SANS 10142 — Sockets and Light Circuits",
        "content": """
Requirements for socket-outlet and lighting circuits under SANS 10142:

Socket outlets:
- Maximum 15 socket outlets per circuit for general-purpose circuits
- Kitchen socket outlets serving fixed appliances (stove, fridge, dishwasher)
  should be on dedicated circuits
- All socket outlets in bathrooms must be protected by earth leakage and
  positioned outside zone 0, 1, and 2 unless specifically rated
- Outdoor socket outlets must be weatherproof (IP44 minimum)

Lighting circuits:
- Maximum 20 light points per circuit
- Bathroom light fittings must be enclosed and rated for the zone
- Emergency lighting is required in escape routes for commercial buildings
- Dimmers must be compatible with the lamp type (LED dimmers for LED lamps)

Warning signs of non-compliant installations:
- Flickering lights when appliances switch on
- Warm or discoloured switch plates
- Circuit breakers that trip frequently
- Buzzing sounds from switches or sockets
""",
    },
    {
        "title": "SANS 10142 — Earthing and Bonding",
        "content": """
Proper earthing and bonding is critical for electrical safety under SANS 10142.

Earthing requirements:
- Every installation must have a main earth electrode (earth rod, earth mat,
  or foundation earth) with resistance not exceeding 22 ohms under normal
  conditions, or 100 ohms where an earth leakage device is installed.
- The main earth conductor must be clearly identified (green/yellow) and
  continuous from the main earth terminal to the electrode.
- All exposed conductive parts (metal enclosures, conduit, trunking) must
  be connected to the earth.

Equipotential bonding:
- All extraneous conductive parts (water pipes, gas pipes, structural steel,
  air conditioning ducts) must be bonded to the main earth terminal.
- Supplementary bonding is required in bathrooms connecting all exposed
  and extraneous conductive parts.

Testing requirements:
- Earth resistance must be measured and recorded on the COC test report.
- Earth loop impedance must be verified at the furthest point of each circuit.
- Earth leakage devices must be tested using the test button and a ramp tester.
""",
    },
    {
        "title": "SANS 10142 — Certificate of Compliance (COC)",
        "content": """
The Certificate of Compliance (COC) is a legal document under the Electrical
Installation Regulations of the Occupational Health and Safety Act.

When a COC is required:
- Before any new electrical installation is energised
- When any alteration or addition is made to an existing installation
- When a property is sold or transferred
- When an insurance claim involves the electrical installation

What the COC covers:
- Visual inspection of the installation
- Testing of earth continuity, insulation resistance, earth loop impedance
- Verification of earth leakage protection operation
- Confirmation of correct circuit breaker ratings
- Polarity and phase rotation checks

Important notes:
- The COC is NOT a maintenance certificate — it only confirms compliance
  at the time of inspection.
- A supplementary COC is required for each alteration after the initial COC.
- The registered person (electrician) assumes legal liability for the
  accuracy of the COC.
- Homeowners should keep COCs for insurance and future property sale purposes.
""",
    },
    # -------------------------------------------------------------------------
    # 2. Rams @Elec Service Catalog
    # -------------------------------------------------------------------------
    {
        "title": "Rams @Elec — Electrical Services",
        "content": """
Rams @Elec provides comprehensive electrical services across Gauteng and Limpopo.

Electrical Services:
- Distribution Board Upgrades: Replace outdated fuse boxes with modern circuit
  breaker panels. Includes labelling, earth leakage protection, and surge
  protection options. Typical cost: R3,500 – R15,000.
- Electrical Compliance Audits: Full SANS 10142 inspection with detailed report
  identifying non-compliance issues. Required for property sales, insurance,
  and business licensing. Cost: R1,800 – R6,500.
- Industrial Wiring: Three-phase installations for factories, warehouses, and
  commercial buildings. Includes cable tray, conduit, and distribution.
  Cost: R5,000 – R35,000 depending on scope.
- Surge Protection Installation: Protect equipment from load-shedding surges
  and lightning. Whole-building protection from R1,800.
- Emergency Electrical Repair: 24/7 response for power failures, tripping
  breakers, sparking outlets, and electrical faults. Cost: R900 – R7,500.

All electrical work is performed by qualified electricians and complies with
SANS 10142. Certificates of Compliance provided for all installations.
""",
    },
    {
        "title": "Rams @Elec — Refrigeration Services",
        "content": """
Rams @Elec specialises in commercial and industrial refrigeration.

Refrigeration Services:
- Cold Room Installation: Custom-engineered cold rooms for warehouses,
  supermarkets, restaurants, and pharmaceutical storage. Includes
  insulated panels, refrigeration units, temperature monitoring, and
  alarm systems. Cost: R15,000 – R85,000 depending on size and spec.
- Cold Room Repair: Compressor replacement, refrigerant recharge,
  thermostat repair, door seal replacement, defrost system repair.
  Cost: R2,500 – R18,000.
- Preventative Maintenance: Quarterly or bi-annual servicing including
  coil cleaning, refrigerant level check, temperature calibration,
  door seal inspection, and drainage check. From R900 per visit.
- HVAC Installation: Air conditioning systems for offices, retail,
  and residential. Split units, multi-split, and ducted systems.
  Cost: R8,000 – R45,000.
- HVAC Maintenance: Filter replacement, coil cleaning, gas recharge,
  drainage check. From R1,200.

All refrigeration technicians are trained in cold room and HVAC systems.
Emergency refrigeration response available 24/7 for cold room failures.
""",
    },
    {
        "title": "Rams @Elec — Generator Services",
        "content": """
Rams @Elec provides generator solutions for load-shedding protection.

Generator Services:
- Generator Installation: Full installation including changeover switch,
  cabling, weatherproof enclosure, and commissioning. Automatic transfer
  switch (ATS) available for seamless power transition.
  Cost: R12,000 – R95,000 depending on generator size.
- Generator Servicing: Oil change, filter replacement, spark plug check,
  battery test, load test, and fuel system inspection. Recommended every
  6 months or 100 hours of operation. Cost: R1,500 – R5,000.
- Generator Repair: Troubleshooting starting issues, power output problems,
  fuel system repairs, alternator repairs. Cost: R1,500 – R8,000.

Generator sizing guide:
- Small office/home (essential circuits): 5–7.5 kVA
- Medium business (lights + plugs + IT): 10–20 kVA
- Large commercial (full operation): 25–100+ kVA
- Cold room backup: Calculate total compressor load + 30% buffer

Regular servicing is essential — a generator that fails during load shedding
is worse than no generator at all. Test your generator monthly.
""",
    },
    # -------------------------------------------------------------------------
    # 3. FAQ — Common Questions
    # -------------------------------------------------------------------------
    {
        "title": "FAQ — General Electrical",
        "content": """
Frequently Asked Questions about electrical services:

Q: Why does my circuit breaker keep tripping?
A: This usually indicates an overloaded circuit (too many appliances on one
circuit), a short circuit, or an earth fault. Unplug devices one at a time
to identify the culprit. If it persists, call an electrician — it could be
a wiring fault.

Q: How often should I have my electrical installation inspected?
A: Residential: every 5–10 years. Commercial/industrial: every 1–2 years.
Rental properties: before each new tenant. After any major renovation or
electrical incident.

Q: What is earth leakage and why do I need it?
A: Earth leakage protection detects current flowing to earth (through a person
or faulty equipment) and cuts power within 30 milliseconds. It prevents
electrocution. Required by SANS 10142 for all plug and light circuits.

Q: Can I do my own electrical work?
A: Legally, only a registered electrical contractor may perform electrical
installation work in South Africa. DIY electrical work is illegal and
dangerous. It also invalidates your insurance.

Q: Why are my lights flickering?
A: Common causes: loose connection, overloaded circuit, voltage fluctuation
from the grid, or a failing appliance drawing excessive current. If it
affects multiple circuits, it may be a main supply issue — contact your
electricity provider or an electrician.
""",
    },
    {
        "title": "FAQ — Cold Rooms and Refrigeration",
        "content": """
Frequently Asked Questions about cold rooms and refrigeration:

Q: What temperature should my cold room be?
A: Chiller (fresh produce, dairy): 0°C to +4°C. Freezer (meat, frozen goods):
-18°C to -22°C. Pharmaceutical: as specified by product requirements,
typically +2°C to +8°C.

Q: Why is my cold room not reaching temperature?
A: Common causes: dirty condenser coils, low refrigerant gas, faulty
thermostat, damaged door seals, blocked evaporator fans, or the unit is
undersized for the heat load. A technician can diagnose the exact cause.

Q: How often should cold rooms be serviced?
A: Every 6 months for commercial cold rooms. More frequently (quarterly)
for facilities storing high-value perishable goods or pharmaceutical products.

Q: What happens to my cold room during load shedding?
A: A well-sealed cold room can maintain temperature for 2–4 hours without
power, depending on ambient temperature and how often the door is opened.
For longer outages, a backup generator is essential. Cold room temperature
alarms with battery backup are recommended.

Q: Ice buildup in my cold room — is this normal?
A: Some frost is normal, but excessive ice buildup indicates a problem:
faulty defrost system, damaged door seals letting in humid air, or the
door being left open. Ice reduces cooling efficiency and increases
electricity consumption.
""",
    },
    {
        "title": "FAQ — Load Shedding Protection",
        "content": """
Frequently Asked Questions about load shedding protection:

Q: How can I protect my appliances from load shedding surges?
A: Install surge protection on your distribution board (whole-building
protection). Individual plug-in surge protectors help but are less effective.
The most damaging surges often occur when power returns after load shedding,
not when it goes off.

Q: What's the difference between a UPS, inverter, and generator?
A: UPS (Uninterruptible Power Supply): Battery backup for short outages
(minutes), ideal for computers and electronics. Inverter system: Battery
backup for longer outages (2–8 hours), powers selected circuits. Generator:
Fuel-powered, runs as long as you have fuel, can power entire buildings.

Q: How big a generator do I need for my business?
A: Calculate your essential load: add up the wattage of all equipment you
need during an outage (lights, computers, fridges, security). Add 30% for
starting surge. A site assessment provides the most accurate sizing.

Q: Can I run my cold room on a generator?
A: Yes, but the generator must be sized for the compressor starting current,
which can be 3–5 times the running current. An automatic transfer switch
(ATS) is recommended for unattended cold rooms.

Q: How often should I test my backup power system?
A: Generators: test run monthly for 15–30 minutes under load. Inverters/UPS:
check battery health quarterly. Schedule professional servicing every 6 months.
""",
    },
    # -------------------------------------------------------------------------
    # 4. Load-Shedding Protection Guide
    # -------------------------------------------------------------------------
    {
        "title": "Load-Shedding Protection Guide — Overview",
        "content": """
Load shedding is a reality for South African homes and businesses. Proper
protection can prevent equipment damage, data loss, and business interruption.

Levels of protection:
1. Basic: Surge protection plugs + LED rechargeable lights. Cost: R500–R2,000.
2. Standard: Distribution board surge protector + small inverter for lights,
   TV, WiFi, and laptop. Cost: R8,000–R25,000.
3. Advanced: Full inverter system with lithium batteries powering most circuits
   (lights, plugs, fridge, security). Cost: R30,000–R100,000.
4. Commercial: Generator with automatic transfer switch powering the entire
   premises. Cost: R50,000–R200,000+.

For businesses with cold rooms:
- Minimum: Temperature monitoring with battery backup alarm
- Recommended: Generator sized for compressor starting load + ATS
- Best practice: Generator + battery inverter for seamless transition
  (no gap in power during changeover)

Rams @Elec provides site assessments to recommend the right solution for
your specific needs and budget.
""",
    },
    {
        "title": "Load-Shedding Protection Guide — Surge Protection",
        "content": """
Surge protection is the first line of defence against load-shedding damage.

Why surges happen during load shedding:
- When power returns, the grid experiences a voltage spike as transformers
  and substations re-energise simultaneously.
- These spikes can reach thousands of volts for a fraction of a second.
- Sensitive electronics (computers, TVs, fridge controllers, security systems)
  are most vulnerable.

Protection levels:
- Type 1: Installed at the main distribution board. Protects against direct
  lightning strikes and major grid surges. Required for buildings with
  external lightning protection.
- Type 2: Installed at sub-distribution boards. Protects against switching
  surges and induced surges. Recommended minimum for all businesses.
- Type 3: Plug-in surge protectors at point of use. Fine protection for
  sensitive electronics. Use in addition to Type 1 or 2.

Rams @Elec recommends Type 2 surge protection as a minimum for all customers,
installed at the main distribution board. This protects all circuits in the
building from load-shedding surges.
""",
    },
]

# =============================================================================
# MAIN
# =============================================================================


def main():
    logger.info("Starting knowledge base embedding...")

    # Create documents
    documents = []
    for item in KNOWLEDGE_BASE:
        doc = Document(
            page_content=item["content"].strip(),
            metadata={"title": item["title"]},
        )
        documents.append(doc)

    logger.info(f"Loaded {len(documents)} knowledge base documents")

    # Split into chunks
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=100,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = text_splitter.split_documents(documents)
    logger.info(f"Split into {len(chunks)} chunks")

    # Create embeddings
    logger.info("Loading embedding model (all-MiniLM-L6-v2)...")
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={"device": "cpu"},
    )

    # Create FAISS index
    logger.info("Creating FAISS index...")
    vectorstore = FAISS.from_documents(chunks, embeddings)

    # Save
    os.makedirs(FAISS_INDEX_PATH, exist_ok=True)
    vectorstore.save_local(FAISS_INDEX_PATH)
    logger.info(f"FAISS index saved to {FAISS_INDEX_PATH}")
    logger.info(f"Total vectors: {vectorstore.index.ntotal}")

    # Test query
    logger.info("Running test query...")
    results = vectorstore.similarity_search_with_score("What is SANS 10142?", k=3)
    for i, (doc, score) in enumerate(results):
        logger.info(f"  Result {i+1}: [{doc.metadata['title']}] score={score:.4f}")
        logger.info(f"    {doc.page_content[:100]}...")

    logger.info("Knowledge base embedding complete!")


if __name__ == "__main__":
    main()
