import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import VideoPlayer from '@/components/player/VideoPlayer';
import FileQueue from '@/components/player/FileQueue';
import FileSelectionModal from '@/components/FileSelectionModal';
import { createPageUrl } from '@/utils';
import { Loader2, AlertCircle } from 'lucide-react';
import WebTorrent from 'webtorrent';

export default function Player() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const magnet = searchParams.get('magnet');
  const torrentUrl = searchParams.get('torrent');
  
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [torrentFiles, setTorrentFiles] = useState([]);
  const [allFiles, setAllFiles] = useState([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [torrentInfo, setTorrentInfo] = useState(null);
  const [showFileModal, setShowFileModal] = useState(false);
  
  const clientRef = useRef(null);
  const torrentRef = useRef(null);
  const serverRef = useRef(null);

  useEffect(() => {
    if (!magnet && !torrentUrl) {
      navigate(createPageUrl('Home'));
      return;
    }

    setStatus('loading');
    
    if (!clientRef.current) {
      clientRef.current = new WebTorrent({
        tracker: {
          rtcConfig: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        }
      });
    }

    const client = clientRef.current;
    const torrentId = magnet || torrentUrl;

    client.add(torrentId, { 
      maxWebConns: 50,
      announce: [
        'wss://tracker.openwebtorrent.com',
        'wss://tracker.btorrent.xyz',
        'wss://tracker.fastcast.nz'
      ]
    }, (torrent) => {
      torrentRef.current = torrent;

      setTorrentInfo({
        name: torrent.name,
        infoHash: torrent.infoHash,
        size: torrent.length
      });

      const videoFiles = torrent.files.filter(file => {
        const ext = file.name.toLowerCase().split('.').pop();
        return ['mp4', 'mkv', 'webm', 'avi', 'mov'].includes(ext);
      });

      setAllFiles(torrent.files.map(f => ({
        name: f.name,
        length: f.length,
        file: f
      })));

      if (videoFiles.length === 0) {
        setShowFileModal(true);
        setStatus('waiting');
        return;
      }

      setTorrentFiles(videoFiles.map(f => ({
        name: f.name,
        length: f.length,
        file: f
      })));

      loadFile(videoFiles[0], torrent);
    });

    client.on('error', (err) => {
      console.error('WebTorrent error:', err);
      setStatus('error');
      setErrorMsg(`Erro ao carregar torrent: ${err.message}`);
    });

    return () => {
      if (serverRef.current) {
        serverRef.current.close();
        serverRef.current = null;
      }
      if (torrentRef.current) {
        torrentRef.current.destroy();
        torrentRef.current = null;
      }
    };
  }, [magnet, torrentUrl, navigate]);

  const loadFile = (file, torrent) => {
    setStatus('loading');

    if (serverRef.current) {
      serverRef.current.close();
    }

    file.select();

    const server = file.createServer();
    serverRef.current = server;

    server.listen(0, () => {
      const port = server.address().port;
      const url = `http://localhost:${port}/${encodeURIComponent(file.name)}`;
      
      setVideoUrl(url);
      setStatus('ready');

      torrent.on('download', () => {
        if (torrent.progress > 0) {
          setStatus('ready');
        }
      });
    });
  };

  const handleSelectFile = (index) => {
    if (index === currentFileIndex) return;
    
    setCurrentFileIndex(index);
    const file = torrentFiles[index].file;
    
    if (file && torrentRef.current) {
      loadFile(file, torrentRef.current);
    }
  };

  const handleManualFileSelect = (index) => {
    const selectedFile = allFiles[index];
    setTorrentFiles([selectedFile]);
    setCurrentFileIndex(0);
    setShowFileModal(false);
    
    if (selectedFile.file && torrentRef.current) {
      loadFile(selectedFile.file, torrentRef.current);
    }
  };

  if (status === 'loading') {
    return (
      <Layout currentPageName="Player">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Carregando torrent...</h2>
            <p className="text-slate-400">Conectando aos peers e iniciando streaming</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (status === 'waiting') {
    return (
      <Layout currentPageName="Player">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Nenhum vídeo detectado</h2>
            <p className="text-slate-400">Selecione o arquivo que deseja reproduzir</p>
          </div>
        </div>
        <FileSelectionModal
          files={allFiles}
          onSelect={handleManualFileSelect}
          onClose={() => navigate(createPageUrl('Home'))}
        />
      </Layout>
    );
  }

  if (status === 'error') {
    return (
      <Layout currentPageName="Player">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-[#13131f] border border-red-500/30 rounded-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Erro ao Carregar</h2>
            <p className="text-slate-400 mb-6">{errorMsg}</p>
            <button
              onClick={() => navigate(createPageUrl('Home'))}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
              data-testid="back-home-btn"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentPageName="Player">
      <div className="min-h-screen bg-[#0a0a0f] pb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {torrentInfo && (
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-white mb-1">{torrentInfo.name}</h1>
              <p className="text-sm text-slate-400">Info Hash: {torrentInfo.infoHash}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <VideoPlayer
                videoUrl={videoUrl}
                torrent={torrentRef.current}
                fileName={torrentFiles[currentFileIndex]?.name}
              />
            </div>

            <div className="lg:col-span-1">
              <FileQueue
                files={torrentFiles}
                currentFileIndex={currentFileIndex}
                onSelectFile={handleSelectFile}
              />
            </div>
          </div>
        </div>
      </div>

      {showFileModal && (
        <FileSelectionModal
          files={allFiles}
          onSelect={handleManualFileSelect}
          onClose={() => navigate(createPageUrl('Home'))}
        />
      )}
    </Layout>
  );
}
