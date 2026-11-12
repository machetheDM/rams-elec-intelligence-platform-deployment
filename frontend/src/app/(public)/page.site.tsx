import AboutSection from "@/components/home/AboutSection";
import ContactSection from "@/components/home/ContactSection";
import HeroSection from "@/components/home/HeroSection";
import ProcessSection from "@/components/home/ProcessSection";
import ServicesBento from "@/components/home/ServicesBento";

/**
 * Landing page — composition only.
 *
 * TWELVE SECTIONS BECAME FIVE, and most of the cuts were not a matter of taste.
 *
 * The public site is a static export with no server. Four of the sections that
 * were here could not work in it, and would have rendered and then visibly
 * failed in front of real customers:
 *
 *   InquiryForm (inline)   POST /api/triage/*          route handler, 404 in an export
 *   QuoteEstimatorStats    GET  /api/model-metrics     route handler, 404 in an export
 *   AlertSignupSection     POST /api/alerts/subscribe  route handler, 404 in an export
 *   LoadSheddingWidget     browser -> localhost:8002   the VISITOR's own machine
 *
 * The rest were judgement, recorded so they are not quietly restored:
 *
 *   TestimonialsSection    REAL_TESTIMONIALS is an empty array on purpose, so it
 *                          had nothing true to show.
 *   SecurityTrustSection   Describes this platform's DevSecOps posture. That is
 *                          portfolio evidence, and it belongs in the repository
 *                          and the private app — not on the page where someone
 *                          is trying to find out who fixes their cold room.
 *   RiskSection            Was built around four statistics that were removed for
 *                          being unsourced. What was left was fear with no figures.
 *   CtaSection             A third copy of "get in touch", after the hero and the
 *                          contact section.
 *
 * What remains answers the four questions a visitor actually arrives with: what
 * do you do, how does a job work, who are you, how do I reach you. The quote
 * form lives on /inquire, where it posts to the Manager app and works.
 *
 * Every section below is static. If a new one needs data, it has to come from
 * the Manager app's public API or be built in at export time — there is no
 * server to call.
 */

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ServicesBento />
      <ProcessSection />
      <AboutSection />
      <ContactSection />
    </>
  );
}
