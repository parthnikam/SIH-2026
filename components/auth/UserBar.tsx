export function UserBar({
  email,
  name,
}: {
  email?: string | null;
  name?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 text-sm text-zinc-700">
      <span>{name || email || "Signed in"}</span>
      <form action="/auth/signout" method="post">
        <button type="submit" className="underline">
          Sign out
        </button>
      </form>
    </div>
  );
}
