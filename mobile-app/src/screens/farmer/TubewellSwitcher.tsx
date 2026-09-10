import { useSelectionStore } from '../../store/tubewellSelection.store';
import { useMyTubewells } from './hooks';
import { useToast } from '../../components/ui';
import { formatINR } from '../../utils/formatters';

export function TubewellSwitcher() {
  const { tubewells } = useMyTubewells();
  const selected = useSelectionStore((s) => s.farmerTubewellId);
  const setSelected = useSelectionStore((s) => s.setFarmerTubewell);
  const { toast } = useToast();

  const approved = tubewells.filter((t) => t.membershipStatus === 'approved');
  if (approved.length <= 0) return null;

  return (
    <>
      {toast}
      <label style={{ marginTop: 0 }}>Selected tubewell</label>
      <select
        value={selected ?? approved[0]?.tubewellId ?? ''}
        onChange={(e) => {
          void setSelected(e.target.value);
        }}
      >
        {approved.map((t) => (
          <option key={t.tubewellId} value={t.tubewellId}>
            {t.name} — ₹{formatINR(t.ratePerHour * 100)}/hr
          </option>
        ))}
      </select>
      <p className="muted" style={{ fontSize: '0.78rem', margin: '8px 0 0' }}>
        Water records stay with the tubewell they belong to.
      </p>
    </>
  );
}