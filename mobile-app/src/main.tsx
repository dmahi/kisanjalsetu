import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';

const container = document.getElementById('root')!;

declare global {
  interface Window {
    __mobileReactRoot?: ReactDOM.Root;
  }
}

const root = window.__mobileReactRoot ?? ReactDOM.createRoot(container);
window.__mobileReactRoot = root;

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);