import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function TorrentNotificationPopup() {
  const [magnetLink, setMagnetLink] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handlePaste = (e) => {
      const text = e.clipboardData.getData('text');
      if (text.startsWith('magnet:?')) {
        setMagnetLink(text);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const handlePlay = () => {
    navigate(createPageUrl('Player') + '?magnet=' + encodeURIComponent(magnetLink));
    setMagnetLink(null);
  };

  if (!magnetLink) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-[#13131f] border border-blue-500/30 rounded-lg p-4 shadow-2xl max-w-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-sm mb-1">
              Link Magnet Detectado
            </h3>
            <p className="text-slate-400 text-xs mb-3">
              Deseja assistir este conteúdo agora?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handlePlay}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-md font-medium transition-colors"
                data-testid="torrent-popup-play-btn"
              >
                Assistir Agora
              </button>
              <button
                onClick={() => setMagnetLink(null)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-md font-medium transition-colors"
                data-testid="torrent-popup-dismiss-btn"
              >
                Ignorar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
