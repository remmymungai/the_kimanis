"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // The login page itself is at /admin — don't guard it
    if (pathname === "/admin") {
      setChecked(true);
      return;
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/admin");
      } else {
        setChecked(true);
      }
    });
  }, [pathname, router]);

  if (!checked && pathname !== "/admin") {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-dark">
        <div className="w-8 h-8 rounded-full border-4 border-gold border-t-transparent animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
