/**
 * Contact information section — anchored by id="contact" for nav scrolling.
 *
 * Replicates the contact details from the live ramsatelec.com site.
 * No fabricated or inferred information.
 */
export default function ContactSection() {
  return (
    <section id="contact" className="relative border-y border-industrial-800 bg-industrial-900/40 py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0 bg-grid-fine opacity-30" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-20">
          {/* Left — heading and map placeholder */}
          <div className="lg:col-span-5">
            <span className="mono-label">11 / Command Center</span>
            <h2 className="section-heading mt-4">
              Ready to
              <br />
              <span className="gradient-text">engineer safety?</span>
            </h2>
            <p className="section-subheading mt-5">
              Our standalone inquiry portal is now live. Submit your technical scope and let our
              regional leads engineer your solution.
            </p>

            {/* Map placeholder */}
            <div className="mt-8 tile overflow-hidden h-48 flex items-center justify-center">
              <div className="text-center">
                <svg className="mx-auto h-8 w-8 text-industrial-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="mt-2 text-xs text-industrial-500">Polokwane Mankweng, Limpopo</p>
              </div>
            </div>
          </div>

          {/* Right — contact cards */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Location */}
            <div className="tile p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500 ring-1 ring-inset ring-brand-500/20">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-white">Headquarters</h3>
              <p className="mt-1 text-sm text-industrial-400">Mogaladi stand 287B</p>
              <p className="text-sm text-industrial-400">Polokwane Mankweng</p>
              <p className="text-sm text-industrial-400">Limpopo, South Africa</p>
            </div>

            {/* Phone */}
            <div className="tile p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500 ring-1 ring-inset ring-brand-500/20">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-white">Call Us</h3>
              <a href="tel:+27711018493" className="mt-1 block text-sm text-brand-500 hover:text-brand-400 transition-colors">
                +27 71 101 8493
              </a>
              <p className="mt-1 text-xs text-industrial-500">24/7 for emergencies</p>
            </div>

            {/* Email */}
            <div className="tile p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500 ring-1 ring-inset ring-brand-500/20">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-white">Email</h3>
              <a href="mailto:ramsatelec@gmail.com" className="mt-1 block text-sm text-brand-500 hover:text-brand-400 transition-colors">
                ramsatelec@gmail.com
              </a>
              <p className="mt-1 text-xs text-industrial-500">Replies within 24 hours</p>
            </div>

            {/* Hours */}
            <div className="tile p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500 ring-1 ring-inset ring-brand-500/20">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-white">Operations</h3>
              <ul className="mt-1 space-y-0.5 text-sm text-industrial-400">
                <li>Mon – Fri: 08:00 – 18:00</li>
                <li>Saturday: 09:00 – 16:00</li>
                <li className="text-brand-500 font-medium">Sunday: Emergency Task Force</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
