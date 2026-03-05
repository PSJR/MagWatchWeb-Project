import Layout from '@/components/Layout';
import { Heart, Coffee, Code } from 'lucide-react';

export default function Donate() {
  return (
    <Layout currentPageName="Donate">
      <div className="min-h-screen px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <Heart className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-white mb-4">Apoie o Projeto</h1>
            <p className="text-lg text-slate-400">
              MagWatchWeb é um projeto open-source e gratuito. Seu apoio ajuda a manter o servidor e desenvolver novos recursos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <div className="bg-[#13131f] border border-slate-800 rounded-xl p-8 text-center">
              <Coffee className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Me pague um café</h3>
              <p className="text-slate-400 mb-6">
                Uma pequena contribuição para manter o projeto ativo
              </p>
              <button
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
                data-testid="donate-coffee-btn"
              >
                Doar via PIX
              </button>
            </div>

            <div className="bg-[#13131f] border border-slate-800 rounded-xl p-8 text-center">
              <Code className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Contribua no GitHub</h3>
              <p className="text-slate-400 mb-6">
                Ajude a melhorar o código e adicionar novos recursos
              </p>
              <button
                className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                data-testid="github-btn"
              >
                Ver no GitHub
              </button>
            </div>
          </div>

          <div className="bg-[#13131f] border border-slate-800 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Por que apoiar?</h2>
            <ul className="space-y-3 text-slate-300">
              <li className="flex items-start gap-3">
                <Heart className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <span>Manter os servidores e infraestrutura rodando</span>
              </li>
              <li className="flex items-start gap-3">
                <Heart className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <span>Desenvolver novos recursos e melhorias</span>
              </li>
              <li className="flex items-start gap-3">
                <Heart className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <span>Manter o projeto 100% gratuito e sem anúncios</span>
              </li>
              <li className="flex items-start gap-3">
                <Heart className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <span>Apoiar desenvolvimento open-source</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}
