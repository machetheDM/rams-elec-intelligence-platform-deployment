import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function CompliancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Compliance Documents</h1>
        <p className="text-industrial-400 mt-1">
          Track your electrical compliance status and prepare COC documentation.
        </p>
      </div>

      {/* Compliance status overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          title="Main Installation"
          status="compliant"
          expiry="12 March 2028"
          description="SANS 10142 Certificate of Compliance"
        />
        <StatusCard
          title="Cold Room Circuit"
          status="expiring"
          expiry="3 September 2026"
          description="Supplementary COC — Cold room installation"
        />
        <StatusCard
          title="Generator Installation"
          status="unknown"
          expiry="—"
          description="COC not yet issued for generator"
        />
      </div>

      {/* Document preparation */}
      <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
        <h2 className="font-semibold text-white mb-2">
          Prepare Compliance Document
        </h2>
        <p className="text-sm text-industrial-400 mb-4">
          This tool pre-populates a Certificate of Compliance draft with your information.
          The output is watermarked &ldquo;DRAFT&rdquo; and requires a registered electrician&apos;s
          signature to become legally valid.
        </p>

        <div className="p-4 bg-brand-500/5 rounded-xl border border-brand-500/20 mb-4">
          <p className="text-sm text-brand-400 font-medium">
            Important Legal Notice
          </p>
          <p className="text-xs text-brand-400/70 mt-1">
            Under South African law (Occupational Health and Safety Act, Electrical Installation
            Regulations), only a registered electrical contractor may issue a valid Certificate of
            Compliance. This tool prepares a DRAFT document for review. Rams @Elec will arrange
            for a registered electrician to inspect your installation and issue the final COC.
          </p>
        </div>

        <form className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-industrial-300 mb-1">
                Property Address
              </label>
              <input
                type="text"
                defaultValue="12 Rivonia Rd, Sandton"
                className="w-full px-3 py-2 rounded-lg border border-industrial-700 bg-industrial-800 text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-industrial-300 mb-1">
                Installation Type
              </label>
              <select className="w-full px-3 py-2 rounded-lg border border-industrial-700 bg-industrial-800 text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent">
                <option>Existing installation — compliance audit</option>
                <option>New installation</option>
                <option>Alteration / addition</option>
                <option>Property transfer</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-industrial-300 mb-1">
              Work Description
            </label>
            <textarea
              rows={3}
              defaultValue="Full electrical compliance audit of main distribution board, socket circuits, lighting circuits, earth continuity, and earth leakage protection. Installation includes cold room circuit and generator changeover switch."
              className="w-full px-3 py-2 rounded-lg border border-industrial-700 bg-industrial-800 text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          <button
            type="button"
            className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-all"
          >
            Generate DRAFT COC
          </button>
        </form>
      </div>

      {/* Document history */}
      <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-5">
        <h2 className="font-semibold text-white mb-4">Document History</h2>
        <div className="space-y-3">
          <DocRow
            name="COC — Main Installation"
            date="12 March 2026"
            status="signed"
            statusLabel="Signed & Issued"
          />
          <DocRow
            name="COC DRAFT — Cold Room Circuit"
            date="15 May 2026"
            status="draft"
            statusLabel="Draft — Pending Inspection"
          />
          <DocRow
            name="Compliance Audit Report"
            date="2 February 2026"
            status="signed"
            statusLabel="Completed"
          />
        </div>
      </div>
    </div>
  );
}

function StatusCard({ title, status, expiry, description }: {
  title: string; status: string; expiry: string; description: string;
}) {
  const statusStyles: Record<string, string> = {
    compliant: "border-green-500/20 bg-green-500/5",
    expiring: "border-brand-500/20 bg-brand-500/5",
    unknown: "border-industrial-700 bg-industrial-800",
  };

  const badges: Record<string, { label: string; className: string }> = {
    compliant: { label: "Compliant", className: "bg-green-500/10 text-green-400" },
    expiring: { label: "Expiring Soon", className: "bg-brand-500/10 text-brand-400" },
    unknown: { label: "Unknown", className: "bg-industrial-700 text-industrial-400" },
  };

  // eslint-disable-next-line security/detect-object-injection -- status is a component prop from a fixed set of literals, not user input
  const badge = badges[status] || badges.unknown;

  return (
    // eslint-disable-next-line security/detect-object-injection -- status is a component prop from a fixed set of literals, not user input
    <div className={`p-4 rounded-xl border ${statusStyles[status] || statusStyles.unknown}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-white text-sm">{title}</h3>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.className}`}>
          {badge.label}
        </span>
      </div>
      <p className="text-xs text-industrial-400">{description}</p>
      <p className="text-xs text-industrial-400 mt-1">
        Expires: <span className="font-medium">{expiry}</span>
      </p>
    </div>
  );
}

function DocRow({ name, date, status, statusLabel }: {
  name: string; date: string; status: string; statusLabel: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-industrial-800 last:border-0">
      <div>
        <p className="text-sm font-medium text-white">{name}</p>
        <p className="text-xs text-industrial-500">{date}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
          status === "signed"
            ? "bg-green-500/10 text-green-400"
            : "bg-industrial-700 text-industrial-400"
        }`}>
          {statusLabel}
        </span>
        <button className="text-xs text-brand-400 hover:text-brand-300 font-medium">
          View
        </button>
      </div>
    </div>
  );
}
