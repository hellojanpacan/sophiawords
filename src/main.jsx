import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SophiaWords from './SophiaWords.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SophiaWords />
  </StrictMode>,
)
