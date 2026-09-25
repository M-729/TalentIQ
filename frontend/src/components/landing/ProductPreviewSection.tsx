import { CalendarClock, ChevronDown, FileCheck2, LayoutDashboard, Sparkles, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = ["Overview", "Jobs", "Applications", "Hiring Pipeline", "Interviews", "Offers", "Analytics"];
const CANDIDATES = [
  { initials: "AM", name: "Ava Miller", role: "Product Designer", score: "Strong match" },
  { initials: "JK", name: "Jon Kim", role: "Product Designer", score: "Review" },
  { initials: "SR", name: "Sofia Reyes", role: "Product Designer", score: "Strong match" },
];

// A static product illustration assembled from real TalentIQ concepts. It is
// intentionally labeled and uses sample candidate data only as interface
// content, never as a performance claim or live customer data.
export function ProductPreviewSection() {
  return (
    <div className="overflow-hidden rounded-xl border border-[#2b3455] bg-[#121a33] p-2 shadow-[0_24px_55px_rgba(18,26,51,0.18)] sm:p-3" aria-hidden="true">
      <div className="overflow-hidden rounded-lg border border-white/10 bg-[#f7f8fc]">
        <div className="flex h-9 items-center gap-1.5 border-b border-[#dfe2ec] bg-white px-3">
          <span className="size-2 rounded-full bg-[#f0a4a4]" />
          <span className="size-2 rounded-full bg-[#efd39a]" />
          <span className="size-2 rounded-full bg-[#a7d8ba]" />
          <span className="ml-3 text-[10px] font-medium text-[#747a91]">TalentIQ / Hiring workspace</span>
        </div>

        <div className="grid min-h-[25rem] grid-cols-[9.5rem_minmax(0,1fr)] sm:min-h-[29rem] sm:grid-cols-[11rem_minmax(0,1fr)]">
          <aside className="hidden bg-[#121a33] px-3 py-4 text-[#b8c0dd] sm:block">
            <div className="mb-6 flex items-center gap-2 px-1 text-xs font-bold text-white">
              <span className="flex size-5 items-center justify-center rounded-md bg-[#5546e8]"><LayoutDashboard className="size-3" /></span>
              Northstar Studio
            </div>
            <ul className="space-y-1 text-[11px] font-medium">
              {NAV_ITEMS.map((item, index) => (
                <li key={item} className={index === 3 ? "rounded-md bg-[#293558] px-2.5 py-2 text-white" : "px-2.5 py-2"}>
                  {item}
                </li>
              ))}
            </ul>
          </aside>

          <div className="min-w-0 p-3 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#6d7390]">Hiring pipeline</p>
                <h2 className="mt-1 text-sm font-bold text-[#15172b] sm:text-base">Product Designer</h2>
              </div>
              <button type="button" className="hidden items-center gap-1 rounded-md border border-[#dfe2ec] bg-white px-2 py-1 text-[10px] font-medium text-[#52586f] sm:flex">
                This month <ChevronDown className="size-3" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {[
                ["New", "14", "bg-[#efeefe] text-[#5546e8]"],
                ["Review", "8", "bg-[#eef2ff] text-[#4052ba]"],
                ["Interview", "5", "bg-[#fff5e8] text-[#a55a05]"],
                ["Offer", "2", "bg-[#eaf7ee] text-[#15803d]"],
              ].map(([label, count, color], index) => (
                <div key={label} className={`rounded-md px-2 py-2 ${index === 3 ? "hidden sm:block" : ""} ${color}`}>
                  <p className="text-[9px] font-medium opacity-80">{label}</p>
                  <p className="mt-0.5 text-base font-bold">{count}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(9rem,0.75fr)]">
              <div className="overflow-hidden rounded-lg border border-[#dfe2ec] bg-white">
                <div className="flex items-center justify-between border-b border-[#e7e9f0] px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-[#252940]">Candidates to review</p>
                  <span className="rounded-full bg-[#f0f1f7] px-1.5 py-0.5 text-[9px] font-semibold text-[#6d7390]">8</span>
                </div>
                <div className="divide-y divide-[#e7e9f0]">
                  {CANDIDATES.map((candidate, index) => (
                    <div key={candidate.name} className="flex items-center gap-2.5 px-3 py-2.5">
                      <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[8px] font-bold ${index === 1 ? "bg-[#f7e8d8] text-[#9b5c20]" : "bg-[#e9e6ff] text-[#5546e8]"}`}>{candidate.initials}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-semibold text-[#252940]">{candidate.name}</p>
                        <p className="truncate text-[9px] text-[#747a91]">{candidate.role}</p>
                      </div>
                      <Badge variant={index === 1 ? "neutral" : "success"} className="hidden text-[8px] sm:inline-flex">{candidate.score}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                <div className="rounded-lg border border-[#dfe2ec] bg-white p-3">
                  <div className="flex size-6 items-center justify-center rounded-md bg-[#eeeaff] text-[#5546e8]"><Sparkles className="size-3.5" /></div>
                  <p className="mt-3 text-[10px] font-semibold text-[#252940]">AI screening ready</p>
                  <p className="mt-1 text-[9px] leading-relaxed text-[#747a91]">Review CV fit and supporting details.</p>
                </div>
                <div className="rounded-lg border border-[#dfe2ec] bg-white p-3">
                  <div className="flex size-6 items-center justify-center rounded-md bg-[#e8f4ff] text-[#3d6e9f]"><CalendarClock className="size-3.5" /></div>
                  <p className="mt-3 text-[10px] font-semibold text-[#252940]">Interview today</p>
                  <p className="mt-1 text-[9px] leading-relaxed text-[#747a91]">2:30 PM · Meet link ready</p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#e3e5ed] bg-white px-3 py-2 text-[9px] text-[#747a91]">
              <UsersRound className="size-3.5 text-[#5546e8]" />
              <span className="font-semibold text-[#39405a]">Team review</span>
              <span className="truncate">Share feedback before moving candidates forward.</span>
              <FileCheck2 className="ml-auto hidden size-3.5 text-[#15803d] sm:block" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
