"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

/**
 * Gallery / portfolio page.
 *
 * Showcases completed project categories with representative stock imagery
 * from Unsplash (free under the Unsplash License). These images represent the
 * TYPE of work performed — they are not photos from specific Rams @Elec jobs.
 * They will be replaced with actual project photography when available.
 */

type Category = "all" | "cold-rooms" | "electrical" | "hvac" | "emergency";

interface Project {
  id: string;
  title: string;
  category: Exclude<Category, "all">;
  description: string;
  details: string[];
  location: string;
  image: string;
  imageAlt: string;
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "all", label: "All Projects" },
  { value: "cold-rooms", label: "Cold Rooms" },
  { value: "electrical", label: "Electrical" },
  { value: "hvac", label: "HVAC & AC" },
  { value: "emergency", label: "Emergency" },
];

const PROJECTS: Project[] = [
  {
    id: "cr-01",
    title: "Commercial Cold Room — Walk-In Freezer",
    category: "cold-rooms",
    description: "Custom-engineered -18°C walk-in freezer for a supermarket distribution centre. Dual-compressor redundancy with automated defrost cycling.",
    details: ["40m³ capacity", "Dual Bitzer compressors", "Polyurethane panel insulation", "Digital temp monitoring"],
    location: "Polokwane, Limpopo",
    image: "https://images.unsplash.com/photo-1504192010706-dd7f569ee2be?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Commercial cold storage facility interior",
  },
  {
    id: "cr-02",
    title: "Restaurant Chiller Room",
    category: "cold-rooms",
    description: "Positive-temperature storage room with separate produce and protein zones, designed for food safety compliance.",
    details: ["Two-zone temperature control", "Stainless steel shelving", "Strip curtain entry", "Health dept. compliant"],
    location: "Midrand, Gauteng",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Commercial refrigeration storage shelving",
  },
  {
    id: "el-01",
    title: "Industrial Distribution Board Upgrade",
    category: "electrical",
    description: "Full DB replacement on a manufacturing floor — 200A three-phase with per-circuit isolation, surge protection, and earth leakage on every outgoing.",
    details: ["200A 3-phase main", "32 outgoing circuits", "Type 2 SPD", "SANS 10142 certified"],
    location: "Centurion, Gauteng",
    image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Industrial electrical distribution panel with circuit breakers",
  },
  {
    id: "el-02",
    title: "Warehouse Lighting & Power",
    category: "electrical",
    description: "Complete rewiring of a 2,000m² warehouse with high-bay LED lighting, emergency lighting, and dedicated power circuits for dock equipment.",
    details: ["LED high-bay fixtures", "Emergency lighting", "Dock door power", "Fire alarm integration"],
    location: "Pretoria East, Gauteng",
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Industrial warehouse with electrical installations",
  },
  {
    id: "el-03",
    title: "Residential Compliance Audit",
    category: "electrical",
    description: "Full SANS 10142 audit and remediation for property transfer. Replaced outdated fuse box with modern MCB/RCD board and issued Certificate of Compliance.",
    details: ["Full inspection report", "DB replacement", "Earth leakage testing", "COC issued"],
    location: "Sandton, Gauteng",
    image: "https://images.unsplash.com/photo-1555664424-58f6a2b33024?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Residential electrical panel and wiring inspection",
  },
  {
    id: "hv-01",
    title: "Office HVAC — Multi-Split System",
    category: "hvac",
    description: "Samsung multi-split air conditioning serving 6 zones across two floors. Centrally controlled with individual zone thermostats.",
    details: ["6-zone multi-split", "Central controller", "Inverter technology", "Energy rating: A++"],
    location: "Sandton, Gauteng",
    image: "https://images.unsplash.com/photo-1575806980027-9e8310a6e4ab?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Commercial HVAC air conditioning units on building exterior",
  },
  {
    id: "hv-02",
    title: "Server Room Precision Cooling",
    category: "hvac",
    description: "24/7 precision cooling for a 20-rack server room with redundant units, humidity control, and temperature alarming.",
    details: ["Redundant cooling", "Humidity control", "SNMP alarm integration", "UPS-backed"],
    location: "Midrand, Gauteng",
    image: "https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Server room with precision cooling infrastructure",
  },
  {
    id: "em-01",
    title: "Emergency Power Restoration",
    category: "emergency",
    description: "After-hours emergency response to a complete power failure at a cold storage facility. Identified failed main breaker, replaced on-site, and restored power within 90 minutes.",
    details: ["90-minute restoration", "Main breaker replacement", "Cold chain preserved", "After-hours callout"],
    location: "Polokwane, Limpopo",
    image: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Emergency electrical repair and power restoration",
  },
  {
    id: "em-02",
    title: "Generator Installation & ATS",
    category: "emergency",
    description: "60kVA diesel generator with automatic transfer switch for a medical practice. Seamless changeover on grid failure — no manual intervention needed.",
    details: ["60kVA Cummins genset", "Automatic transfer switch", "Weekly self-test cycle", "Fuel level monitoring"],
    location: "Bela-Bela, Limpopo",
    image: "https://images.unsplash.com/photo-1513828583688-c52646db42da?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Industrial diesel generator for backup power",
  },
];

const CATEGORY_ICONS: Record<string, { bg: string; icon: string }> = {
  "cold-rooms": { bg: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  electrical: { bg: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  hvac: { bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  emergency: { bg: "bg-red-500/10 text-red-400 border-red-500/20", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
};

export default function GalleryPage() {
  const [filter, setFilter] = useState<Category>("all");

  const filtered = filter === "all"
    ? PROJECTS
    : PROJECTS.filter((p) => p.category === filter);

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="mono-label">Project Portfolio</span>
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold text-white">
            Visual Mastery
          </h1>
          <p className="mt-4 text-industrial-400 max-w-xl mx-auto">
            Every project showcases the standard of wiring, mounting, and insulation that
            every client receives. Browse our completed work by category.
          </p>
        </div>

        {/* Verification banner */}
        <div className="mb-10 p-4 rounded-xl border border-industrial-800 bg-industrial-900/60 text-center">
          <p className="text-sm text-industrial-400">
            <span className="text-brand-500 font-semibold">Transparency note:</span>{" "}
            Images shown are representative stock photos (Unsplash) illustrating the type of work
            we perform. Actual project photography from completed Rams @Elec jobs is being compiled.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setFilter(cat.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === cat.value
                  ? "bg-brand-500 text-white"
                  : "bg-industrial-900 text-industrial-400 border border-industrial-800 hover:border-brand-500/50 hover:text-brand-400"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Project grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <h2 className="text-2xl font-bold text-white">Impressed by our work?</h2>
          <p className="mt-3 text-industrial-400 max-w-md mx-auto">
            Every project represents a real client who trusted Rams @Elec. We are ready to
            bring this same level of professional mastery to yours.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/inquire" className="btn-primary">
              Start Your Project
            </Link>
            <Link href="/services" className="btn-outline">
              View Service Catalog
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const catStyle = CATEGORY_ICONS[project.category] ?? CATEGORY_ICONS.electrical;

  return (
    <div className="card-glow group flex flex-col">
      {/* Project image */}
      <div className="relative h-52 rounded-t-2xl -mx-6 -mt-6 mb-5 overflow-hidden border-b border-industrial-800">
        <Image
          src={project.image}
          alt={project.imageAlt}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-industrial-950/80 via-transparent to-transparent" />
        <div className="absolute top-3 right-3">
          <span className={`text-xs px-2.5 py-1 rounded-full border backdrop-blur-sm ${catStyle.bg}`}>
            {project.category.replace("-", " ")}
          </span>
        </div>
      </div>

      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-base font-semibold text-white group-hover:text-brand-400 transition-colors">
          {project.title}
        </h3>
      </div>

      <p className="text-sm text-industrial-400 leading-relaxed mb-4">
        {project.description}
      </p>

      {/* Details list */}
      <ul className="space-y-1.5 mb-4">
        {project.details.map((detail) => (
          <li key={detail} className="flex items-center gap-2 text-xs text-industrial-300">
            <svg className="w-3 h-3 text-brand-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            {detail}
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-industrial-800 flex items-center justify-between">
        <span className="text-xs text-industrial-500">
          {project.location}
        </span>
        <span className={`text-xs px-2.5 py-1 rounded-full border ${catStyle.bg}`}>
          {project.category.replace("-", " ")}
        </span>
      </div>
    </div>
  );
}
