import InquiryForm from "@/components/inquiry/InquiryForm";
import HeroSection from "@/components/home/HeroSection";
import ServicesBento from "@/components/home/ServicesBento";
import ProcessSection from "@/components/home/ProcessSection";
import QuoteEstimatorStats from "@/components/home/QuoteEstimatorStats";
import RiskSection from "@/components/home/RiskSection";
import AboutSection from "@/components/home/AboutSection";
import SecurityTrustSection from "@/components/home/SecurityTrustSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import AlertSignupSection from "@/components/home/AlertSignupSection";
import ContactSection from "@/components/home/ContactSection";
import CtaSection from "@/components/home/CtaSection";

/**
 * Landing page — composition only.
 *
 * Every section is an isolated component under components/home/, and all
 * dynamic data arrives via hooks (useModelMetrics, useChatbot,
 * useSecurityStatus) rather than being fetched here. Sections can be
 * restyled or reordered without touching any data or business logic.
 */
export default function HomePage() {
  return (
    <div className="min-h-screen">
      <HeroSection />

      {/* AI inquiry form — overlaps the hero for depth */}
      <section id="inquire" className="relative z-10 -mt-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 text-center">
            <span className="mono-label">01 / AI-Powered Intelligence</span>
            <h2 className="mt-3 text-2xl font-bold text-white">
              Describe your problem. Get an instant estimate.
            </h2>
          </div>
          <InquiryForm />
        </div>
      </section>

      <ServicesBento />
      <ProcessSection />
      <QuoteEstimatorStats />
      <RiskSection />
      <AboutSection />
      <SecurityTrustSection />
      <TestimonialsSection />
      <AlertSignupSection />
      <ContactSection />
      <CtaSection />
    </div>
  );
}
