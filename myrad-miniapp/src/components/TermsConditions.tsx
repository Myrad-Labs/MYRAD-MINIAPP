import { X } from "lucide-react";

type TermsConditionsProps = {
  open: boolean;
  onClose: () => void;
};

export function TermsConditions({ open, onClose }: TermsConditionsProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200 scrollbar-hide"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all"
          onClick={onClose}
        >
          <X size={24} />
        </button>

        <div className="prose prose-slate max-w-none prose-headings:font-black prose-headings:text-slate-900 prose-p:text-slate-600 prose-a:text-slate-900">
          <h2 className="text-3xl font-black mb-2">Terms and Conditions</h2>
          <p className="text-sm text-slate-400 font-medium mb-8"><strong>Last updated:</strong> [Date]</p>

          <h3>1. Acceptance of Terms</h3>
          <p>
            By accessing or using MYRAD, you agree to these Terms and Conditions.
            If you do not agree, do not use the platform.
          </p>

          <h3>2. Description of Service</h3>
          <p>
            MYRAD provides tools that allow users to verify certain digital
            activities and contribute anonymized, aggregated insights to third
            parties.
          </p>
          <p>
            MYRAD does not provide financial advice, investment advice, or
            guarantees of earnings.
          </p>

          <h3>3. User Responsibilities</h3>
          <p>You agree to:</p>
          <ul>
            <li>Provide accurate information where required</li>
            <li>Use the platform only for lawful purposes</li>
            <li>Not attempt to manipulate or falsify verification</li>
            <li>Not interfere with platform security or integrity</li>
          </ul>
          <p>
            Violation may result in suspension or termination.
          </p>

          <h3>4. Rewards and Compensation</h3>
          <ul>
            <li>Any rewards offered are discretionary and subject to change</li>
            <li>Rewards may vary based on contribution type and availability</li>
            <li>MYRAD does not guarantee specific earnings</li>
          </ul>
          <p>
            Rewards are not wages or employment compensation.
          </p>

          <h3>5. Intellectual Property</h3>
          <p>
            All platform content, software, and trademarks are owned by MYRAD or
            its licensors.
          </p>
          <p>
            Users retain ownership of their underlying data. By using the
            platform, users grant MYRAD a limited right to process derived and
            anonymized insights as described.
          </p>

          <h3>6. No Warranty</h3>
          <p>
            MYRAD is provided on an “as is” and “as available” basis.
          </p>
          <p>
            We do not guarantee uninterrupted access, error free operation, or
            specific outcomes.
          </p>

          <h3>7. Limitation of Liability</h3>
          <p>
            To the maximum extent permitted by law, MYRAD shall not be liable for:
          </p>
          <ul>
            <li>Indirect or consequential damages</li>
            <li>Loss of data, profits, or opportunities</li>
            <li>Third party platform changes or outages</li>
          </ul>

          <h3>8. Third Party Services</h3>
          <p>
            MYRAD may integrate with third party services. MYRAD is not responsible
            for the policies or practices of those services.
          </p>

          <h3>9. Termination</h3>
          <p>
            MYRAD may suspend or terminate access if these terms are violated or if
            required by law.
          </p>
          <p>
            Users may stop using the platform at any time.
          </p>

          <h3>10. Governing Law</h3>
          <p>
            These Terms are governed by the laws of [Jurisdiction], without regard
            to conflict of law principles.
          </p>

          <h3>11. Changes to Terms</h3>
          <p>
            We may update these Terms from time to time. Continued use constitutes
            acceptance of updated terms.
          </p>

          <h3>12. Contact</h3>
          <p>
            For questions regarding these Terms, contact:
          </p>
          <p className="font-bold text-slate-900">[contact email]</p>
        </div>
      </div>
    </div>
  );
}
