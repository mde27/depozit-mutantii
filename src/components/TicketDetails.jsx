import { ADDRESS_SECTIONS, blocksFromInfo } from '../utils/addresses';

// Compact collapsible "Detalii" block for a ticket: PM BT + all addresses.
// Works with new tickets (info.pickups/deliveries/returns) and old single-address tickets.
export default function TicketDetails({ info = {} }) {
  const sections = ['pickups', 'deliveries', 'returns']
    .map((s) => ({ key: s, cfg: ADDRESS_SECTIONS[s], blocks: blocksFromInfo(info, s) }))
    .filter((s) => s.key !== 'returns' || info.solicit_retur || s.blocks.length > 0);

  return (
    <details className="mb-4 rounded-xl border border-rose-100 bg-rose-50/40 text-sm" data-testid="ticket-details">
      <summary className="cursor-pointer select-none px-3 py-2 font-semibold text-rose-800">
        Detalii
        <span className="font-normal text-rose-500">
          {' · '}
          {sections.map((s) => `${s.cfg.short}: ${s.blocks.length}`).join(' · ')}
        </span>
      </summary>
      <div className="px-3 pb-3 space-y-3">
        <p className="text-gray-700">
          <span className="font-semibold text-rose-800">PM BT:</span> {info.pm_bt || '—'}
          {info.pm_bt_phone ? <> · Tel: {info.pm_bt_phone}</> : null}
        </p>
        {sections.map((s) => (
          <div key={s.key}>
            <p className="font-semibold text-rose-800 mb-1">{s.cfg.short}</p>
            {s.blocks.length === 0 ? (
              <p className="text-gray-400 text-xs">—</p>
            ) : (
              <ol className="space-y-1.5">
                {s.blocks.map((b, i) => (
                  <li key={i} className="bg-white/80 border border-rose-100 rounded-lg px-3 py-2">
                    <span className="text-rose-400 font-semibold mr-1.5">{i + 1}.</span>
                    <span className="text-gray-800">
                      {[b.address, b.localitate, b.judet].filter(Boolean).join(', ') || '—'}
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      {[b.date, b.interval].filter(Boolean).join(' ') || 'fără dată'}
                      {b.phone ? ` · Tel: ${b.phone}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}