import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy — LeagueXI",
  description:
    "How LeagueXI collects, uses, and protects your data across the app and website.",
}

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6 text-sm leading-relaxed">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <div className="text-muted-foreground space-y-0.5">
          <p><span className="font-medium text-foreground">Effective date:</span> 20 June 2026</p>
          <p><span className="font-medium text-foreground">App:</span> LeagueXI (iOS &amp; Android) and the LeagueXI website.</p>
          <p><span className="font-medium text-foreground">Operator:</span> Lani Q (independent developer)</p>
          <p><span className="font-medium text-foreground">Contact:</span> support@leaguexi.io</p>
        </div>
      </div>

      <p className="text-muted-foreground">
        LeagueXI is a football score-prediction game. This policy explains what we
        collect, why, and your choices. It applies to the mobile app and the
        website, which share one backend.
      </p>

      <Section title="1. Information we collect">
        <p className="font-medium text-foreground">You provide:</p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Account details</span> — your email
            address, and a password (stored hashed by our auth provider). If you sign in with
            Google, we receive your email, basic profile name, and profile picture from Google.
          </li>
          <li>
            <span className="font-medium text-foreground">Username</span> — the public display
            name you choose.
          </li>
          <li>
            <span className="font-medium text-foreground">Gameplay data</span> — your score
            predictions, the points they earn, and the leagues you create or join.
          </li>
        </ul>
        <p className="font-medium text-foreground mt-3">Collected automatically:</p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Basic technical data</span> needed to
            run the service (e.g. IP address, device/log information) processed by our hosting and
            infrastructure providers for security, reliability, and abuse prevention.
          </li>
          <li>
            <span className="font-medium text-foreground">Push token</span> — if you enable push
            notifications, we store a device push token used solely to deliver match reminders and
            results. You can turn notifications off at any time in your device settings.
          </li>
        </ul>
        <p className="text-muted-foreground mt-3">
          <span className="font-medium text-foreground">We do NOT</span> show third-party ads,
          sell your personal data, run third-party advertising/analytics trackers, or process
          payments in the app.
        </p>
      </Section>

      <Section title="2. How we use it">
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Create and secure your account; sign you in.</li>
          <li>
            Run the game: record predictions, score completed matches, build global and league
            leaderboards, and manage league membership.
          </li>
          <li>
            Maintain, protect, and improve the service (security, debugging, abuse prevention).
          </li>
        </ul>
        <p className="text-muted-foreground mt-3">
          We rely on your <span className="font-medium text-foreground">consent</span> (account
          creation) and our <span className="font-medium text-foreground">legitimate interest</span>{" "}
          in operating and securing the game.
        </p>
      </Section>

      <Section title="3. What other players can see">
        <p className="text-muted-foreground">
          Your <span className="font-medium text-foreground">username, avatar, points, and
          rankings</span> are visible to other players on the global leaderboard and within leagues
          you join. Inside a league, members&apos; predictions become visible{" "}
          <span className="font-medium text-foreground">after each match kicks off</span> (your own
          predictions stay private until then). Your{" "}
          <span className="font-medium text-foreground">email is never shown</span> to other
          players.
        </p>
      </Section>

      <Section title="4. Service providers we share data with">
        <p className="text-muted-foreground">
          We use trusted providers strictly to operate the service:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Supabase</span> — database and
            authentication (stores your account and gameplay data).
          </li>
          <li>
            <span className="font-medium text-foreground">Google</span> — only if you choose Google
            sign-in (authentication).
          </li>
          <li>
            <span className="font-medium text-foreground">Cloudflare / Vercel</span> — hosting,
            content delivery, and the network proxy that keeps the service reachable.
          </li>
          <li>
            <span className="font-medium text-foreground">Expo / EAS</span> — app builds (and
            push-notification delivery once that feature ships).
          </li>
          <li>
            <span className="font-medium text-foreground">Apple App Store / Google Play</span> — app
            distribution.
          </li>
        </ul>
        <p className="text-muted-foreground mt-3">
          These providers process data on our behalf under their own terms; we don&apos;t sell your
          data to anyone.
        </p>
      </Section>

      <Section title="5. Data retention & deletion">
        <p className="text-muted-foreground">
          We keep your data while your account is active. You can{" "}
          <span className="font-medium text-foreground">delete your account at any time</span> from
          the app: <span className="font-medium text-foreground">Profile → Delete account</span>.
          Deletion is permanent and removes your profile, predictions, and league memberships.
          Leagues you own are transferred to another member, or removed if you are the only member.
          Backups and legally required records may persist for a limited period before being purged.
        </p>
      </Section>

      <Section title="6. Children">
        <p className="text-muted-foreground">
          LeagueXI is not directed to children under 13. We do not knowingly collect data from
          children under that age.
        </p>
      </Section>

      <Section title="7. International users">
        <p className="text-muted-foreground">
          Our user base is primarily in Nigeria; data may be processed on servers located in other
          countries by the providers listed above.
        </p>
      </Section>

      <Section title="8. Your rights">
        <p className="text-muted-foreground">
          Depending on your location, you may have rights to access, correct, or delete your
          personal data. The in-app <span className="font-medium text-foreground">Delete account</span>{" "}
          action covers deletion; for other requests, contact us at support@leaguexi.io.
        </p>
      </Section>

      <Section title="9. Changes to this policy">
        <p className="text-muted-foreground">
          We may update this policy; we will revise the &quot;Effective date&quot; above and, for
          material changes, provide notice in the app or by email.
        </p>
      </Section>

      <Section title="10. Contact">
        <p className="text-muted-foreground">support@leaguexi.io</p>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 pt-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  )
}
