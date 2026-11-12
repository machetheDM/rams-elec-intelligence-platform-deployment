import EnquiryForm from "@/components/inquiry/EnquiryForm";
import { FALLBACK_PHONE } from "@/lib/api/enquiries";

/**
 * Public enquiry page.
 *
 * Uses EnquiryForm, which posts to the Manager app's public enquiry endpoint.
 * It deliberately does NOT use InquiryForm (the AI triage estimator): that
 * form needs a same-origin route handler to hold the triage service's API
 * key, and the public build is a static export with no server to run one.
 *
 * The copy changed with it. The previous version promised an instant AI cost
 * estimate "in seconds"; what actually happens now is that a person reads the
 * enquiry and phones back. Leaving the old wording would have been a claim the
 * site could not keep — see the honesty principle in CLAUDE.md.
 */

export const metadata = {
  title: "Request a quote | Rams @Elec",
  description:
    "Tell us what needs fixing and we will come back to you with a quote. Electrical and refrigeration work across Gauteng and Limpopo.",
};

export default function InquirePage() {
  return (
    <div className="min-h-screen pb-16 pt-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">Request a quote</h1>
        <p className="mt-4 text-lg text-industrial-300">
          Tell us what needs fixing and where you are. One of our team reads every enquiry and
          comes back to you directly — usually the same working day.
        </p>
        <p className="mt-2 text-industrial-400">
          Electrical and refrigeration work across Gauteng and Limpopo. If it cannot wait, phone{" "}
          <a
            className="font-medium text-brand-400 underline"
            href={`tel:${FALLBACK_PHONE.replace(/[^+\d]/g, "")}`}
          >
            {FALLBACK_PHONE}
          </a>
          .
        </p>

        <div className="mt-8">
          <EnquiryForm />
        </div>
      </div>
    </div>
  );
}
