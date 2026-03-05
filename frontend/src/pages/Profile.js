import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { base44 } from '@/api/base44Client';
import { User, Mail, Calendar, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  if (loading) {
    return (
      <Layout currentPageName="Profile">
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-slate-400">Carregando...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout currentPageName="Profile">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-6">
              <User className="w-10 h-10 text-slate-600" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-3">Faça login para ver seu perfil</h2>
            <p className="text-slate-400 mb-6">Crie uma conta ou entre para acessar seu perfil e histórico</p>
            <button
              onClick={() => navigate(createPageUrl('Home'))}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-full transition-all transform hover:scale-105 shadow-lg shadow-blue-500/30"
            >
              Voltar ao Início
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
          <div className="bg-[#13131f] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 h-32 relative">
              <div className="absolute inset-0 bg-black/20"></div>
            </div>
            <div className="px-8 pb-8">
              <div className="-mt-16 mb-6 relative">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 border-4 border-[#13131f] flex items-center justify-center text-4xl font-bold text-white shadow-lg shadow-blue-500/30">
                  {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                </div>
              </div>

              <h1 className="text-3xl font-bold text-white mb-2">{user.full_name || 'Usuário'}</h1>
              <p className="text-slate-400 mb-8">Membro do MagWatchWeb</p>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-4 p-4 bg-[#0a0a0f] rounded-xl border border-slate-800">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Mail className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Email</p>
                    <p className="text-white font-medium">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-[#0a0a0f] rounded-xl border border-slate-800">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Membro desde</p>
                    <p className="text-white font-medium">
                      {new Date(user.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-[#0a0a0f] rounded-xl border border-slate-800">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <User className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">ID do Usuário</p>
                    <p className="text-white font-medium font-mono text-sm">{user.id}</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800">
                <button
                  onClick={handleLogout}
                  className="w-full px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold rounded-full transition-all flex items-center justify-center gap-2 group"
                  data-testid="profile-logout-btn"
                >
                  <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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
