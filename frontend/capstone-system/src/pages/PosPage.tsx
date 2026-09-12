import PosCheckout from '../component/PosCheckout';

export default function PosPage() {
  return (
    <div className="space-y-6">
      {/* Title block formatted in clean Sentence Case */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Point of Sale</h2>
        <p className="text-sm text-slate-500 mt-1">Bill products and services against a patient's appointment.</p>
      </div>

      {/* Renders the product catalog, cart, and checkout flow */}
      <PosCheckout />
    </div>
  );
}
