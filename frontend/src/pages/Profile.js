import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { base44 } from '@/api/base44Client';
import { User, Mail, Calendar } from 'lucide-react';

export default function Profile() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (!user) {
    return (
      <Layout currentPageName="Profile">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center">
            <User className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Faça login para ver seu perfil</h2>
            <button
              onClick={() => base44.auth.redirectToLogin()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              Entrar / Cadastrar
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentPageName="Profile">
      <div className="min-h-screen px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="bg-[#13131f] border border-slate-800 rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 h-32"></div>
            <div className="px-8 pb-8">
              <div className="-mt-16 mb-6">
                <div className="w-32 h-32 rounded-full bg-blue-600 border-4 border-[#13131f] flex items-center justify-center text-4xl font-bold text-white">
                  {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                </div>
              </div>

              <h1 className="text-3xl font-bold text-white mb-6">{user.full_name || 'Usuário'}</h1>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-slate-300">
                  <Mail className="w-5 h-5 text-blue-400" />
                  <span>{user.email}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <span>Membro desde {new Date(user.id).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-800">
                <button
                  onClick={() => base44.auth.logout()}
                  className="w-full px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium rounded-lg transition-colors"
                  data-testid="profile-logout-btn"
                >
                  Sair da Conta
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
