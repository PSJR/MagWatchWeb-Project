import { FileVideo, X } from 'lucide-react';
import { formatBytes } from '@/utils';

export default function FileSelectionModal({ files, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#13131f] border border-slate-800 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Selecione o Arquivo</h2>
            <p className="text-sm text-slate-400 mt-1">
              Nenhum vídeo foi detectado automaticamente. Selecione qual arquivo deseja reproduzir:
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
            data-testid="file-modal-close"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] space-y-2">
          {files.map((file, index) => (
            <button
              key={index}
              onClick={() => onSelect(index)}
              className="w-full p-4 bg-[#0a0a0f] hover:bg-blue-600/10 border border-slate-800 hover:border-blue-500/50 rounded-xl transition-all text-left group"
              data-testid={`file-select-${index}`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                  <FileVideo className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{file.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatBytes(file.length)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
