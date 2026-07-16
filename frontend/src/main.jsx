import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './pages/SharedPages.css'
import './styles/spotlight.css'
import './styles/spotlight-init.js'
import App from './App.jsx'
import { ThemeProvider } from './components/theme/ThemeProvider.jsx'
import { AuthProvider } from './components/auth/AuthProvider.jsx'
import { LanguageProvider } from './i18n/LanguageProvider.jsx'
import { installSourceDeterrence } from './security/sourceDeterrence.js'

// Source deterrence desactive temporairement pour debug
// if (import.meta.env.PROD) {
//   installSourceDeterrence()
// }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
)
