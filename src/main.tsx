import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { resolveExperience } from './experiences/activeExperience'
import './styles.css'

const experience = resolveExperience()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App experience={experience} />
  </StrictMode>,
)
