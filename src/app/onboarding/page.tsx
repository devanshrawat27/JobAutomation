import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import OnboardingForm from "./onboarding-form";

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
    <OnboardingForm
      factCount={factCount}
      initialPath={isCandidatePath(path) ? path : ""}
    />
  );
}
