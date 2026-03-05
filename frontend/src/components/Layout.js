import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Film, User, Heart, LogOut, History, Home, Menu, X } from "lucide-react";
import TorrentNotificationPopup from "./TorrentNotificationPopup";
import AuthModal from "./AuthModal";
import { Toaster } from "@/components/ui/sonner";

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch {
      setUser(null);
    }
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  const handleAuthSuccess = () => {
    loadUser();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans">
      <style>{`
        :root {
          --bg-primary: #0a0a0f;
          --bg-secondary: #0f0f1a;
          --bg-card: #13131f;
          --bg-hover: #1a1a2e;
          --border: #1e1e35;
          --blue-accent: #3b82f6;
          --blue-glow: #2563eb;
          --blue-light: #60a5fa;
          --text-primary: #f1f5f9;
          --text-secondary: #94a3b8;
          --text-muted: #475569;
        }
        * { box-sizing: border-box; }
        body { background: var(--bg-primary); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg-secondary); }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--blue-accent); }
      `}</style>

      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#1e1e35] bg-[#0a0a0f]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link to={createPageUrl("Home")} className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-blue-500/50 transition-all duration-300 transform group-hover:scale-110">
                <Film className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight">
                <span className="text-white">Mag</span>
                <span className="text-blue-500">Watch</span>
                <span className="text-white">Web</span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              <Link
                to={createPageUrl("Home")}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                  currentPageName === "Home"
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                data-testid="nav-home-link"
              >
                <Home className="w-4 h-4" />
                Início
              </Link>

              {user && (
                <Link
                  to={createPageUrl("History")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                    currentPageName === "History"
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                  data-testid="nav-history-link"
                >
                  <History className="w-4 h-4" />
                  Histórico
                </Link>
              )}

              <Link
                to={createPageUrl("Donate")}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                  currentPageName === "Donate"
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                data-testid="nav-donate-link"
              >
                <Heart className="w-4 h-4" />
                Apoiar
              </Link>
            </div>

            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <div className="flex items-center gap-2">
                  <Link
                    to={createPageUrl("Profile")}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    data-testid="nav-profile-link"
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                      {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                    </div>
                    <span className="max-w-[120px] truncate">{user.full_name || user.email}</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    data-testid="logout-btn"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white transition-all duration-300 font-semibold shadow-lg shadow-blue-500/30 transform hover:scale-105 active:scale-95"
                  data-testid="login-btn"
                >
                  <User className="w-4 h-4" />
                  Entrar
                </button>
              )}
            </div>

            <button
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-toggle"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#1e1e35] bg-[#0a0a0f] px-4 py-3 space-y-1" data-testid="mobile-menu">
            <Link
              to={createPageUrl("Home")}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white hover:bg-white/10 transition-colors"
              data-testid="mobile-home-link"
            >
              <Home className="w-4 h-4" /> Início
            </Link>
            {user && (
              <Link
                to={createPageUrl("History")}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white hover:bg-white/10 transition-colors"
                data-testid="mobile-history-link"
              >
                <History className="w-4 h-4" /> Histórico
              </Link>
            )}
            <Link
              to={createPageUrl("Donate")}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white hover:bg-white/10 transition-colors"
              data-testid="mobile-donate-link"
            >
              <Heart className="w-4 h-4" /> Apoiar
            </Link>
            {user ? (
              <>
                <Link
                  to={createPageUrl("Profile")}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white hover:bg-white/10 transition-colors"
                  data-testid="mobile-profile-link"
                >
                  <User className="w-4 h-4" /> Perfil
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors w-full text-left"
                  data-testid="mobile-logout-btn"
                >
                  <LogOut className="w-4 h-4" /> Sair
                </button>
              </>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors w-full font-medium"
                data-testid="mobile-login-btn"
              >
                <User className="w-4 h-4" /> Entrar / Cadastrar
              </button>
            )}
          </div>
        )}
      </nav>

      <main className="pt-16">
        {children}
      </main>

      <footer className="border-t border-[#1e1e35] py-5 text-center">
        <p className="text-slate-500 text-sm font-medium">
          <span className="text-white">Mag</span>
          <span className="text-blue-500">Watch</span>
          <span className="text-white">Web</span>
        </p>
        <p className="text-slate-600 text-xs mt-1">
          Desenvolvido com ❤️ por Jailson PS Junior
        </p>
      </footer>

      <TorrentNotificationPopup />
      <AuthModal 
        isOpen={authModalOpen} 
        onClose={() => setAuthModalOpen(false)} 
        onSuccess={handleAuthSuccess}
      />
      <Toaster position="top-right" theme="dark" />
    </div>
  );
}
