import { LoginForm } from "@/components/auth/login-form"
import { Trophy } from "lucide-react"

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Trophy className="w-10 h-10 text-[var(--green)]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Sign in to LeagueXI</h1>
          <p className="text-muted-foreground text-sm">
            Predict scores. Compete with friends. Climb the table.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
