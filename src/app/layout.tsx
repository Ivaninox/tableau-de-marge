import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'

export const metadata: Metadata = {
  title: 'Flying For You — Marges',
  description: 'Suivi des marges opérations terrain',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  //Commentaire test//
  return (
    <html lang="fr">
      <body className="min-h-screen bg-slate-950">
        <Navigation />
        <main className="ml-64 min-h-screen p-6">
          {children}
        </main>
      </body>
    </html>
  )
}
