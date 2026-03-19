import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import FundamentalsPage from './pages/FundamentalsPage';
import AlternativesPage from './pages/AlternativesPage';
import SupplyChainPage from './pages/SupplyChainPage';
import FinancialAnalysisPage from './pages/FinancialAnalysisPage';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
          <Navbar />

          <main className="max-w-screen-xl mx-auto px-4 md:px-6 py-8">
            <Routes>
              <Route path="/" element={<Navigate to="/fundamentals" replace />} />
              <Route path="/fundamentals" element={<FundamentalsPage />} />
              <Route path="/alternatives" element={<AlternativesPage />} />
              <Route path="/supply-chain" element={<SupplyChainPage />} />
              <Route path="/financial-analysis" element={<FinancialAnalysisPage />} />
            </Routes>
          </main>

          <footer className="border-t border-[var(--border)] mt-16 py-6">
            <div className="max-w-screen-xl mx-auto px-6 flex items-center justify-between">
              <span className="text-xs text-[var(--muted)]">
                SemiResearch · Powered by OpenBB Platform
              </span>
              <span className="text-xs text-[var(--muted)]">
                Not financial advice
              </span>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
