import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { inizializzaDatabase } from './services/db';

// Apre il database e crea le tabelle all'avvio; in browser (senza Tauri) viene solo segnalato
inizializzaDatabase().catch((err) => console.warn('[DB] Database non inizializzato:', err));

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
