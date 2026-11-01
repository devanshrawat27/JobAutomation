export default function Loading() {
  return (
    <main className="onboarding-page">
      <div className="onboarding-content">
        <p className="section-kicker">Loading posting</p>
        <p className="onboarding-intro">Reading the posting and comparing it with your confirmed facts…</p>
        <div aria-hidden="true" className="match-skeleton" />
      </div>
    </main>
  );
}
