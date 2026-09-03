import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppShell from '@/sparkfun/components/AppShell';
import { CelebrationProvider } from '@/sparkfun/components/Celebration';
import { WalletProvider } from '@/sparkfun/hooks/useWallet';
import Home from '@/sparkfun/pages/Home';
import Explore from '@/sparkfun/pages/Explore';
import Create from '@/sparkfun/pages/Create';
import TokenPage from '@/sparkfun/pages/TokenPage';
import Profile from '@/sparkfun/pages/Profile';
import Creator from '@/sparkfun/pages/Creator';
import NotFound from '@/sparkfun/pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <CelebrationProvider>
          <AppShell>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/create" element={<Create />} />
              <Route path="/t/:address" element={<TokenPage />} />
              <Route path="/me" element={<Profile own />} />
              <Route path="/u/:handle" element={<Profile />} />
              <Route path="/creator" element={<Creator own />} />
              <Route path="/c/:handle" element={<Creator />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppShell>
        </CelebrationProvider>
      </WalletProvider>
    </BrowserRouter>
  );
}
