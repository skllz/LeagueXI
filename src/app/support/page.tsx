import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Support — LeagueXI",
  description:
    "Get help with LeagueXI — contact support, account help, and answers to common questions.",
}

export default function SupportPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8 text-sm leading-relaxed">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Support</h1>
        <p className="text-muted-foreground">
          Need help with LeagueXI? We&apos;re happy to help — reach out and we&apos;ll get back to
          you as soon as we can.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Contact us</h2>
        <p className="text-muted-foreground">
          Email{" "}
          <a href="mailto:support@leaguexi.io" className="text-[var(--green)] hover:underline">
            support@leaguexi.io
          </a>
          . To help us respond quickly, please include the email address on your account and a short
          description of the issue (and a screenshot if relevant).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Common questions</h2>

        <div className="space-y-1">
          <p className="font-medium text-foreground">How does scoring work?</p>
          <p className="text-muted-foreground">
            You earn <span className="font-medium text-foreground">5 points</span> for the exact
            score, <span className="font-medium text-foreground">3 points</span> for the correct
            result, and <span className="font-medium text-foreground">0</span> otherwise. Points are
            awarded automatically once a match is finished.
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-medium text-foreground">When can I make or change a prediction?</p>
          <p className="text-muted-foreground">
            Any time before a match kicks off. Predictions lock at kickoff and can&apos;t be changed
            after that.
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-medium text-foreground">How do leagues work?</p>
          <p className="text-muted-foreground">
            Create a private or public league and share its invite code or link. Your predictions
            count once across every league you&apos;re in, plus the global leaderboard.
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-medium text-foreground">How do I delete my account?</p>
          <p className="text-muted-foreground">
            In the app, go to <span className="font-medium text-foreground">Profile → Delete
            account</span>. Deletion is permanent and removes your profile, predictions, and league
            memberships. Leagues you own are transferred to another member, or removed if you&apos;re
            the only member.
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-medium text-foreground">I can&apos;t sign in</p>
          <p className="text-muted-foreground">
            If you signed up with email and password, use{" "}
            <span className="font-medium text-foreground">Forgot password</span> on the sign-in
            screen to reset it. If you still can&apos;t get in, email us at the address above.
          </p>
        </div>
      </section>

      <section className="space-y-2 pt-2 border-t border-border">
        <p className="text-muted-foreground">
          <Link href="/matches" className="text-[var(--green)] hover:underline">Go to Matches</Link>
          {" · "}
          <Link href="/privacy" className="text-[var(--green)] hover:underline">Privacy Policy</Link>
        </p>
      </section>
    </div>
  )
}
