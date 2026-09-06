import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function EquipmentPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Equipment</h1>
          <p className="text-industrial-400 mt-1">
            Track all registered equipment, maintenance schedules, and warranty status.
          </p>
        </div>
        <button className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-all">
          + Add Equipment
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Total Equipment" value="4" />
        <SummaryCard title="Under Warranty" value="2" />
        <SummaryCard title="Service Due" value="1" />
        <SummaryCard title="Overdue" value="1" />
      </div>

      {/* Equipment list */}
      <div className="space-y-4">
        <EquipmentCard
          name="Cold Room — Frigair CR-2000"
          category="Refrigeration"
          location="Warehouse B, Sandton"
          installDate="15 March 2024"
          warrantyExpiry="15 March 2027"
          warrantyStatus="active"
          nextService="12 August 2026"
          serviceStatus="scheduled"
          lastService="2 June 2026"
          serialNumber="FR-CR2000-2024-0847"
        />
        <EquipmentCard
          name="Generator — Honda EU70is"
          category="Backup Power"
          location="Main Building, Sandton"
          installDate="8 November 2023"
          warrantyExpiry="8 November 2026"
          warrantyStatus="active"
          nextService="3 September 2026"
          serviceStatus="scheduled"
          lastService="5 March 2026"
          serialNumber="HN-EU70-2023-1294"
        />
        <EquipmentCard
          name="HVAC — Samsung AC120F"
          category="Air Conditioning"
          location="Office Floor 2, Sandton"
          installDate="20 January 2022"
          warrantyExpiry="20 January 2025"
          warrantyStatus="expired"
          nextService="15 June 2026"
          serviceStatus="overdue"
          lastService="12 December 2025"
          serialNumber="SM-AC120F-2022-0331"
        />
        <EquipmentCard
          name="Distribution Board — ABB A3"
          category="Electrical"
          location="Main Building, Sandton"
          installDate="5 July 2025"
          warrantyExpiry="5 July 2028"
          warrantyStatus="active"
          nextService="5 January 2027"
          serviceStatus="upcoming"
          lastService="5 July 2025"
          serialNumber="ABB-A3-2025-0562"
        />
      </div>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="p-4 rounded-xl border border-industrial-800 bg-industrial-900">
      <span className="text-sm text-industrial-400">{title}</span>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function EquipmentCard({
  name, category, location, installDate, warrantyExpiry, warrantyStatus,
  nextService, serviceStatus, lastService, serialNumber,
}: {
  name: string; category: string; location: string; installDate: string;
  warrantyExpiry: string; warrantyStatus: string; nextService: string;
  serviceStatus: string; lastService: string; serialNumber: string;
}) {
  const warrantyStyles: Record<string, { label: string; className: string }> = {
    active: { label: "Under Warranty", className: "bg-green-500/10 text-green-400" },
    expired: { label: "Warranty Expired", className: "bg-red-500/10 text-red-400" },
  };

  const serviceStyles: Record<string, { label: string; className: string }> = {
    scheduled: { label: "Scheduled", className: "bg-green-500/10 text-green-400" },
    overdue: { label: "Overdue", className: "bg-red-500/10 text-red-400" },
    upcoming: { label: "Upcoming", className: "bg-blue-500/10 text-blue-400" },
  };

  // eslint-disable-next-line security/detect-object-injection -- warrantyStatus is a component prop from a fixed set of literals, not user input
  const warranty = warrantyStyles[warrantyStatus] || warrantyStyles.expired;
  // eslint-disable-next-line security/detect-object-injection -- serviceStatus is a component prop from a fixed set of literals, not user input
  const service = serviceStyles[serviceStatus] || serviceStyles.upcoming;

  return (
    <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-white">{name}</h3>
          <p className="text-xs text-industrial-500 mt-0.5">{category} · {location}</p>
        </div>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${warranty.className}`}>
          {warranty.label}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-xs text-industrial-500 block">Serial Number</span>
          <span className="text-industrial-300 font-mono text-xs">{serialNumber}</span>
        </div>
        <div>
          <span className="text-xs text-industrial-500 block">Installed</span>
          <span className="text-industrial-300">{installDate}</span>
        </div>
        <div>
          <span className="text-xs text-industrial-500 block">Warranty Expires</span>
          <span className="text-industrial-300">{warrantyExpiry}</span>
        </div>
        <div>
          <span className="text-xs text-industrial-500 block">Last Serviced</span>
          <span className="text-industrial-300">{lastService}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-industrial-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-industrial-500">Next service:</span>
          <span className="text-sm font-medium text-white">{nextService}</span>
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${service.className}`}>
            {service.label}
          </span>
        </div>
        <button className="text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors">
          View Details
        </button>
      </div>
    </div>
  );
}
