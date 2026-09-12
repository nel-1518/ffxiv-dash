import './styles/global.css'
import './styles/axis-font-icons.css'
import { AppProviders } from './app/AppProviders.tsx'
import { AppShell } from './app/AppShell.tsx'

function App() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  )
}

export default App
