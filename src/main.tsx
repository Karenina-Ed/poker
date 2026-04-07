import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PureRanking } from '@/components/PureRanking'
import { Toaster } from 'sonner'

const searchParams = new URLSearchParams(window.location.search);
const isPureRanking = searchParams.get('view') === 'ranking';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPureRanking ? <PureRanking /> : <App />}
    <Toaster position="top-center" richColors />
  </StrictMode>,
)
