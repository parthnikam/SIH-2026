import Link from "next/link";
import { Phone } from "@/components/phone/Phone";
import { SignInPhone } from "@/components/auth/SignInPhone";
import { UserBar } from "@/components/auth/UserBar";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { getAuthUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const authRequired = hasSupabaseEnv();
  const user = authRequired ? await getAuthUser() : null;
  const signedIn = !authRequired || Boolean(user);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
      {signedIn ? (
        <UserBar
          email={user?.email}
          name={
            (user?.user_metadata?.full_name as string | undefined) ??
            (user?.user_metadata?.name as string | undefined)
          }
        />
      ) : null}
      {signedIn ? <Phone /> : <SignInPhone />}
      {signedIn ? (
        <Link href="/officer" className="text-sm text-zinc-600 underline">
          Officer desk
        </Link>
      ) : null}
    </div>
  );
}
