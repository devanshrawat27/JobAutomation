import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import OnboardingForm from "./onboarding-form";
import Link from "next/link";

type CandidatePath = "new-grad" | "experienced";

function isCandidatePath(value: string | string[] | undefined): value is CandidatePath {
  return value === "new-grad" || value === "experienced";
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string | string[] }>;
}) {
  const { path } = await searchParams;
  const session = await getCurrentSession();

  const factCount = session?.user
    ? await prisma.profileFact.count({
        where: { userId: session.user.id, status: { in: ["CONFIRMED", "EDITED"] } },
      })
    : 0;

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="JobAutomation home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark"><span /></span>
          <span>jobautomation</span>
        </Link>
        <span className="onboarding-step">About 8 minutes · no wrong answers</span>
      </header>

      <OnboardingForm
        factCount={factCount}
        initialPath={isCandidatePath(path) ? path : ""}
      />

      <footer className="onboarding-footer">
        <Link href="/">← Back to home</Link>
        <span>Your facts stay yours. You review what gets used.</span>
      </footer>
    </main>
  );
}
