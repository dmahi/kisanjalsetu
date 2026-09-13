import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/admin.css';

const container = document.getElementById('root')!;

declare global {
  interface Window {
    __adminReactRoot?: Root;
  }
}

const root = window.__adminReactRoot ?? createRoot(container);
window.__adminReactRoot = root;

root.render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);