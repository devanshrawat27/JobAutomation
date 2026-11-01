"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteProfileFacts } from "@/app/actions/profile";
import { authClient } from "@/lib/auth-client";

export default function ProfileActions({ hasFacts }: { hasFacts: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  async function removeProfile() {
    if (!window.confirm("Delete every saved profile fact for this account? This cannot be undone.")) return;
    setPending(true);
    await deleteProfileFacts();
    router.refresh();
    setPending(false);
  }

  return (
    <div className="profile-actions">
      <button className="intake-secondary" disabled={pending} onClick={signOut} type="button">
        Sign out
      </button>
      {hasFacts ? (
        <button className="profile-danger" disabled={pending} onClick={removeProfile} type="button">
          Delete my saved profile
        </button>
      ) : null}
    </div>
  );
}
