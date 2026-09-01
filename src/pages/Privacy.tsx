import ThemeLogo from '@/components/ThemeLogo';

const sections = [
  {
    heading: 'What we collect',
    body: [
      'Account data you give us: names, work email addresses, phone numbers, company details, role and billing information.',
      'Workspace data you put into Foxportal: leads, deals, contacts, employee records, payroll inputs, timesheets, and the emails you send through the platform.',
      'Chat data from Fox Chat: text messages, images, documents and voice messages you send or receive, plus your online/last-seen presence.',
      'Device data: with your consent, camera, photo library and microphone access — only used when you actively choose to send that type of content — and a push-notification token used to deliver chat alerts.',
      'Technical data we observe: IP address, device and browser type, pages visited, and timestamps of actions taken inside the portal or app.',
    ],
  },
  {
    heading: 'How we use it',
    body: [
      'To run the modules you enabled — pre-sales, sales, HR, payroll and tracking — and to keep the records in them accurate and available.',
      'To operate Fox Chat: delivering messages between users and sending push notifications for new messages.',
      'To generate AI assistance such as drafted emails, summaries and risk signals. Your workspace data is used to serve your workspace and is never used to train shared models.',
      'To secure the service, investigate abuse, meet legal and tax obligations, and support you when you ask us to.',
    ],
  },
  {
    heading: 'Third-party integrations',
    body: [
      'When you connect a service — email, messaging, payments or another CRM — Foxportal exchanges only the data required for that integration to work, and only while the connection is active.',
      'Push notifications for Fox Chat are delivered via Google Firebase Cloud Messaging.',
      'Disconnecting an integration stops future data exchange immediately. Data already synced into Foxportal remains in your workspace until you delete it.',
    ],
  },
  {
    heading: 'Data sharing',
    body: [
      'We do not sell your personal information or share it with third parties for advertising.',
      'Chat messages, your name and profile photo are visible to the other users you communicate with in Fox Chat.',
    ],
  },
  {
    heading: 'Where it lives and how long',
    body: [
      'Workspace and chat data is stored encrypted at rest and in transit.',
      'We retain your data for as long as your account is active. After cancellation, data is deleted within 90 days unless a longer period is required by law.',
    ],
  },
  {
    heading: 'Your rights',
    body: [
      'You can access, correct, export or delete your personal data at any time from within the portal or app, or by writing to us.',
      'Where your company is the data controller — for example for employee payroll records — we act as processor and will pass your request to them.',
    ],
  },
  {
    heading: "Children's privacy",
    body: [
      'Foxportal and Fox Chat are intended for use by employees and clients of organizations on the platform and are not directed at children under 13.',
    ],
  },
  {
    heading: 'Contact',
    body: [
      'Questions about this policy, or a data request, can be sent to support@foxportal.in. We reply within 30 days.',
    ],
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center px-6 py-5">
          <a href="/">
            <ThemeLogo className="h-8" />
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          Last updated · 1 September 2026
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Privacy policy</h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          Foxportal holds some of the most sensitive records a company keeps — its pipeline, its
          people and its payroll — and Fox Chat carries the conversations that happen around them.
          This page explains plainly what we collect, why, and what you can ask us to do with it.
        </p>

        <div className="mt-14 space-y-12">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-semibold tracking-tight">{section.heading}</h2>
              <div className="mt-4 space-y-4">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="leading-relaxed text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-border bg-secondary p-6">
          <p className="text-sm leading-relaxed text-muted-foreground">
            This policy may change as Foxportal grows. When it does materially, we notify account
            owners by email before the new version takes effect.
          </p>
        </div>
      </main>
    </div>
  );
}
