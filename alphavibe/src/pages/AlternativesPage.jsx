import AlternativeDataPanel from '../components/AlternativeDataPanel';

export default function AlternativesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[#e6edf3] mb-1">Alternative Data</h2>
        <p className="text-sm text-[#8b949e]">
          Proprietary signal feeds — satellite imagery, customs flow, shipping chokepoints.
        </p>
      </div>
      <AlternativeDataPanel />
    </div>
  );
}
