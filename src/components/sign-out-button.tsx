"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

/** Ends the session and returns to the public page. Nothing else is touched. */
export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      className="app-signout"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await authClient.signOut();
          router.push("/");
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      type="button"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
