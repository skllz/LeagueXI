import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Navbar } from "@/components/layout/navbar"
import { AuthProvider } from "@/components/auth/auth-provider"
import { createClient } from "@/lib/supabase/server"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "LeagueXI — Football Prediction Game",
  description:
    "Predict exact scores, compete with friends, and climb the table. LeagueXI is the football prediction game for the World Cup and beyond.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let navUser: { username: string; avatarUrl: string | null; isAdmin: boolean } | null = null
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, avatar_url, is_admin")
      .eq("id", user.id)
      .maybeSingle()
    if (profile?.username) {
      navUser = {
        username: profile.username,
        avatarUrl: profile.avatar_url,
        isAdmin: profile.is_admin,
      }
    }
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Navbar user={navUser} />
        <AuthProvider>
          <main className="flex-1">{children}</main>
        </AuthProvider>
      </body>
    </html>
  )
}
