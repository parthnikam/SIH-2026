import { GoogleSignIn } from "./GoogleSignIn";

export function SignInPhone() {
  return (
    <div className="flex w-full max-w-[360px] flex-col items-center gap-6">
      <div className="flex min-h-[640px] w-full flex-col rounded-[40px] border-[10px] border-zinc-900 bg-zinc-950 text-zinc-50">
        <div className="flex items-center justify-center pt-4">
          <div className="h-5 w-24 rounded-full bg-zinc-900" />
        </div>
        <div className="flex flex-1 flex-col px-6 pb-8 pt-8">
          <p className="text-center text-xs tracking-[0.2em] text-zinc-400 uppercase">
            PM-AJAY
          </p>
          <h1 className="mt-2 text-center text-xl font-medium">
            Livelihood Helpline
          </h1>
          <GoogleSignIn />
        </div>
      </div>
    </div>
  );
}
