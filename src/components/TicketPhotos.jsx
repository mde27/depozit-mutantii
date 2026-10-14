import { photoThumbUrl, photoViewUrl } from '../utils/images';

// Thumbnails of the photos attached to a ticket (info.photos = [{ id, name }]).
// Each opens the full photo in Google Drive. Renders nothing for tickets without photos.
export default function TicketPhotos({ photos }) {
  const list = (Array.isArray(photos) ? photos : []).filter((p) => p && p.id);
  if (!list.length) return null;
  return (
    <div className="mb-4" data-testid="ticket-photos">
      <p className="text-xs font-semibold text-rose-800 mb-1.5">📷 Poze ({list.length})</p>
      <div className="flex flex-wrap gap-2">
        {list.map((p, i) => (
          <a
            key={p.id}
            href={photoViewUrl(p.id)}
            target="_blank"
            rel="noopener noreferrer"
            title={p.name || `Poza ${i + 1}`}
            className="block w-20 h-20 rounded-lg overflow-hidden border border-rose-100 bg-rose-50 hover:ring-2 hover:ring-rose-300"
          >
            <img
              src={photoThumbUrl(p.id)}
              alt={p.name || `Poza ${i + 1}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Fallback thumbnail endpoint (tried once).
                if (!e.currentTarget.dataset.fallback) {
                  e.currentTarget.dataset.fallback = '1';
                  e.currentTarget.src = `https://drive.google.com/thumbnail?id=${encodeURIComponent(p.id)}&sz=w400`;
                }
              }}
              className="w-full h-full object-cover"
            />
          </a>
        ))}
      </div>
    </div>
  );
}
