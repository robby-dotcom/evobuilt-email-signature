import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || '/'
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .catch(() => { /* offline is a bonus, not a gate */ })
  })
}
