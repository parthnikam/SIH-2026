import type { Metadata } from "next";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  getAdminDashboardData,
  type DashboardData,
} from "@/lib/admin/data";
import { logoutAction } from "@/app/admin/actions";
import { IndiaMap } from "@/app/admin/india-map";
import { LoginForm } from "@/app/admin/login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Portal | PM-AJAY",
  description: "PM-AJAY livelihood helpline administration dashboard.",
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

function formatDuration(seconds: number | null) {
  if (seconds === null) return "Live";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder.toString().padStart(2, "0")}s`;
}

function formatUpdate(isoDate: string | null) {
  if (!isoDate) return "No session data";
  return dateFormatter.format(new Date(isoDate));
}

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) {
    return <AdminLogin />;
  }

  let data: DashboardData | null = null;
  let databaseError = "";

  try {
    data = await getAdminDashboardData();
  } catch (error) {
    console.error("Unable to load Supabase admin data", error);
    databaseError =
      "The Supabase database did not respond in time. Check the connection and try again.";
  }

  return <AdminDashboard data={data} databaseError={databaseError} />;
}

function AdminLogin() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fff0ea] px-4 py-10">
      <div className="absolute inset-0 opacity-50" aria-hidden>
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full border-[80px] border-[#fbd8d4]" />
        <div className="absolute -bottom-36 -right-20 h-[28rem] w-[28rem] rounded-full border-[100px] border-[#f8dcda]" />
      </div>

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl border border-[#f1d2d3] bg-white md:grid-cols-[0.9fr_1.1fr]">
        <section className="relative hidden min-h-[590px] overflow-hidden bg-[#ffe3df] p-10 text-[#703142] md:flex md:flex-col">
          <div className="absolute -right-24 top-20 h-72 w-72 rounded-full border-[60px] border-white/50" />
          <div className="absolute -bottom-14 -left-16 h-56 w-56 rounded-full border-[48px] border-[#d94361]/10" />
          <BrandMark light />
          <div className="relative mt-auto">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#b46b78] uppercase">
              Administrative intelligence
            </p>
            <h1 className="mt-4 max-w-xs text-4xl font-medium leading-tight tracking-[-0.035em]">
              Livelihood support, visible across India.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-[#945565]">
              Monitor counselling reach, beneficiary regions, and helpline activity from one secure portal.
            </p>
          </div>
          <div className="relative mt-10 flex items-center gap-3 border-t border-[#efc2c7] pt-5 text-xs text-[#a45f6d]">
            <ShieldIcon className="h-4 w-4 text-[#df5c73]" />
            Protected administrative access
          </div>
        </section>

        <section className="flex min-h-[590px] flex-col justify-center px-7 py-10 sm:px-14">
          <div className="md:hidden">
            <BrandMark />
          </div>
          <div className="mt-10 md:mt-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#d94361] uppercase">
              Admin portal
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#6f2c3d]">
              Welcome back
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#9c5f6d]">
              Sign in to view live programme activity.
            </p>
          </div>
          <LoginForm />
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-[#b27884]">
            <ShieldIcon className="h-3.5 w-3.5" />
            Your session is secured and expires after 8 hours.
          </p>
        </section>
      </div>
    </main>
  );
}

function AdminDashboard({
  data,
  databaseError,
}: {
  data: DashboardData | null;
  databaseError: string;
}) {
  return (
    <main className="min-h-screen bg-[#fff7f2] text-[#6f2c3d]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-[#ffe8e6] px-5 py-7 text-[#703142] lg:flex">
        <div className="px-2">
          <BrandMark light />
        </div>
        <nav className="mt-12 space-y-1" aria-label="Admin navigation">
          <NavItem href="#overview" label="Overview" active icon={<GridIcon />} />
          <NavItem href="#regional-reach" label="Regional reach" icon={<MapPinIcon />} />
          <NavItem href="#sessions" label="Counselling calls" icon={<PhoneIcon />} />
          <NavItem href="#languages" label="Languages" icon={<LanguageIcon />} />
        </nav>
        <div className="mt-auto rounded-2xl border border-[#f2c9cd] bg-white/55 p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-[#b46b78] uppercase">
            <span className="h-2 w-2 rounded-full bg-[#df6a7f]" />
            System online
          </div>
          <p className="mt-3 text-xs leading-5 text-[#b27884]">
            Supabase data connection is configured for this workspace.
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex min-h-20 items-center justify-between border-b border-[#f1d1d1] bg-[#fff7f2]/90 px-5 backdrop-blur md:px-8 lg:px-10">
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <div className="hidden lg:block">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[#b27884] uppercase">
              PM-AJAY / Administration
            </p>
            <p className="mt-1 text-sm font-medium text-[#8b5260]">
              Livelihood Helpline Command Centre
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/admin"
              className="hidden h-9 items-center gap-2 rounded-lg border border-[#f2cfd1] bg-white px-3 text-xs font-medium text-[#86505e] transition-colors hover:border-[#e9bdc2] sm:flex"
            >
              <RefreshIcon /> Refresh
            </a>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f8d8da] text-xs font-bold text-[#8d3d50]">
              AD
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="h-9 rounded-lg px-2 text-xs font-semibold text-[#9c5f6d] transition-colors hover:text-[#d94361]"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-5 py-7 md:px-8 lg:px-10 lg:py-9">
          <section id="overview" className="scroll-mt-28">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.16em] text-[#d94361] uppercase">
                  Programme overview
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#6f2c3d] md:text-[2.15rem]">
                  Good day, Administrator
                </h1>
                <p className="mt-2 text-sm text-[#9c5f6d]">
                  A live view of livelihood counselling activity across the country.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#9c5f6d]">
                <span className={`h-2 w-2 rounded-full ${data ? "bg-[#df6a7f]" : "bg-[#e07b7b]"}`} />
                {data ? `Synced ${formatUpdate(data.lastUpdatedAt)}` : "Connection needs attention"}
              </div>
            </div>

            {databaseError ? (
              <div className="mt-7 flex flex-col justify-between gap-4 rounded-2xl border border-[#f4c8c5] bg-[#fff0e8] p-5 text-[#773140] sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-semibold">Supabase is temporarily unavailable</p>
                  <p className="mt-1 text-sm text-[#a64e5d]">{databaseError}</p>
                </div>
                <a href="/admin" className="text-sm font-semibold underline underline-offset-4">
                  Try again
                </a>
              </div>
            ) : null}

            <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Counselling calls"
                value={data?.totalSessions ?? "—"}
                detail={`${data?.completedSessions ?? 0} completed`}
                icon={<PhoneIcon />}
                tone="orange"
              />
              <MetricCard
                label="Beneficiary profiles"
                value={data?.profileCount ?? "—"}
                detail={`${data?.identifiedLocations ?? 0} locations identified`}
                icon={<PeopleIcon />}
                tone="green"
              />
              <MetricCard
                label="Conversation turns"
                value={data?.totalTurns ?? "—"}
                detail="Across all transcripts"
                icon={<MessageIcon />}
                tone="blue"
              />
              <MetricCard
                label="Average call time"
                value={data ? formatDuration(data.averageDurationSeconds) : "—"}
                detail={`${data?.activeSessions ?? 0} active now`}
                icon={<ClockIcon />}
                tone="yellow"
              />
            </div>
          </section>

          <section id="regional-reach" className="mt-6 scroll-mt-28">
            <SectionHeading
              eyebrow="Geographic intelligence"
              title="Regional reach"
              detail="Dots represent locations captured during counselling calls."
            />
            <div className="mt-4 grid overflow-hidden rounded-2xl border border-[#f1d1d1] bg-white xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
              <div className="min-h-[470px] p-3 sm:p-5">
                <IndiaMap regions={data?.regions ?? []} />
              </div>
              <div className="border-t border-[#f2d7d5] p-5 sm:p-7 xl:border-l xl:border-t-0">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#723244]">Region summary</p>
                    <p className="mt-1 text-xs text-[#9c5f6d]">Ranked by call volume</p>
                  </div>
                  <span className="rounded-full bg-[#fbe6e7] px-2.5 py-1 text-[11px] font-semibold text-[#9a5967]">
                    {data?.regions.length ?? 0} mapped
                  </span>
                </div>

                {data?.regions.length ? (
                  <ol className="mt-6 space-y-5">
                    {data.regions.slice(0, 6).map((region, index) => (
                      <li key={`${region.district}-${region.state}`} className="flex items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#fbedeb] text-[11px] font-bold text-[#9c5f6d]">
                          {(index + 1).toString().padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#783849]">{region.label}</p>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#fae2e2]">
                            <div
                              className="h-full rounded-full bg-[#d94361]"
                              style={{
                                width: `${Math.max(
                                  12,
                                  (region.count / Math.max(...data.regions.map((item) => item.count))) * 100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-bold text-[#7a3546]">{region.count}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="mt-8 rounded-xl border border-dashed border-[#f1d2d3] p-5 text-center text-sm text-[#9c5f6d]">
                    Location data will appear here as beneficiary profiles are completed.
                  </div>
                )}

                <div className="mt-8 border-t border-[#f3dcda] pt-5">
                  <div className="flex justify-between text-xs text-[#9c5f6d]">
                    <span>Location capture rate</span>
                    <span className="font-semibold text-[#7d4050]">
                      {data?.totalSessions
                        ? Math.round((data.identifiedLocations / data.totalSessions) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f7e5e2]">
                    <div
                      className="h-full rounded-full bg-[#d35a72]"
                      style={{
                        width: `${
                          data?.totalSessions
                            ? (data.identifiedLocations / data.totalSessions) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <section id="sessions" className="scroll-mt-28 overflow-hidden rounded-2xl border border-[#f1d1d1] bg-white">
              <div className="flex items-center justify-between border-b border-[#f2d7d5] px-5 py-5 sm:px-6">
                <div>
                  <p className="text-sm font-semibold text-[#723244]">Recent counselling calls</p>
                  <p className="mt-1 text-xs text-[#9c5f6d]">Latest records from Supabase</p>
                </div>
                <span className="rounded-full bg-[#faeae6] px-3 py-1 text-[11px] font-semibold text-[#9c5f6d]">
                  {data?.totalSessions ?? 0} total
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#f4dedc] bg-[#fffaf7] text-[10px] font-semibold tracking-[0.13em] text-[#b27884] uppercase">
                      <th className="px-6 py-3.5">Beneficiary</th>
                      <th className="px-4 py-3.5">Region</th>
                      <th className="px-4 py-3.5">Language</th>
                      <th className="px-4 py-3.5">Duration</th>
                      <th className="px-4 py-3.5">Profile</th>
                      <th className="px-6 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f5e3e0]">
                    {data?.sessions.length ? (
                      data.sessions.slice(0, 8).map((session) => (
                        <tr key={session.id} className="transition-colors hover:bg-[#fffaf7]">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ffe5e5] text-xs font-bold text-[#a84f63]">
                                {session.name
                                  .split(/\s+/)
                                  .slice(0, 2)
                                  .map((part) => part[0])
                                  .join("")
                                  .toUpperCase()}
                              </span>
                              <div>
                                <p className="max-w-40 truncate text-sm font-semibold text-[#783849]">{session.name}</p>
                                <p className="mt-0.5 text-[11px] text-[#b27884]">{formatUpdate(session.startedAt)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-[#86505e]">
                            {[session.district, session.state].filter(Boolean).join(", ") || "Not captured"}
                          </td>
                          <td className="px-4 py-4 text-sm text-[#86505e]">{session.language}</td>
                          <td className="px-4 py-4 font-mono text-xs text-[#86505e]">{formatDuration(session.durationSeconds)}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[#f9e9e6]">
                                <div className="h-full rounded-full bg-[#cf5870]" style={{ width: `${session.profileCompletion}%` }} />
                              </div>
                              <span className="text-[11px] font-semibold text-[#9c5f6d]">{session.profileCompletion}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={session.status} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-14 text-center text-sm text-[#9c5f6d]">
                          No counselling sessions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="languages" className="scroll-mt-28 rounded-2xl border border-[#f1d1d1] bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#723244]">Language mix</p>
                  <p className="mt-1 text-xs text-[#9c5f6d]">Calls by preferred language</p>
                </div>
                <LanguageIcon />
              </div>

              {data?.languageCounts.length ? (
                <div className="mt-7 space-y-5">
                  {data.languageCounts.map((item, index) => {
                    const percentage = Math.round((item.count / data.totalSessions) * 100);
                    const colors = ["#d94361", "#cb506a", "#e18489", "#d07b8c"];
                    return (
                      <div key={item.language}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[#86505e]">{item.language}</span>
                          <span className="font-semibold text-[#7d4050]">{item.count} · {percentage}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f7e5e2]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${percentage}%`, backgroundColor: colors[index % colors.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-8 text-sm text-[#9c5f6d]">No language data available.</p>
              )}

              <div className="mt-8 grid grid-cols-2 gap-3 border-t border-[#f3dcda] pt-5">
                <MiniStat label="Recommendations" value={data?.totalRecommendations ?? 0} />
                <MiniStat label="Active calls" value={data?.activeSessions ?? 0} />
              </div>
            </section>
          </div>

          <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-[#f1d1d1] py-5 text-[11px] text-[#b27884] sm:flex-row">
            <p>PM-AJAY Livelihood Helpline · Administrative Portal</p>
            <p>Data source: Supabase · Times shown in IST</p>
          </footer>
        </div>
      </div>
    </main>
  );
}

function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#d94361] text-white">
        <span className="h-4 w-4 rounded-full border-2 border-white" />
        <span className="absolute h-px w-6 rotate-45 bg-white" />
        <span className="absolute h-px w-6 -rotate-45 bg-white" />
      </div>
      <div>
        <p className={`text-base font-bold tracking-[0.02em] ${light ? "text-[#743143]" : "text-[#6f2c3d]"}`}>PM-AJAY</p>
        <p className={`text-[9px] font-semibold tracking-[0.2em] uppercase ${light ? "text-[#b46b78]" : "text-[#b27884]"}`}>Admin console</p>
      </div>
    </div>
  );
}

function NavItem({ href, label, active = false, icon }: { href: string; label: string; active?: boolean; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${active ? "bg-white/75 font-semibold text-[#8b3049]" : "text-[#a96a77] hover:bg-white/55 hover:text-[#8b4254]"}`}
    >
      <span className={active ? "text-[#df5c73]" : "text-[#9c5f6d]"}>{icon}</span>
      {label}
    </a>
  );
}

function MetricCard({ label, value, detail, icon, tone }: { label: string; value: string | number; detail: string; icon: React.ReactNode; tone: "orange" | "green" | "blue" | "yellow" }) {
  const tones = {
    orange: "bg-[#ffe9e3] text-[#d34763]",
    green: "bg-[#ffe3e6] text-[#c94f68]",
    blue: "bg-[#ffeaec] text-[#c46377]",
    yellow: "bg-[#ffe5df] text-[#c86765]",
  };
  return (
    <article className="rounded-2xl border border-[#f1d1d1] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#9c5f6d]">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#6f2c3d]">{value}</p>
          <p className="mt-2 text-[11px] text-[#b27884]">{detail}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span>
      </div>
    </article>
  );
}

function SectionHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.15em] text-[#d94361] uppercase">{eyebrow}</p>
      <div className="mt-1 flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
        <h2 className="text-xl font-semibold tracking-[-0.025em] text-[#723244]">{title}</h2>
        <p className="text-xs text-[#9c5f6d]">{detail}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "completed" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${status === "completed" ? "bg-[#ffe8ec] text-[#a63c54]" : "bg-[#fff0e8] text-[#a64e5d]"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "completed" ? "bg-[#df6a7f]" : "bg-[#e07b7b]"}`} />
      {status}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#fff0eb] p-3">
      <p className="text-xl font-semibold text-[#783849]">{value}</p>
      <p className="mt-1 text-[10px] text-[#b27884]">{label}</p>
    </div>
  );
}

function Icon({ children, className = "h-4 w-4" }: { children: React.ReactNode; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>{children}</svg>;
}

const strokeProps = { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function GridIcon() { return <Icon><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" {...strokeProps} /></Icon>; }
function MapPinIcon() { return <Icon><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" {...strokeProps} /><circle cx="12" cy="10" r="2.5" {...strokeProps} /></Icon>; }
function PhoneIcon() { return <Icon><path d="M5.2 3.8 8.4 3l2 5-2.1 1.5a14.8 14.8 0 0 0 6.2 6.2l1.5-2.1 5 2-.8 3.2a2 2 0 0 1-2 1.5C10 19.6 4.4 14 3.7 5.8a2 2 0 0 1 1.5-2Z" {...strokeProps} /></Icon>; }
function LanguageIcon() { return <Icon><path d="M4 5h10M9 3v2m3 0c-1 5-4 8-8 9m3-6c1 3 3 5 6 6m2-3 4 10m0-10-4 10m1.2-3h5.6" {...strokeProps} /></Icon>; }
function PeopleIcon() { return <Icon><path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 4 18.5V20m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-1a3 3 0 0 1 0 6" {...strokeProps} /></Icon>; }
function MessageIcon() { return <Icon><path d="M21 12a8 8 0 0 1-8 8H5l-3 2 1.2-5A9 9 0 1 1 21 12Z" {...strokeProps} /><path d="M8 11h8M8 15h5" {...strokeProps} /></Icon>; }
function ClockIcon() { return <Icon><circle cx="12" cy="12" r="9" {...strokeProps} /><path d="M12 7v5l3 2" {...strokeProps} /></Icon>; }
function RefreshIcon() { return <Icon><path d="M20 7v5h-5M4 17v-5h5M6.1 8A7 7 0 0 1 18.5 7M5.5 17A7 7 0 0 0 17.9 16" {...strokeProps} /></Icon>; }
function ShieldIcon({ className }: { className?: string }) { return <Icon className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" {...strokeProps} /><path d="m9 12 2 2 4-4" {...strokeProps} /></Icon>; }
