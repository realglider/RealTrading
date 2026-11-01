import "@/lib/logger";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/space-grotesk";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { TRPCProvider } from "@/providers/trpc"
import { Toaster } from "@/components/ui/sonner"
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TRPCProvider>
        <App />
        <Toaster theme="dark" position="bottom-right" richColors />
      </TRPCProvider>
    </BrowserRouter>
  </StrictMode>,
)
