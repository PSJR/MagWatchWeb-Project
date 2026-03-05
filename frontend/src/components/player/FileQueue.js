import { Play, FileVideo } from 'lucide-react';
import { formatBytes } from '@/utils';

export default function FileQueue({ files, currentFileIndex, onSelectFile }) {
  return (
    <div className="bg-[#13131f] border border-slate-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-800">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <FileVideo className="w-5 h-5 text-blue-400" />
          Arquivos ({files.length})
        </h3>
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        {files.map((file, index) => (
          <button
            key={index}
            onClick={() => onSelectFile(index)}
            className={`w-full p-4 text-left border-b border-slate-800 transition-colors ${
              index === currentFileIndex
                ? 'bg-blue-600/20 border-l-4 border-l-blue-500'
                : 'hover:bg-white/5'
            }`}
            data-testid={`file-item-${index}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                {index === currentFileIndex ? (
                  <Play className="w-5 h-5 text-blue-400" fill="currentColor" />
                ) : (
                  <FileVideo className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium truncate ${
                    index === currentFileIndex ? 'text-blue-300' : 'text-white'
                  }`}
                >
                  {file.name}
                </p>
                <p className="text-xs text-slate-400 mt-1">{formatBytes(file.length)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
