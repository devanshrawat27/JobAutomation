import { redirect } from "next/navigation";

import { getCurrentSession, safeNextPath } from "@/lib/session";
import SignInForm from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const session = await getCurrentSession();

  if (session?.user) redirect(nextPath);

  return <SignInForm nextPath={nextPath} />;
}
