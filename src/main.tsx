import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { DeckThemeProvider } from './context/DeckThemeContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <DeckThemeProvider>
      <App />
    </DeckThemeProvider>
  </AuthProvider>
);
