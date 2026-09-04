import Link from "next/link";

export function UserBar({
  email,
  name,
}: {
  email?: string | null;
  name?: string | null;
}) {
  const label = name || email || "Signed in";
  return (
    <div className="flex items-center gap-3 text-sm text-zinc-700">
      <Link href="/records" className="underline">
        {label}
      </Link>
      <form action="/auth/signout" method="post">
        <button type="submit" className="underline">
          Sign out
        </button>
      </form>
    </div>
  );
}
