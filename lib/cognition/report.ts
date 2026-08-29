import { SKILL_DOMAINS } from "@/lib/games/types";
import type { AbilityState, GameSession } from "@/lib/games/types";
import { DOMAIN_INFO } from "@/lib/games/config";
import { localDayKey } from "./trends";
import { GAME_TITLES } from "@/components/games/game-meta";
import { suggestLevel } from "./insights";
import type { CoachReport } from "./insights";

const LEVEL_LABEL: Record<string, string> = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
};

/**
 * Builds a self-contained, printable progress report as an HTML string.
 * Pure function (no DOM) so it can be unit-tested and rendered either by
 * opening a new window for printing or by downloading a .html file.
 *
 * Everything is built from on-device data — the report itself contains a
 * privacy note making clear nothing was uploaded.
 */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function dateStr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function statusLabel(status: CoachReport["status"]): string {
  switch (status) {
    case "improving":
      return "Improving";
    case "needs-care":
      return "Needs a little extra care";
    case "getting-started":
      return "Just getting started";
    default:
      return "Steady";
  }
}

export interface ReportInput {
  coach: CoachReport;
  sessions: GameSession[];
  generatedAt: string;
}

export function buildReportHtml({ coach, sessions, generatedAt }: ReportInput): string {
  const totalSessions = sessions.length;
  const firstDate = sessions.length ? dateStr(sessions[0].startedAt) : "—";
  const lastDate = sessions.length ? dateStr(sessions[sessions.length - 1].startedAt) : "—";

  const domainRows = SKILL_DOMAINS.map((d) => {
    const ability = coach.abilities.find((a) => a.domain === d);
    const trend = coach.trends.find((t) => t.domain === d);
    const level = ability ? (ability.theta + 1.2).toFixed(1) : "—";
    let status = "Steady";
    if (trend && trend.slopePerWeek !== null) {
      if (trend.slopePerWeek > 0.04) status = "Improving";
      else if (trend.slopePerWeek < -0.12) status = "Needs care";
    }
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e7e5e4">${esc(DOMAIN_INFO[d].label)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e7e5e4;text-align:center">${level}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e7e5e4;text-align:center;font-weight:600">${status}</td>
    </tr>`;
  }).join("");

  const recent = sessions
    .slice(-12)
    .reverse()
    .map((s) => {
      const correct = s.trials.filter((t) => t.correct).length;
      const total = s.trials.length || 1;
      const pct = Math.round((correct / total) * 100);
      const day = localDayKey(s.startedAt) || dateStr(s.startedAt);
      return `<tr>
        <td style="padding:7px 10px;border-bottom:1px solid #eee">${esc(day)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee">${esc(GAME_TITLES[s.game] ?? s.game)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:center">${pct}%</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:center">${s.trials.length}</td>
      </tr>`;
    })
    .join("");

  const weakest = coach.abilities.length
    ? coach.abilities.reduce((a, b) => (b.theta < a.theta ? b : a), coach.abilities[0])
    : null;
  const levelLabel = weakest ? LEVEL_LABEL[suggestLevel(weakest.theta)] ?? "Moderate" : "Moderate";
  const planGames = coach.nextPlan.games
    .map((g) => `<li style="margin-bottom:6px"><b>${esc(GAME_TITLES[g] ?? g)}</b> — ${esc(coach.nextPlan.reasons[g] ?? "")}</li>`)
    .join("");

  const insights = coach.insights
    .map((ins) => {
      const tone =
        ins.tone === "warning"
          ? "#b3123c"
          : ins.tone === "praise"
            ? "#15803d"
            : ins.tone === "plan"
              ? "#0f766e"
              : "#b45309";
      return `<li style="margin-bottom:10px">
        <span style="color:${tone};font-weight:700">${esc(ins.title)}</span><br/>
        <span style="color:#444">${esc(ins.detail)}</span>
      </li>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>CareGiver Progress Report</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1c19;max-width:780px;margin:0 auto;padding:32px;line-height:1.5}
  h1{color:#0f766e;margin-bottom:0}
  h2{color:#0f766e;border-bottom:2px solid #ccfbf1;padding-bottom:4px;margin-top:28px}
  .muted{color:#78716c}
  .stat{display:inline-block;background:#f5f4f1;border-radius:14px;padding:12px 16px;margin:6px 8px 6px 0;min-width:120px}
  .stat b{display:block;font-size:24px;color:#0f766e}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  .banner{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:16px;padding:16px 20px;margin:16px 0}
  .foot{margin-top:28px;font-size:12px;color:#78716c;border-top:1px solid #e7e5e4;padding-top:10px}
  @media print{body{padding:12px}}
</style></head>
<body>
  <h1>CareGiver — Progress Report</h1>
  <p class="muted">Generated ${esc(dateStr(generatedAt))} · all data stays on this device</p>

  <div class="banner">
    <p style="font-size:20px;font-weight:700;margin:0 0 4px">${esc(coach.headline)}</p>
    <p style="margin:0"><b>Overall:</b> ${esc(statusLabel(coach.status))}</p>
    ${
      coach.caregiverNote
        ? `<p style="margin:6px 0 0"><b>Note for carers:</b> ${esc(coach.caregiverNote)}</p>`
        : ""
    }
  </div>

  <h2>At a glance</h2>
  <div>
    <div class="stat"><b>${totalSessions}</b>total sessions</div>
    <div class="stat"><b>${coach.sessionsLast7Days}</b>sessions this week</div>
    <div class="stat"><b>${coach.activeDaysLast7Days}/7</b>active days</div>
    <div class="stat"><b>${firstDate}</b>first session</div>
    <div class="stat"><b>${lastDate}</b>most recent</div>
  </div>

  <h2>Skill areas</h2>
  <table>
    <thead><tr><th style="text-align:left;padding:8px 10px">Skill</th><th style="text-align:center;padding:8px 10px">Level</th><th style="text-align:center;padding:8px 10px">Trend</th></tr></thead>
    <tbody>${domainRows}</tbody>
  </table>

  <h2>Suggestions &amp; coaching</h2>
   <ul style="padding-left:18px">${insights || "<li>No suggestions yet — keep playing.</li>"}</ul>

   <h2>Recommended plan</h2>
   <p style="margin:0 0 6px">Suggested difficulty: <b>${esc(levelLabel)}</b></p>
   ${
     planGames
       ? `<ul style="padding-left:18px">${planGames}</ul>`
       : `<p class="muted">Play any game to build a personalised plan.</p>`
   }

   <h2>Recent activity</h2>
  ${
    recent
      ? `<table>
        <thead><tr><th style="text-align:left;padding:7px 10px">Date</th><th style="text-align:left;padding:7px 10px">Game</th><th style="text-align:center;padding:7px 10px">Accuracy</th><th style="text-align:center;padding:7px 10px">Items</th></tr></thead>
        <tbody>${recent}</tbody>
      </table>`
      : `<p class="muted">No sessions recorded yet.</p>`
  }

  <div class="foot">
    This report was generated entirely on your device from locally stored activity.
    No photos, names or results were uploaded to any server. CareGiver is a
    supportive tool, not a medical diagnosis.
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body></html>`;
}

/** Opens the report in a new window and triggers print; falls back to download. */
export function openReportForPrint(html: string): void {
  try {
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) throw new Error("blocked");
    w.document.open();
    w.document.write(html);
    w.document.close();
  } catch {
    // Pop-up blocked — offer the file instead.
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memoryassist-report-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
