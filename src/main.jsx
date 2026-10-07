import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { LangueProvider } from './lib/i18n'
import { ToastProvider } from './components/UI'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LangueProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </LangueProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

// PWA installable sur iPhone et Android (§6 Mobile)
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
