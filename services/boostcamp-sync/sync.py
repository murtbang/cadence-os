"""
Cadence ↔ Boostcamp sync service.
Runs on Railway as a cron job (*/15 * * * *).
Logs in fresh each run, fetches training history,
classifies workouts, upserts to Supabase, fires Discord on new entries.
"""

import os
import asyncio
import traceback as tb
from datetime import datetime, timezone, timedelta
import httpx
from supabase import create_client, Client
from boostcampapi import BoostcampAPI
from dotenv import load_dotenv

load_dotenv()

# ── env vars ──────────────────────────────────────────────────────────────────
BOOSTCAMP_EMAIL       = os.environ["BOOSTCAMP_EMAIL"]
BOOSTCAMP_PASSWORD    = os.environ["BOOSTCAMP_PASSWORD"]
SUPABASE_URL          = os.environ["SUPABASE_URL"]
SUPABASE_KEY          = os.environ["SUPABASE_KEY"]
DISCORD_WEBHOOK_URL   = os.environ.get("DISCORD_WEBHOOK_URL", "")
# Timezone offset from UTC in minutes. -420 = UTC-7 (US Pacific, summer).
# Drives the "most recent Monday" week math and Boostcamp's timezone_offset param.
TZ_OFFSET_MINUTES     = int(os.environ.get("TZ_OFFSET_MINUTES", "-420"))

# ── exercise → (classification, muscles) map ──────────────────────────────────
# Lowercase substring matching — first match wins.
EXERCISE_MAP: list[tuple[str, str, list[str]]] = [
    # Push — chest
    ("bench press",      "Push", ["chest"]),
    ("incline press",    "Push", ["chest"]),
    ("incline db",       "Push", ["chest"]),
    ("chest fly",        "Push", ["chest"]),
    ("cable fly",        "Push", ["chest"]),
    ("pec deck",         "Push", ["chest"]),
    ("push-up",          "Push", ["chest", "triceps"]),
    ("pushup",           "Push", ["chest", "triceps"]),
    ("dip",              "Push", ["chest", "triceps"]),
    # Push — shoulders
    ("overhead press",   "Push", ["shoulders"]),
    ("shoulder press",   "Push", ["shoulders"]),
    ("military press",   "Push", ["shoulders"]),
    ("lateral raise",    "Push", ["shoulders"]),
    ("front raise",      "Push", ["shoulders"]),
    ("arnold",           "Push", ["shoulders"]),
    # Push — triceps
    ("tricep",           "Push", ["triceps"]),
    ("triceps",          "Push", ["triceps"]),
    ("pushdown",         "Push", ["triceps"]),
    ("skull crusher",    "Push", ["triceps"]),
    ("close grip",       "Push", ["triceps"]),
    # Pull — back
    ("barbell row",      "Pull", ["back"]),
    ("cable row",        "Pull", ["back"]),
    ("seated row",       "Pull", ["back"]),
    ("chest-supported",  "Pull", ["back"]),
    ("lat pulldown",     "Pull", ["back"]),
    ("pull-up",          "Pull", ["back"]),
    ("pull up",          "Pull", ["back"]),
    ("pullup",           "Pull", ["back"]),
    ("chin-up",          "Pull", ["back", "biceps"]),
    ("chin up",          "Pull", ["back", "biceps"]),
    ("t-bar row",        "Pull", ["back"]),
    ("meadows row",      "Pull", ["back"]),
    ("rack pull",        "Pull", ["back"]),
    ("deadlift",         "Pull", ["back", "hamstrings"]),
    # Pull — traps / rear delts
    ("shrug",            "Pull", ["traps"]),
    ("face pull",        "Pull", ["rear delts"]),
    ("rear delt",        "Pull", ["rear delts"]),
    ("reverse fly",      "Pull", ["rear delts"]),
    # Pull — biceps
    ("bicep curl",       "Pull", ["biceps"]),
    ("biceps curl",      "Pull", ["biceps"]),
    ("hammer curl",      "Pull", ["biceps"]),
    ("preacher curl",    "Pull", ["biceps"]),
    ("concentration",    "Pull", ["biceps"]),
    ("curl",             "Pull", ["biceps"]),
    # Legs
    ("squat",            "Legs", ["quads", "glutes"]),
    ("leg press",        "Legs", ["quads", "glutes"]),
    ("hack squat",       "Legs", ["quads"]),
    ("leg extension",    "Legs", ["quads"]),
    ("lunge",            "Legs", ["quads", "glutes"]),
    ("bulgarian",        "Legs", ["quads", "glutes"]),
    ("step-up",          "Legs", ["quads", "glutes"]),
    ("romanian",         "Legs", ["hamstrings", "glutes"]),
    ("rdl",              "Legs", ["hamstrings", "glutes"]),
    ("good morning",     "Legs", ["hamstrings"]),
    ("leg curl",         "Legs", ["hamstrings"]),
    ("hamstring curl",   "Legs", ["hamstrings"]),
    ("hip thrust",       "Legs", ["glutes"]),
    ("glute bridge",     "Legs", ["glutes"]),
    ("calf raise",       "Legs", ["calves"]),
    ("standing calf",    "Legs", ["calves"]),
    ("seated calf",      "Legs", ["calves"]),
    ("abductor",         "Legs", ["glutes"]),
    ("adductor",         "Legs", ["inner thighs"]),
]

WEEKLY_TARGET = ["Push", "Pull", "Push", "Pull", "Legs"]


# ── helpers ───────────────────────────────────────────────────────────────────

def classify_exercise(name: str) -> tuple[str, list[str]]:
    """Return (classification, muscles) for a single exercise name."""
    lower = name.lower()
    for keyword, cls, muscles in EXERCISE_MAP:
        if keyword in lower:
            return cls, muscles
    return "Other", []


def classify_workout(records: list[dict]) -> tuple[str, list[str]]:
    """
    Majority-vote classification across all exercises in a workout.
    Returns (classification, deduplicated muscle list).
    """
    votes: dict[str, int] = {}
    all_muscles: list[str] = []

    for rec in records:
        cls, muscles = classify_exercise(rec.get("name", ""))
        if cls != "Other":
            votes[cls] = votes.get(cls, 0) + 1
            for m in muscles:
                if m not in all_muscles:
                    all_muscles.append(m)

    if not votes:
        return "Other", all_muscles

    winner = max(votes, key=lambda k: votes[k])
    return winner, all_muscles


def week_start() -> str:
    """ISO date string for the most recent Monday in the configured timezone."""
    now = datetime.now(timezone(timedelta(minutes=TZ_OFFSET_MINUTES)))
    days_since_monday = now.weekday()  # Mon=0
    monday = now - timedelta(days=days_since_monday)
    return monday.date().isoformat()


def build_workout_id(date_str: str, index: int) -> str:
    return f"{date_str}-{index}"


def discord_notify(message: str) -> None:
    if not DISCORD_WEBHOOK_URL:
        return
    try:
        httpx.post(DISCORD_WEBHOOK_URL, json={"content": message}, timeout=10)
    except Exception as e:
        print(f"Discord error: {e}")


# ── retry helper ─────────────────────────────────────────────────────────────

async def retry(coro_fn, attempts: int = 3, base_delay: float = 5.0, label: str = "call"):
    """Retry an async callable with exponential backoff."""
    for attempt in range(attempts):
        try:
            return await coro_fn()
        except Exception as e:
            # Walk the full cause chain — wrapper exceptions often have empty str()
            chain = []
            node = e
            while node is not None:
                chain.append(f"{type(node).__name__}({node!r})")
                node = node.__cause__ or (
                    node.__context__ if not getattr(node, '__suppress_context__', False) else None
                )
            msg = f"  ⚠️ {label} attempt {attempt + 1}/{attempts} failed: {' → '.join(chain[:4])}"
            print(msg)
            if attempt == attempts - 1:
                raise
            await asyncio.sleep(base_delay * (2 ** attempt))


# ── main sync ────────────────────────────────────────────────────────────────

async def sync():
    print("=== Boostcamp sync starting ===")

    # 1. Login (with retry)
    api = BoostcampAPI()
    await retry(lambda: api.login(BOOSTCAMP_EMAIL, BOOSTCAMP_PASSWORD),
                attempts=3, base_delay=5, label="login")
    print("Logged in to Boostcamp")

    # 2. Fetch training history (with retry)
    history_resp = await retry(lambda: api.get_training_history(timezone_offset=TZ_OFFSET_MINUTES),
                               attempts=3, base_delay=10, label="get_training_history")
    history_data: dict = history_resp.get("data", {})
    print(f"Fetched {len(history_data)} training dates")

    # 3. Connect to Supabase
    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 4. Fetch existing boostcamp_ids so we know what's new (scoped to last 30 days)
    id_cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
    existing_resp = (
        sb.table("boostcamp_workouts")
        .select("boostcamp_id")
        .gte("logged_at", f"{id_cutoff}T00:00:00+00:00")
        .execute()
    )
    existing_ids: set[str] = {row["boostcamp_id"] for row in (existing_resp.data or [])}

    new_count = 0
    auto_logged_dates: set[str] = set()  # avoid calling auto-complete twice for same date

    # Sort dates newest-first; only process last 14 days to keep it fast
    cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).date().isoformat()
    recent_dates = sorted(
        [d for d in history_data.keys() if d >= cutoff],
        reverse=True
    )

    for date_str in recent_dates:
        workouts = history_data[date_str]
        for i, workout in enumerate(workouts):
            wid = build_workout_id(date_str, i)
            if wid in existing_ids:
                continue  # already synced

            records = workout.get("records", [])
            classification, muscles = classify_workout(records)
            exercise_names = [r.get("name", "") for r in records]
            workout_name = workout.get("name") or workout.get("title") or "Workout"

            row = {
                "boostcamp_id":    wid,
                "logged_at":       f"{date_str}T12:00:00+00:00",
                "workout_name":    workout_name,
                "classification":  classification,
                "muscles_json":    muscles,
                "exercises_json":  exercise_names,
                "raw_json":        workout,
            }

            sb.table("boostcamp_workouts").upsert(row, on_conflict="boostcamp_id").execute()
            existing_ids.add(wid)
            new_count += 1

            # Auto-complete matching habits (once per date, idempotent)
            if date_str not in auto_logged_dates:
                auto_complete_workout_habit(sb, date_str)
                auto_logged_dates.add(date_str)

            # Only notify Discord for workouts logged in the last 25 hours
            workout_dt = datetime.fromisoformat(f"{date_str}T12:00:00+00:00")
            is_recent = (datetime.now(timezone.utc) - workout_dt).total_seconds() < 90000  # 25h

            if is_recent:
                muscles_str   = ", ".join(muscles) if muscles else "—"
                exercises_str = ", ".join(exercise_names[:5])
                if len(exercise_names) > 5:
                    exercises_str += f" +{len(exercise_names) - 5} more"

                # Determine next focus from weekly progress (count-based)
                week_start_str = week_start()
                week_resp = (
                    sb.table("boostcamp_workouts")
                    .select("classification, logged_at")
                    .gte("logged_at", f"{week_start_str}T00:00:00+00:00")
                    .order("logged_at")
                    .execute()
                )
                completed_this_week = [r["classification"] for r in (week_resp.data or [])]
                next_focus = _next_focus(completed_this_week)

                msg = (
                    f"🏋️ **Workout logged: {classification}**\n"
                    f"{exercises_str}\n"
                    f"Worked: {muscles_str}\n"
                    f"Next up: {next_focus}"
                )
                discord_notify(msg)

            print(f"  New workout: {wid} → {classification}")

    print(f"=== Sync complete. {new_count} new workout(s) inserted ===")

    # Upsert summary stats (streak, totals) for the Training view
    summary_resp = await retry(lambda: api.get_home_summary(timezone_offset=TZ_OFFSET_MINUTES),
                               attempts=3, base_delay=5, label="get_home_summary")
    summary_data = summary_resp.get("data", {})
    if summary_data:
        sb.table("boostcamp_summary").upsert({
            "id":              "singleton",
            "week_streak":     summary_data.get("week_streak", 0),
            "total_workouts":  summary_data.get("total_workouts", 0),
            "total_hours":     float(summary_data.get("total_hours", 0)),
            "total_weight_lb": float(summary_data.get("total_weight", 0)),
            "synced_at":       datetime.now(timezone.utc).isoformat(),
        }, on_conflict="id").execute()
        print(f"  Summary: {summary_data.get('week_streak')} week streak, {summary_data.get('total_workouts')} workouts")

    return new_count


def auto_complete_workout_habit(sb: Client, date_str: str) -> None:
    """
    Auto-log any habit whose name contains a workout keyword for the given date.
    Runs after each newly-synced workout. Safe to call multiple times (idempotent).
    """
    TRIGGER_KEYWORDS = ["workout", "run", "gym", "train", "exercise"]

    habits_resp = sb.table("habits").select("id, name").is_("deleted_at", "null").execute()
    for habit in (habits_resp.data or []):
        if not any(kw in habit["name"].lower() for kw in TRIGGER_KEYWORDS):
            continue

        # Already logged for this date? Skip.
        existing = (
            sb.table("habit_logs")
            .select("id")
            .eq("habit_id", habit["id"])
            .eq("date", date_str)
            .execute()
        )
        if existing.data:
            continue

        sb.table("habit_logs").insert({
            "habit_id": habit["id"],
            "date":     date_str,
            "type":     "done",
        }).execute()
        print(f"  ✅ Auto-logged habit '{habit['name']}' for {date_str}")


def _next_focus(completed: list[str]) -> str:
    n = len(completed)
    if n >= len(WEEKLY_TARGET):
        return "Recovery / Optional"
    return WEEKLY_TARGET[n]


if __name__ == "__main__":
    try:
        asyncio.run(asyncio.wait_for(sync(), timeout=120))
    except Exception as exc:
        full = tb.format_exc()
        # Walk the cause chain so empty-message wrapper exceptions show the real error
        cause_chain = []
        e = exc
        while e:
            cause_chain.append(f"{type(e).__name__}: {e!r}")
            e = e.__cause__ or (e.__context__ if not getattr(e, '__suppress_context__', False) else None)
        cause_str = " → ".join(cause_chain[:4])
        discord_notify(
            f"❌ Boostcamp sync crashed: {cause_str}\n```{full[-1200:]}```"
        )
        raise
