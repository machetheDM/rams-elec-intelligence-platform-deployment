import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {session.user.name?.split(" ")[0]}
        </h1>
        <p className="text-industrial-400 mt-1">
          Here&apos;s an overview of your services with Rams @Elec.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Jobs" value="2" color="amber" />
        <StatCard title="Equipment" value="4" color="blue" />
        <StatCard title="Next Service" value="12 Aug" color="green" />
        <StatCard title="Compliance" value="Current" color="emerald" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/chatbot"
          className="p-5 bg-industrial-900 rounded-xl border border-industrial-800 hover:border-brand-500/50 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-brand-400 transition-colors">
                Ask the AI Assistant
              </h3>
              <p className="text-sm text-industrial-400">
                Get instant answers about your equipment, maintenance, and compliance.
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/inquire"
          className="p-5 bg-industrial-900 rounded-xl border border-industrial-800 hover:border-brand-500/50 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-brand-400 transition-colors">
                Request a Service
              </h3>
              <p className="text-sm text-industrial-400">
                Submit a new inquiry and get an instant AI-powered cost estimate.
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Upcoming maintenance */}
      <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-5">
        <h2 className="font-semibold text-white mb-4">Upcoming Maintenance</h2>
        <div className="space-y-3">
          <MaintenanceRow
            equipment="Cold Room — Frigair CR-2000"
            date="12 August 2026"
            status="scheduled"
          />
          <MaintenanceRow
            equipment="Generator — Honda EU70is"
            date="3 September 2026"
            status="scheduled"
          />
          <MaintenanceRow
            equipment="HVAC — Samsung AC120F"
            date="15 June 2026"
            status="overdue"
          />
        </div>
      </div>

      {/* Recent jobs */}
      <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-5">
        <h2 className="font-semibold text-white mb-4">Recent Service History</h2>
        <div className="space-y-3">
          <JobRow
            service="Preventative Maintenance Visit"
            date="2 June 2026"
            technician="Samuel Mokoena"
            cost="R1,200"
            status="complete"
          />
          <JobRow
            service="Surge Protection Installation"
            date="15 May 2026"
            technician="Daniel Mahlangu"
            cost="R3,800"
            status="complete"
          />
          <JobRow
            service="Emergency Electrical Repair"
            date="3 April 2026"
            technician="Samuel Mokoena"
            cost="R2,100"
            status="complete"
          />
        </div>
        <Link
          href="/service-history"
          className="inline-block mt-4 text-sm text-brand-400 hover:text-brand-300 font-medium"
        >
          View all service history →
        </Link>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
  const colorClasses: Record<string, string> = {
    amber: "bg-brand-500/5 border-brand-500/20",
    blue: "bg-blue-500/5 border-blue-500/20",
    green: "bg-green-500/5 border-green-500/20",
    emerald: "bg-emerald-500/5 border-emerald-500/20",
  };

  return (
    // eslint-disable-next-line security/detect-object-injection -- color is a component prop from a fixed set of literals, not user input
    <div className={`p-4 rounded-xl border ${colorClasses[color] || colorClasses.amber}`}>
      <span className="text-sm text-industrial-400">{title}</span>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function MaintenanceRow({ equipment, date, status }: { equipment: string; date: string; status: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-industrial-800 last:border-0">
      <div>
        <p className="text-sm font-medium text-white">{equipment}</p>
        <p className="text-xs text-industrial-500">{date}</p>
      </div>
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
        status === "overdue"
          ? "bg-red-500/10 text-red-400"
          : "bg-green-500/10 text-green-400"
      }`}>
        {status}
      </span>
    </div>
  );
}

function JobRow({ service, date, technician, cost, status }: {
  service: string; date: string; technician: string; cost: string; status: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-industrial-800 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{service}</p>
        <p className="text-xs text-industrial-500">{date} · {technician}</p>
      </div>
      <div className="flex items-center gap-3 ml-4">
        <span className="text-sm font-semibold text-white">{cost}</span>
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/10 text-green-400">
          {status}
        </span>
      </div>
    </div>
  );
}
