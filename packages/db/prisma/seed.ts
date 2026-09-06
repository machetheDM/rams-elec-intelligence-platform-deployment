// =============================================================================
// Rams @Elec Intelligence Platform — Seed Data
// =============================================================================
// Generates realistic South African electrical & refrigeration business data.
// Used to train the XGBoost quote estimator until real client data is available.
// Area zones: Gauteng (Sandton, Midrand, Centurion, Pretoria East, Soweto)
//             Limpopo (Polokwane, Mokopane, Bela-Bela)
// =============================================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// =============================================================================
// SERVICE TYPES — 12 realistic offerings
// =============================================================================
const serviceTypes = [
  {
    name: "Cold Room Installation",
    category: "installation",
    baseCostMin: 15000,
    baseCostMax: 85000,
    typicalDurationHours: 40,
  },
  {
    name: "Cold Room Repair",
    category: "refrigeration",
    baseCostMin: 2500,
    baseCostMax: 18000,
    typicalDurationHours: 6,
  },
  {
    name: "HVAC Installation",
    category: "installation",
    baseCostMin: 8000,
    baseCostMax: 45000,
    typicalDurationHours: 16,
  },
  {
    name: "HVAC Maintenance",
    category: "maintenance",
    baseCostMin: 1200,
    baseCostMax: 4500,
    typicalDurationHours: 3,
  },
  {
    name: "Emergency Electrical Repair",
    category: "emergency",
    baseCostMin: 900,
    baseCostMax: 7500,
    typicalDurationHours: 3,
  },
  {
    name: "Electrical Compliance Audit",
    category: "electrical",
    baseCostMin: 1800,
    baseCostMax: 6500,
    typicalDurationHours: 5,
  },
  {
    name: "Distribution Board Upgrade",
    category: "electrical",
    baseCostMin: 3500,
    baseCostMax: 15000,
    typicalDurationHours: 8,
  },
  {
    name: "Generator Installation",
    category: "installation",
    baseCostMin: 12000,
    baseCostMax: 95000,
    typicalDurationHours: 24,
  },
  {
    name: "Generator Service",
    category: "maintenance",
    baseCostMin: 1500,
    baseCostMax: 5000,
    typicalDurationHours: 4,
  },
  {
    name: "Industrial Wiring",
    category: "electrical",
    baseCostMin: 5000,
    baseCostMax: 35000,
    typicalDurationHours: 20,
  },
  {
    name: "Surge Protection Installation",
    category: "installation",
    baseCostMin: 1800,
    baseCostMax: 8500,
    typicalDurationHours: 4,
  },
  {
    name: "Preventative Maintenance Visit",
    category: "maintenance",
    baseCostMin: 900,
    baseCostMax: 3000,
    typicalDurationHours: 2,
  },
];

// =============================================================================
// CUSTOMERS — 22 across Gauteng and Limpopo
// =============================================================================
const customers = [
  {
    name: "Thabo Molefe",
    email: "thabo.m@email.co.za",
    phone: "+27831234567",
    whatsapp: "+27831234567",
    address: "12 Rivonia Rd, Sandton",
    areaZone: "Sandton",
  },
  {
    name: "Priya Naidoo",
    email: "priya.n@email.co.za",
    phone: "+27829876543",
    whatsapp: "+27829876543",
    address: "45 West St, Sandton",
    areaZone: "Sandton",
  },
  {
    name: "James van der Merwe",
    email: "james.vdm@email.co.za",
    phone: "+27761239876",
    whatsapp: "+27761239876",
    address: "8 Midrand Business Park, Midrand",
    areaZone: "Midrand",
  },
  {
    name: "Lerato Khumalo",
    email: "lerato.k@email.co.za",
    phone: "+27783456123",
    whatsapp: "+27783456123",
    address: "23 Olifantsfontein Rd, Midrand",
    areaZone: "Midrand",
  },
  {
    name: "David Nkosi",
    email: "david.n@email.co.za",
    phone: "+27814567890",
    whatsapp: "+27814567890",
    address: "67 Jean Ave, Centurion",
    areaZone: "Centurion",
  },
  {
    name: "Sarah Botha",
    email: "sarah.b@email.co.za",
    phone: "+27729871234",
    address: "14 Hendrik Verwoerd Dr, Centurion",
    areaZone: "Centurion",
  },
  {
    name: "Michael Mahlangu",
    email: "michael.m@email.co.za",
    phone: "+27825678901",
    whatsapp: "+27825678901",
    address: "89 Lynnwood Rd, Pretoria East",
    areaZone: "Pretoria East",
  },
  {
    name: "Fatima Patel",
    email: "fatima.p@email.co.za",
    phone: "+27783450987",
    whatsapp: "+27783450987",
    address: "34 Garsfontein Rd, Pretoria East",
    areaZone: "Pretoria East",
  },
  {
    name: "Sipho Dlamini",
    email: "sipho.d@email.co.za",
    phone: "+27836543210",
    address: "56 Vilakazi St, Soweto",
    areaZone: "Soweto",
  },
  {
    name: "Nomsa Zulu",
    email: "nomsa.z@email.co.za",
    phone: "+27764567890",
    whatsapp: "+27764567890",
    address: "12 Chris Hani Rd, Soweto",
    areaZone: "Soweto",
  },
  {
    name: "Kabelo Mokoena",
    email: "kabelo.m@email.co.za",
    phone: "+27781234567",
    whatsapp: "+27781234567",
    address: "45 Market St, Polokwane",
    areaZone: "Polokwane",
  },
  {
    name: "Anna Ramaphosa",
    email: "anna.r@email.co.za",
    phone: "+27154567890",
    address: "78 Landdros Mare St, Polokwane",
    areaZone: "Polokwane",
  },
  {
    name: "Peter Mahlatji",
    email: "peter.m@email.co.za",
    phone: "+27154912345",
    whatsapp: "+27154912345",
    address: "23 Nelson Mandela Dr, Mokopane",
    areaZone: "Mokopane",
  },
  {
    name: "Grace Ledwaba",
    email: "grace.l@email.co.za",
    phone: "+27154987654",
    address: "56 Thabo Mbeki Dr, Mokopane",
    areaZone: "Mokopane",
  },
  {
    name: "Johan Pretorius",
    email: "johan.p@email.co.za",
    phone: "+27839876543",
    whatsapp: "+27839876543",
    address: "90 Bela Mall, Bela-Bela",
    areaZone: "Bela-Bela",
  },
  {
    name: "Miriam Sebata",
    email: "miriam.s@email.co.za",
    phone: "+27147890123",
    address: "34 Potgieter Rd, Bela-Bela",
    areaZone: "Bela-Bela",
  },
  {
    name: "Rajesh Govender",
    email: "rajesh.g@email.co.za",
    phone: "+27841234567",
    whatsapp: "+27841234567",
    address: "101 Katherine St, Sandton",
    areaZone: "Sandton",
  },
  {
    name: "Tumi Molepo",
    email: "tumi.m@email.co.za",
    phone: "+27769876543",
    whatsapp: "+27769876543",
    address: "77 Main Rd, Midrand",
    areaZone: "Midrand",
  },
  {
    name: "William Mabaso",
    email: "william.m@email.co.za",
    phone: "+27827890123",
    address: "15 Church St, Pretoria East",
    areaZone: "Pretoria East",
  },
  {
    name: "Busisiwe Ndlovu",
    email: "busisiwe.n@email.co.za",
    phone: "+27763456123",
    whatsapp: "+27763456123",
    address: "88 Commissioner St, Polokwane",
    areaZone: "Polokwane",
  },
  {
    name: "Andre du Toit",
    email: "andre.dt@email.co.za",
    phone: "+27835678901",
    whatsapp: "+27835678901",
    address: "33 Witch-Hazel Ave, Centurion",
    areaZone: "Centurion",
  },
  {
    name: "Mapula Mothapo",
    email: "mapula.m@email.co.za",
    phone: "+27154561234",
    address: "42 Grobler St, Mokopane",
    areaZone: "Mokopane",
  },
];

// =============================================================================
// TECHNICIANS — 5 with realistic skill sets
// =============================================================================
const technicians = [
  {
    name: "Samuel Mokoena",
    phone: "+27820000001",
    whatsapp: "+27820000001",
    email: "samuel.m@ramsatelec.co.za",
    skills: ["electrical", "emergency", "installation"],
    areaZones: ["Sandton", "Midrand", "Centurion"],
    maxDailyJobs: 4,
  },
  {
    name: "Thapelo Ramabulana",
    phone: "+27820000002",
    whatsapp: "+27820000002",
    email: "thapelo.r@ramsatelec.co.za",
    skills: ["refrigeration", "cold_room", "hvac", "maintenance"],
    areaZones: ["Sandton", "Midrand", "Pretoria East", "Centurion"],
    maxDailyJobs: 3,
  },
  {
    name: "Piet Molefe",
    phone: "+27820000003",
    whatsapp: "+27820000003",
    email: "piet.m@ramsatelec.co.za",
    skills: ["electrical", "installation", "maintenance", "emergency"],
    areaZones: ["Polokwane", "Mokopane", "Bela-Bela"],
    maxDailyJobs: 4,
  },
  {
    name: "Lucas Ndlovu",
    phone: "+27820000004",
    whatsapp: "+27820000004",
    email: "lucas.n@ramsatelec.co.za",
    skills: ["refrigeration", "cold_room", "hvac", "installation"],
    areaZones: ["Pretoria East", "Centurion", "Midrand", "Soweto"],
    maxDailyJobs: 3,
  },
  {
    name: "Daniel Mahlangu",
    phone: "+27820000005",
    whatsapp: "+27820000005",
    email: "daniel.m@ramsatelec.co.za",
    skills: ["electrical", "refrigeration", "emergency", "maintenance"],
    areaZones: ["Soweto", "Sandton", "Midrand", "Centurion"],
    maxDailyJobs: 5,
  },
];

// =============================================================================
// EQUIPMENT — realistic mix per customer
// =============================================================================
const equipmentTemplates = [
  { type: "cold_room", brand: "Frigair", model: "CR-2000", warrantyYears: 5 },
  { type: "cold_room", brand: "MTC", model: "ColdVault 500", warrantyYears: 3 },
  { type: "hvac", brand: "Samsung", model: "AC120F", warrantyYears: 5 },
  { type: "hvac", brand: "LG", model: "MultiV 5", warrantyYears: 7 },
  { type: "hvac", brand: "Daikin", model: "VRV IV", warrantyYears: 5 },
  { type: "electrical_panel", brand: "Schneider", model: "Prisma G", warrantyYears: 10 },
  { type: "electrical_panel", brand: "ABB", model: "System Pro E", warrantyYears: 10 },
  { type: "generator", brand: "Honda", model: "EU70is", warrantyYears: 3 },
  { type: "generator", brand: "Yamaha", model: "EF7200DE", warrantyYears: 3 },
  { type: "generator", brand: "Briggs & Stratton", model: "Elite 8000", warrantyYears: 2 },
];

// =============================================================================
// MAIN SEED FUNCTION
// =============================================================================
async function main() {
  console.log("Seeding Rams @Elec Intelligence Platform database...\n");

  // Clear existing data (order matters for FK constraints)
  await prisma.chatbotConversation.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.jobStatusHistory.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.inquiry.deleteMany();
  await prisma.maintenanceSchedule.deleteMany();
  await prisma.job.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.serviceType.deleteMany();
  await prisma.technician.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.loadsheddingEvent.deleteMany();
  await prisma.etlErrorLog.deleteMany();

  // --- SERVICE TYPES ---
  console.log("Creating service types...");
  const createdServiceTypes = await Promise.all(
    serviceTypes.map((st) => prisma.serviceType.create({ data: st }))
  );
  console.log(`  ✓ ${createdServiceTypes.length} service types`);

  // --- CUSTOMERS ---
  console.log("Creating customers...");
  const createdCustomers = await Promise.all(
    customers.map((c) => prisma.customer.create({ data: c }))
  );
  console.log(`  ✓ ${createdCustomers.length} customers`);

  // --- TECHNICIANS ---
  console.log("Creating technicians...");
  const createdTechnicians = await Promise.all(
    technicians.map((t) => prisma.technician.create({ data: t }))
  );
  console.log(`  ✓ ${createdTechnicians.length} technicians`);

  // --- EQUIPMENT ---
  console.log("Creating equipment...");
  const equipmentRecords: any[] = [];
  for (const customer of createdCustomers) {
    // Each customer gets 1–3 pieces of equipment
    const count = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < count; i++) {
      const tmpl = pick(equipmentTemplates);
      const installDaysAgo = randomBetween(30, 1800);
      const lastServiceDaysAgo = randomBetween(10, 365);
      const warrantyExpiry = new Date();
      warrantyExpiry.setDate(
        warrantyExpiry.getDate() + randomBetween(-180, tmpl.warrantyYears * 365)
      );

      const eq = await prisma.equipment.create({
        data: {
          customerId: customer.id,
          type: tmpl.type,
          brand: tmpl.brand,
          model: tmpl.model,
          installDate: daysAgo(installDaysAgo),
          lastServiceDate: daysAgo(lastServiceDaysAgo),
          warrantyExpiry,
          notes: `Installed at ${customer.address}`,
        },
      });
      equipmentRecords.push(eq);
    }
  }
  console.log(`  ✓ ${equipmentRecords.length} equipment records`);

  // --- JOBS — 60 realistic jobs over the past 12 months ---
  console.log("Creating jobs...");
  const statuses = ["open", "assigned", "in_progress", "complete", "cancelled"];
  const urgencies = ["low", "medium", "high", "emergency"];
  const jobCount = 60;
  const createdJobs: any[] = [];

  for (let i = 0; i < jobCount; i++) {
    const customer = pick(createdCustomers);
    const serviceType = pick(createdServiceTypes);
    const technician = pick(createdTechnicians);
    const status = i < 45 ? "complete" : pick(statuses); // 45 complete, rest varied
    const urgency = pick(urgencies);
    const daysAgoVal = randomBetween(1, 365);
    const baseCost = randomBetween(serviceType.baseCostMin, serviceType.baseCostMax);
    const actualCost =
      status === "complete" ? baseCost * randomBetween(0.85, 1.3) : null;
    const scheduledDate = daysAgo(daysAgoVal - randomBetween(1, 7));
    const completedDate =
      status === "complete"
        ? new Date(scheduledDate.getTime() + randomBetween(2, 48) * 3600000)
        : null;

    const customerEquipment = equipmentRecords.filter(
      (e) => e.customerId === customer.id
    );
    const equipment = customerEquipment.length > 0 ? pick(customerEquipment) : null;

    const job = await prisma.job.create({
      data: {
        customerId: customer.id,
        technicianId: status !== "open" ? technician.id : null,
        serviceTypeId: serviceType.id,
        equipmentId: equipment?.id ?? null,
        status,
        urgency,
        areaZone: customer.areaZone,
        scheduledDate,
        completedDate,
        quotedCost: baseCost,
        actualCost,
        jobNotes: `${serviceType.name} at ${customer.address}. ${urgency} priority.`,
      },
    });
    createdJobs.push(job);
  }
  console.log(`  ✓ ${createdJobs.length} jobs`);

  // --- INQUIRIES — 30 inquiries ---
  console.log("Creating inquiries...");
  const inquiryMessages = [
    "My cold room is not cooling properly, temperature keeps rising. Need urgent help.",
    "I need a quote for installing air conditioning in my office building in Sandton.",
    "The lights keep flickering and the circuit breaker trips every few hours.",
    "Generator won't start. We have a restaurant and load shedding is killing us.",
    "Need a compliance certificate for our new office in Centurion.",
    "HVAC system making loud noise, smells like burning. Please help urgently.",
    "Looking for someone to do regular maintenance on our cold rooms at the butchery.",
    "Distribution board upgrade needed for our factory expansion.",
    "Surge protection installation for our server room. Load shedding damaged equipment before.",
    "Emergency: no power in half the building. We're a medical practice in Pretoria East.",
    "Need industrial wiring for new warehouse in Midrand.",
    "Cold room installation quote needed for new supermarket in Polokwane.",
    "Aircon not cooling. Summer is coming and we need it fixed ASAP.",
    "Preventative maintenance for 3 HVAC units at our office park.",
    "Electrical audit needed before we can open our new restaurant.",
    "Generator service overdue. It's been 18 months since last service.",
    "Cold room door seal broken, cold air escaping. Need repair.",
    "Need a quote for backup power solution for our entire office building.",
    "Lights dimming when we switch on heavy equipment. Possible voltage issue.",
    "Refrigeration unit leaking water onto the floor. Urgent repair needed.",
    "Looking for annual maintenance contract for 5 cold rooms and 10 HVAC units.",
    "Emergency electrical repair: sparks coming from plug point in kitchen.",
    "Need COC certificate for property sale in Mokopane.",
    "Generator installation for a smallholding in Bela-Bela. Off-grid capable preferred.",
    "Cold room temperature alarm going off since 3am. Need immediate assistance.",
    "Office relocation — need electrical setup for new premises in Soweto.",
    "HVAC duct cleaning and service for restaurant kitchen extraction system.",
    "Load shedding damaged our inverter. Need assessment and repair quote.",
    "New cold room build for pharmaceutical storage. Must meet strict temperature specs.",
    "Electrical compliance audit for 3 retail stores across Gauteng.",
  ];

  for (let i = 0; i < 30; i++) {
    const customer = pick(createdCustomers);
    const source = pick(["web_form", "whatsapp", "phone", "email"]);
    const rawMessage = inquiryMessages[i];
    const classifiedType = pick([
      "electrical",
      "refrigeration",
      "emergency",
      "maintenance",
      "installation",
    ]);
    const urgencyScore = randomBetween(0.1, 1.0);
    const status = i < 20 ? "converted" : pick(["new", "triaged", "closed"]);
    const assignedJob = i < 20 ? createdJobs[45 + i] : null; // link some to jobs

    await prisma.inquiry.create({
      data: {
        customerId: customer.id,
        source,
        rawMessage,
        classifiedType,
        urgencyScore,
        estimatedCostMin: randomBetween(900, 15000),
        estimatedCostMax: randomBetween(3000, 85000),
        assignedJobId: assignedJob?.id ?? null,
        status,
      },
    });
  }
  console.log(`  ✓ 30 inquiries`);

  // --- QUOTES — for converted inquiries ---
  console.log("Creating quotes...");
  const convertedInquiries = await prisma.inquiry.findMany({
    where: { status: "converted" },
    include: { customer: true },
  });

  for (const inquiry of convertedInquiries.slice(0, 15)) {
    const items = [
      { description: "Labour (qualified technician)", quantity: 1, unitCost: randomBetween(450, 850), total: 0 },
      { description: "Materials and components", quantity: 1, unitCost: randomBetween(500, 12000), total: 0 },
      { description: "Call-out fee", quantity: 1, unitCost: 450, total: 0 },
    ];
    items.forEach((item) => (item.total = item.quantity * item.unitCost));
    const totalMin = items.reduce((s, i) => s + i.total, 0) * 0.85;
    const totalMax = items.reduce((s, i) => s + i.total, 0) * 1.2;

    await prisma.quote.create({
      data: {
        inquiryId: inquiry.id,
        customerId: inquiry.customerId!,
        items: items as any,
        totalMin: Math.round(totalMin * 100) / 100,
        totalMax: Math.round(totalMax * 100) / 100,
        status: pick(["sent", "accepted", "rejected"]),
        sentAt: daysAgo(randomBetween(1, 30)),
        respondedAt: daysAgo(randomBetween(0, 14)),
      },
    });
  }
  console.log(`  ✓ 15 quotes`);

  // --- MAINTENANCE SCHEDULES ---
  console.log("Creating maintenance schedules...");
  for (const eq of equipmentRecords.slice(0, 30)) {
    const status = pick(["pending", "completed", "overdue"]);
    await prisma.maintenanceSchedule.create({
      data: {
        equipmentId: eq.id,
        customerId: eq.customerId,
        scheduledDate:
          status === "completed" ? daysAgo(randomBetween(1, 60)) : daysFromNow(randomBetween(1, 90)),
        intervalMonths: pick([3, 6, 12]),
        status,
        notes: `Scheduled ${eq.type} maintenance for ${eq.brand} ${eq.model}`,
      },
    });
  }
  console.log(`  ✓ 30 maintenance schedules`);

  // --- LOADSHEDDING EVENTS — recent history ---
  console.log("Creating load-shedding events...");
  const areaZones = ["Sandton", "Midrand", "Centurion", "Pretoria East", "Soweto", "Polokwane", "Mokopane", "Bela-Bela"];
  for (let d = 0; d < 14; d++) {
    for (const zone of areaZones) {
      const stage = pick([1, 2, 3, 4, 6]);
      const startHour = pick([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
      const startTime = new Date(daysAgo(d));
      startTime.setHours(startHour, 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setHours(startHour + pick([2, 2.5, 4]), 0, 0, 0);

      await prisma.loadsheddingEvent.create({
        data: {
          areaZone: zone,
          stage,
          startTime,
          endTime,
          source: "eskomsepush",
        },
      });
    }
  }
  console.log(`  ✓ ${areaZones.length * 14} load-shedding events`);

  // --- NOTIFICATION LOGS ---
  console.log("Creating notification logs...");
  for (let i = 0; i < 40; i++) {
    const customer = pick(createdCustomers);
    await prisma.notificationLog.create({
      data: {
        customerId: customer.id,
        channel: pick(["whatsapp", "sms", "email"]),
        messageType: pick([
          "inquiry_confirmation",
          "technician_alert",
          "loadshedding_alert",
          "job_update",
          "maintenance_reminder",
        ]),
        content: `Sample notification for ${customer.name}`,
        status: pick(["sent", "sent", "sent", "failed"]),
        sentAt: daysAgo(randomBetween(0, 30)),
      },
    });
  }
  console.log(`  ✓ 40 notification logs`);

  // --- NEXTAUTH USER — admin login for testing ---
  console.log("Creating admin user...");
  // NextAuth with CredentialsProvider needs a user row. The password is
  // bcrypt-hashed "password123" — dev only, never deployed with this hash.
  await prisma.user.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@ramsatelec.com",
      role: "admin",
      // bcrypt hash of "password123" (10 rounds, bcryptjs $2a)
      passwordHash:
        "$2a$10$1dIr/SxJgShqs/tfda1kfu.DAyxmd3yF550MU7byKd5y4LiFe7g2G",
    },
  });
  console.log(`  ✓ admin user (admin@ramsatelec.com / password123)`);

  // --- FOLLOW-UPS — sample follow-up records for the analytics page ---
  console.log("Creating follow-ups...");
  await prisma.followUp.deleteMany();
  const completedJobs = createdJobs.filter((j: any) => j.status === "complete");
  const themes = [
    "professionalism",
    "timeliness",
    "value_for_money",
    "communication",
    "workmanship",
  ];
  let followUpCount = 0;
  for (const job of completedJobs.slice(0, 25)) {
    const responded = Math.random() > 0.25;
    const stillWorking = responded ? Math.random() > 0.15 : null;
    const satisfaction = responded
      ? pick([3, 4, 4, 5, 5, 5, 4, 5, 3, 4])
      : null;
    const sentimentScore = responded
      ? randomBetween(stillWorking ? 0.5 : -0.5, stillWorking ? 1.0 : 0.3)
      : null;
    const selectedThemes = responded
      ? themes.filter(() => Math.random() > 0.5).slice(0, 3)
      : [];

    await prisma.followUp.create({
      data: {
        jobId: job.id,
        customerId: job.customerId,
        equipmentId: job.equipmentId,
        daysSinceCompletion: Math.floor(randomBetween(7, 90)),
        triggeredAt: daysAgo(Math.floor(randomBetween(1, 60))),
        responseReceived: responded,
        respondedAt: responded ? daysAgo(Math.floor(randomBetween(0, 55))) : null,
        stillWorking,
        satisfactionRating: satisfaction,
        commentText: responded
          ? pick([
              "Great service, everything working perfectly.",
              "Technician was professional and on time.",
              "Good work but a bit pricey.",
              "Excellent! Cold room has been running without issues.",
              "The repair fixed the issue. Happy with the result.",
              "Had to call back once but sorted quickly.",
              "Very satisfied. Will recommend to others.",
              "Average experience. Communication could be better.",
              "Outstanding workmanship. SANS certified and documented.",
              "Quick response to our emergency. Saved our stock.",
            ])
          : null,
        sentimentScore,
        sentimentThemes: selectedThemes.length > 0 ? selectedThemes : [],
        followUpIssueCreated: !stillWorking && responded,
      },
    });
    followUpCount++;
  }
  console.log(`  ✓ ${followUpCount} follow-ups`);

  console.log("\nSeed complete!");
  console.log("Summary:");
  console.log(`  ${createdServiceTypes.length} service types`);
  console.log(`  ${createdCustomers.length} customers`);
  console.log(`  ${createdTechnicians.length} technicians`);
  console.log(`  ${equipmentRecords.length} equipment records`);
  console.log(`  ${createdJobs.length} jobs (45 complete, 15 varied)`);
  console.log(`  30 inquiries (20 converted)`);
  console.log(`  15 quotes`);
  console.log(`  30 maintenance schedules`);
  console.log(`  ${areaZones.length * 14} load-shedding events`);
  console.log(`  40 notification logs`);
  console.log(`  1 admin user`);
  console.log(`  ${followUpCount} follow-ups`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
