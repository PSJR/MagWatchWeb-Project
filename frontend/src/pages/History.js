import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Clock, Play, Trash2 } from 'lucide-react';

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = localStorage.getItem('magwatch_history');
      setHistory(data ? JSON.parse(data) : []);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (magnet) => {
    navigate(createPageUrl('Player') + '?magnet=' + encodeURIComponent(magnet));
  };

  const handleDelete = (index) => {
    const newHistory = history.filter((_, i) => i !== index);
    setHistory(newHistory);
    localStorage.setItem('magwatch_history', JSON.stringify(newHistory));
  };

  if (loading) {
    return (
      <Layout currentPageName="History">
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-slate-400">Carregando...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentPageName="History">
      <div className="min-h-screen px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Clock className="w-8 h-8 text-blue-400" />
              Histórico de Reprodução
            </h1>
            <p className="text-slate-400">Seus últimos vídeos assistidos</p>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-20">
              <Clock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Nenhum histórico ainda</h2>
              <p className="text-slate-400 mb-6">Comece a assistir conteúdos para vê-los aqui</p>
              <button
                onClick={() => navigate(createPageUrl('Home'))}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
              >
                Explorar Agora
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item, index) => (
                <div
                  key={index}
                  className="bg-[#13131f] border border-slate-800 rounded-xl p-5 flex items-center justify-between hover:border-blue-500/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium mb-1 truncate">{item.title}</h3>
                    <p className="text-xs text-slate-400">{item.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePlay(item.magnet)}
                      className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                      data-testid={`play-history-${index}`}
                    >
                      <Play className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(index)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                      data-testid={`delete-history-${index}`}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
