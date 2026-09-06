import { auth } from "@/auth";
import { redirect } from "next/navigation";

interface ServiceRecord {
  id: string;
  service: string;
  date: string;
  technician: string;
  cost: string;
  status: string;
  equipment: string;
  invoice: string | null;
}

const SERVICE_RECORDS: ServiceRecord[] = [
  {
    id: "SH-001",
    service: "Preventative Maintenance Visit",
    date: "2 June 2026",
    technician: "Samuel Mokoena",
    cost: "R1,200",
    status: "complete",
    equipment: "Cold Room — Frigair CR-2000",
    invoice: "INV-2026-0142",
  },
  {
    id: "SH-002",
    service: "Surge Protection Installation",
    date: "15 May 2026",
    technician: "Daniel Mahlangu",
    cost: "R3,800",
    status: "complete",
    equipment: "Distribution Board — ABB A3",
    invoice: "INV-2026-0128",
  },
  {
    id: "SH-003",
    service: "Emergency Electrical Repair",
    date: "3 April 2026",
    technician: "Samuel Mokoena",
    cost: "R2,100",
    status: "complete",
    equipment: "Distribution Board — ABB A3",
    invoice: "INV-2026-0097",
  },
  {
    id: "SH-004",
    service: "HVAC Filter Replacement & Gas Recharge",
    date: "12 December 2025",
    technician: "Thabo Nkosi",
    cost: "R1,450",
    status: "complete",
    equipment: "HVAC — Samsung AC120F",
    invoice: "INV-2025-0284",
  },
  {
    id: "SH-005",
    service: "Generator Service — Oil & Filter Change",
    date: "5 March 2026",
    technician: "Daniel Mahlangu",
    cost: "R2,200",
    status: "complete",
    equipment: "Generator — Honda EU70is",
    invoice: "INV-2026-0063",
  },
  {
    id: "SH-006",
    service: "Cold Room Compressor Inspection",
    date: "18 January 2026",
    technician: "Samuel Mokoena",
    cost: "R850",
    status: "complete",
    equipment: "Cold Room — Frigair CR-2000",
    invoice: "INV-2026-0019",
  },
  {
    id: "SH-007",
    service: "Electrical Compliance Audit",
    date: "12 March 2026",
    technician: "Daniel Mahlangu",
    cost: "R4,200",
    status: "complete",
    equipment: "Main Installation",
    invoice: "INV-2026-0071",
  },
];

export default async function ServiceHistoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const totalSpent = SERVICE_RECORDS.reduce((acc, r) => {
    const amount = parseInt(r.cost.replace(/[R,\s]/g, ""), 10);
    return acc + amount;
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Service History</h1>
        <p className="text-industrial-400 mt-1">
          Complete record of all services performed by Rams @Elec on your equipment.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-industrial-800 bg-industrial-900">
          <span className="text-sm text-industrial-400">Total Services</span>
          <p className="text-2xl font-bold text-white mt-1">{SERVICE_RECORDS.length}</p>
        </div>
        <div className="p-4 rounded-xl border border-industrial-800 bg-industrial-900">
          <span className="text-sm text-industrial-400">Total Spent</span>
          <p className="text-2xl font-bold text-white mt-1">
            R{totalSpent.toLocaleString()}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-industrial-800 bg-industrial-900">
          <span className="text-sm text-industrial-400">Last Service</span>
          <p className="text-2xl font-bold text-white mt-1">{SERVICE_RECORDS[0].date}</p>
        </div>
      </div>

      {/* Service records table */}
      <div className="bg-industrial-900 rounded-xl border border-industrial-800 overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-industrial-800">
                <th className="text-left px-5 py-3 text-xs font-semibold text-industrial-400 uppercase tracking-wider">Service</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-industrial-400 uppercase tracking-wider">Equipment</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-industrial-400 uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-industrial-400 uppercase tracking-wider">Technician</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-industrial-400 uppercase tracking-wider">Cost</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-industrial-400 uppercase tracking-wider">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {SERVICE_RECORDS.map((record) => (
                <tr key={record.id} className="border-b border-industrial-800 last:border-0 hover:bg-industrial-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <span className="font-medium text-white">{record.service}</span>
                  </td>
                  <td className="px-5 py-4 text-industrial-400">{record.equipment}</td>
                  <td className="px-5 py-4 text-industrial-400">{record.date}</td>
                  <td className="px-5 py-4 text-industrial-400">{record.technician}</td>
                  <td className="px-5 py-4 text-right font-semibold text-white">{record.cost}</td>
                  <td className="px-5 py-4 text-center">
                    {record.invoice ? (
                      <button className="text-xs text-brand-400 hover:text-brand-300 font-medium">
                        {record.invoice}
                      </button>
                    ) : (
                      <span className="text-xs text-industrial-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-industrial-800">
          {SERVICE_RECORDS.map((record) => (
            <div key={record.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-white text-sm">{record.service}</p>
                  <p className="text-xs text-industrial-500">{record.equipment}</p>
                </div>
                <span className="text-sm font-semibold text-white">{record.cost}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-industrial-400">
                <span>{record.date}</span>
                <span>·</span>
                <span>{record.technician}</span>
              </div>
              {record.invoice && (
                <button className="text-xs text-brand-400 hover:text-brand-300 font-medium">
                  Invoice: {record.invoice}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
