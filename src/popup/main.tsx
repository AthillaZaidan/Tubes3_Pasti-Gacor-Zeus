import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Popup } from './Popup'
import './popup.css'

createRoot(document.getElementById('popup-root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
)
