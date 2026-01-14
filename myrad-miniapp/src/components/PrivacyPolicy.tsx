import { X } from "lucide-react";

type PrivacyPolicyProps = {
  open: boolean;
  onClose: () => void;
};

export function PrivacyPolicy({ open, onClose }: PrivacyPolicyProps) {
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
          <h2 className="text-3xl font-black mb-2">Privacy Policy</h2>
          <p className="text-sm text-slate-400 font-medium mb-8"><strong>Last updated:</strong> [Date]</p>

          <h3>1. Introduction</h3>
          <p>
            MYRAD is a privacy first platform that enables users to verify certain
            aspects of their digital activity and contribute aggregated,
            anonymized insights to businesses.
          </p>
          <p>
            We are committed to protecting user privacy by design. We do not
            collect, store, or sell raw personal data. This Privacy Policy explains
            what information we process, how we process it, and the choices you
            have.
          </p>

          <h3>2. Core Privacy Principles</h3>
          <ul>
            <li>No raw personal data collection</li>
            <li>Verification without exposure using cryptographic methods</li>
            <li>User consent for every contribution</li>
            <li>Aggregation and anonymization by default</li>
            <li>User control and right to disconnect</li>
          </ul>

          <h3>3. Information We Do Not Collect</h3>
          <p>MYRAD does <strong>not</strong> collect or store:</p>
          <ul>
            <li>Passwords or login credentials of connected platforms</li>
            <li>Raw activity histories such as watch lists, messages, or transactions</li>
            <li>Content of communications</li>
            <li>Contacts or social graphs</li>
            <li>Location tracking data</li>
          </ul>
          <p>
            Verification happens through secure, user initiated flows and
            cryptographic proofs.
          </p>

          <h3>4. Information We Process</h3>
          <p>
            When you choose to connect an external platform, MYRAD may process the
            following <strong>derived and non identifying information</strong>:
          </p>
          <ul>
            <li>Aggregated activity metrics</li>
            <li>Preference and engagement tiers</li>
            <li>Behavioral patterns at a cohort level</li>
            <li>Cryptographic proof metadata confirming verification</li>
          </ul>
          <p>
            This information is processed in a way that prevents identification of
            individual users.
          </p>

          <h3>5. Verification and Zero Knowledge Proofs</h3>
          <p>
            MYRAD uses cryptographic verification mechanisms, including zero
            knowledge proofs, to confirm that certain activity occurred without
            revealing the underlying data.
          </p>
          <p>
            Verification is performed without MYRAD accessing or storing the
            original content of your activity.
          </p>

          <h3>6. Use of Aggregated Insights</h3>
          <p>
            Aggregated and anonymized insights may be shared with business
            customers in the form of cohort level intelligence.
          </p>
          <ul>
            <li>Cannot be traced back to an individual</li>
            <li>Do not include personal identifiers</li>
            <li>Are delivered only after minimum aggregation thresholds are met</li>
          </ul>
          <p><strong>MYRAD does not sell personal data.</strong></p>

          <h3>7. Data Retention</h3>
          <ul>
            <li>Proof metadata and derived signals are retained only as long as necessary for platform operation</li>
            <li>Users may disconnect linked platforms at any time</li>
            <li>Upon disconnection, future verification and contribution stops immediately</li>
          </ul>

          <h3>8. User Rights</h3>
          <p>You have the right to:</p>
          <ul>
            <li>Understand what information is processed</li>
            <li>Withdraw consent at any time</li>
            <li>Disconnect linked platforms</li>
            <li>Request deletion of associated records</li>
          </ul>
          <p>
            Requests can be made through the application interface or by contacting
            us.
          </p>

          <h3>9. Security Measures</h3>
          <p>MYRAD implements industry standard security practices including:</p>
          <ul>
            <li>Encrypted connections using TLS</li>
            <li>Access controls and rate limiting</li>
            <li>Secure infrastructure and monitoring</li>
          </ul>
          <p>
            Despite our efforts, no system is completely secure. Users acknowledge
            inherent risks of online systems.
          </p>

          <h3>10. Regulatory Compliance</h3>
          <p>
            MYRAD is designed to align with applicable privacy regulations,
            including GDPR and CCPA principles, through data minimization and
            anonymization.
          </p>

          <h3>11. Changes to This Policy</h3>
          <p>
            We may update this Privacy Policy from time to time. Changes will be
            posted on this page with an updated date.
          </p>

          <h3>12. Contact</h3>
          <p>
            For privacy related questions, contact:
          </p>
          <p className="font-bold text-slate-900">[contact email]</p>
        </div>
      </div>
    </div>
  );
}
