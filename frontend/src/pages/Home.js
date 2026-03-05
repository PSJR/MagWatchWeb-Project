import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { createPageUrl } from '@/utils';
import { Upload, Link as LinkIcon, Play, Sparkles } from 'lucide-react';

export default function Home() {
  const [magnetLink, setMagnetLink] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (magnetLink.trim()) {
      navigate(createPageUrl('Player') + '?magnet=' + encodeURIComponent(magnetLink.trim()));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const torrentFile = files.find(f => f.name.endsWith('.torrent'));

    if (torrentFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const blob = new Blob([event.target.result], { type: 'application/x-bittorrent' });
        const url = URL.createObjectURL(blob);
        navigate(createPageUrl('Player') + '?torrent=' + encodeURIComponent(url));
      };
      reader.readAsArrayBuffer(torrentFile);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.torrent')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const blob = new Blob([event.target.result], { type: 'application/x-bittorrent' });
        const url = URL.createObjectURL(blob);
        navigate(createPageUrl('Player') + '?torrent=' + encodeURIComponent(url));
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <Layout currentPageName="Home">
      <div className="min-h-screen flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-300 font-medium">Streaming P2P Instant\u00e2neo</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <span className="text-white">Assista Torrents</span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                Direto no Navegador
              </span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Cole um link magnet ou arraste um arquivo .torrent para come\u00e7ar a assistir instantaneamente. Sem downloads, sem espera.
            </p>
          </div>

          <div
            className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden ${
              isDragging
                ? 'border-blue-500 bg-blue-500/10 scale-105'
                : 'border-slate-700 bg-[#13131f]/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-testid="drop-zone"
          >
            <div className="p-8 sm:p-12">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={magnetLink}
                    onChange={(e) => setMagnetLink(e.target.value)}
                    placeholder="Cole o link magnet aqui (magnet:?xt=...)"
                    className="w-full pl-12 pr-4 py-4 bg-[#0a0a0f] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    data-testid="magnet-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!magnetLink.trim()}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 group"
                  data-testid="submit-magnet-btn"
                >
                  <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  Assistir Agora
                </button>
              </form>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-[#13131f] text-slate-500">ou</span>
                </div>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl transition-all group"
                data-testid="upload-torrent-btn"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".torrent"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-slate-800 group-hover:bg-blue-500/20 flex items-center justify-center transition-all">
                    <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <div>
                    <p className="text-white font-medium mb-1">Arraste um arquivo .torrent</p>
                    <p className="text-slate-500 text-sm">ou clique para selecionar</p>
                  </div>
                </div>
              </button>
            </div>

            {isDragging && (
              <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <Upload className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-bounce" />
                  <p className="text-xl font-bold text-white">Solte o arquivo aqui</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center p-6 rounded-xl bg-[#13131f]/50 border border-slate-800">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                <Play className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Streaming Instant\u00e2neo</h3>
              <p className="text-slate-400 text-sm">Come\u00e7a a tocar em segundos, sem esperar o download completo</p>
            </div>

            <div className="text-center p-6 rounded-xl bg-[#13131f]/50 border border-slate-800">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                <LinkIcon className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">100% WebRTC</h3>
              <p className="text-slate-400 text-sm">Tecnologia P2P moderna direto no navegador</p>
            </div>

            <div className="text-center p-6 rounded-xl bg-[#13131f]/50 border border-slate-800">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Sem Instala\u00e7\u00e3o</h3>
              <p className="text-slate-400 text-sm">Funciona totalmente no navegador, nada para instalar</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
