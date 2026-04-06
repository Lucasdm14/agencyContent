import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgencyCopilot',
  description: 'Plataforma de contenido con IA para agencias',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ background: '#0d0d0d', color: '#ffffff' }}>{children}</body>
    </html>
  )
}
