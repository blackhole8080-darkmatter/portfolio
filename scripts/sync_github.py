#!/usr/bin/env python3
"""Regenerate ../data.js from the live GitHub account.

Curated copy (titles, blurbs, categories) lives here; everything numeric —
stars, commit counts, languages, last push — is pulled from the API so the
portfolio never drifts out of date.

Usage:  python scripts/sync_github.py [login]
Requires: gh CLI, authenticated (`gh auth status`).
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data.js"
LOGIN = sys.argv[1] if len(sys.argv) > 1 else "blackhole8080-darkmatter"

# ---------------------------------------------------------------- curated copy
# Keyed by repo name. `featured` entries get full cards; the rest appear in
# the "also in the lab" list. Keep descriptions factual — they are claims.
CURATED: dict[str, dict] = {
    "DEEP": {
        "title": "DEEP",
        "tagline": "A JARVIS with a security brain, running on your own machine.",
        "blurb": (
            "Passive network monitoring, anomaly detection, and OSINT investigation fused "
            "into one assistant. Every finding is enriched with MITRE ATT&CK techniques and "
            "CVEs, and every verdict names the API that produced it — so it can be audited "
            "instead of trusted. Runs fully offline on a local model; cloud is the fallback."
        ),
        "categories": ["ai", "security"],
        "featured": True,
        "highlight": "63 tools · 22 threat-intel APIs · 17 keyless",
        "year": 2026,
        "order": 1,
    },
    "deadline-noir": {
        "title": "DEADLINE",
        "tagline": "A noir detective game where the murderer is whoever you leaned on.",
        "blurb": (
            "One newsroom, three suspects, one night. You walk the rooms with a torch, "
            "question everyone, and feed what you learn back into the interrogation. There "
            "is no fixed culprit: catch two people lying and the case locks onto the suspect "
            "you pressed hardest. Play it again and it is someone else."
        ),
        "categories": ["games"],
        "featured": True,
        "highlight": "First-person · shipped · playable in the browser",
        "year": 2026,
        "order": 2,
        "live": True,
    },
    "parlour": {
        "title": "Parlour",
        "tagline": "Seven board games, one engine, no accounts, works offline.",
        "blurb": (
            "Each game is pure data and pure functions — a spec the shared renderer and one "
            "alpha-beta search consume. Tic-tac-toe is solved exactly so the hardest "
            "opponent is genuinely unbeatable; the rest fall back to a hand-written "
            "evaluation. Seven games, one engine, zero backend."
        ),
        "categories": ["games", "ai"],
        "featured": True,
        "highlight": "7 games · one shared search · local-first",
        "year": 2026,
        "order": 3,
    },
    "urlscan-mcp": {
        "title": "urlscan-mcp",
        "tagline": "An MCP server that refuses to call an unknown indicator clean.",
        "blurb": (
            "Most urlscan tools hand a model the raw API document — often several megabytes. "
            "This one shapes every response for reasoning (2.7 MB → 3.3 KB on a real scan, "
            "812×) and distinguishes no data from no findings everywhere. Search and country "
            "lookups work without a key; capabilities are reported instead of discovered by "
            "failure."
        ),
        "categories": ["security", "ai"],
        "featured": True,
        "highlight": "15 tools · 812× smaller responses · MIT",
        "year": 2026,
        "order": 4,
    },
    "indra-weather": {
        "title": "Indra",
        "tagline": "An environmental OSINT command centre on a full-bleed world map.",
        "blurb": (
            "Weather, air quality, seismic activity, wildfires, floods and live disaster "
            "events, correlated into a single dossier for any point on the map. Flask "
            "blueprints in vertical slices, vanilla JS and Leaflet in front — no build step, "
            "mostly key-less APIs, provenance attached to every response."
        ),
        "categories": ["web", "data"],
        "featured": True,
        "highlight": "8 data domains · Leaflet · Flask",
        "year": 2026,
        "order": 5,
    },
    "science": {
        "title": "Science Lab",
        "tagline": "Physics, chemistry and biology that show their working.",
        "blurb": (
            "Every calculator prints the rearrangement it used and draws the result: ray "
            "diagrams for lenses, schematics for circuits, decay curves for radioactivity, "
            "3D models for molecules. No build step, no network calls — three.js is vendored "
            "so the whole lab keeps working with the wifi off."
        ),
        "categories": ["science", "web"],
        "featured": True,
        "highlight": "Offline · three.js · no build step",
        "year": 2026,
        "order": 6,
    },
    "Ananta": {
        "title": "Ananta",
        "tagline": "A knowledge engine that argues with itself before answering.",
        "blurb": (
            "108 specialist nodes across nine clusters, plus a courtroom of debating agents: "
            "a proposer, a critic, a methodology judge and a halt judge bounded by hard round "
            "and cost ceilings. A constitution forces claims to be grounded or marked "
            "uncertain. It does not pretend to be a giant model — it wields borrowed ones."
        ),
        "categories": ["ai"],
        "featured": True,
        "highlight": "108 nodes · bounded debate · multi-provider",
        "year": 2026,
        "order": 7,
    },
    "my-first-project": {
        "title": "dirstats",
        "tagline": "A small CLI built and shipped properly, end to end.",
        "blurb": (
            "File count and size by extension, with a table view and JSON for scripting. The "
            "interesting part is the craft around it: 16 tests, a six-job CI matrix across "
            "three operating systems and four Python versions, and a console script that was "
            "exercised before it was announced."
        ),
        "categories": ["tools"],
        "featured": True,
        "highlight": "16 tests · 6 CI jobs · 3 OSes",
        "year": 2026,
        "order": 8,
    },
    "python-projects": {
        "title": "python-projects",
        "tagline": "The long-running notebook: everything learned in Python so far.",
        "categories": ["tools"],
        "featured": False,
    },
    "Project-Revelations": {
        "title": "Project Revelations",
        "tagline": "A shelf for poetry and design experiments.",
        "categories": ["writing"],
        "featured": False,
    },
    "project-01-collab-editor": {
        "title": "Collaborative Editor",
        "tagline": "Multi-user editing with live cursors, Monaco and Socket.io.",
        "categories": ["web"],
        "featured": False,
    },
    "casefile": {
        "title": "Casefile",
        "tagline": "A Python and PostgreSQL application, still under wraps.",
        "categories": ["web"],
        "featured": False,
    },
}

SKIP = {
    "hello-world",
    "harborflow_2",
    "DIT014-HT26-Assignment-2-Starter-and-Dataset--1-",
}

CATEGORY_LABELS = {
    "ai": "AI & agents",
    "security": "Security",
    "games": "Games",
    "web": "Web",
    "data": "Data",
    "science": "Science",
    "tools": "Tooling",
    "writing": "Writing",
}


def gh(*args: str) -> str:
    return subprocess.run(["gh", *args], capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=60).stdout


def commit_count(full_name: str) -> int:
    out = subprocess.run(
        ["gh", "api", "-i", f"repos/{full_name}/commits?per_page=1"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60,
    ).stdout
    match = re.search(r'[?&]page=(\d+)>; rel="last"', out)
    if match:
        return int(match.group(1))
    return 1 if '"sha"' in out else 0


def main() -> None:
    user = json.loads(gh("api", f"users/{LOGIN}") or "{}")
    repos = json.loads(gh("api", "--paginate", f"user/repos?per_page=100&affiliation=owner") or "[]")

    projects, also, lang_bytes = [], [], {}
    total_commits = 0

    for repo in repos:
        name = repo["name"]
        if repo["fork"] or name in SKIP:
            continue
        meta = CURATED.get(name)
        if meta is None:
            continue
        langs = json.loads(gh("api", f"repos/{repo['full_name']}/languages") or "{}")
        for lang, size in langs.items():
            lang_bytes[lang] = lang_bytes.get(lang, 0) + size
        commits = commit_count(repo["full_name"])
        total_commits += commits
        entry = {
            "name": name,
            "title": meta["title"],
            "tagline": meta["tagline"],
            "blurb": meta.get("blurb", ""),
            "categories": meta.get("categories", []),
            "highlight": meta.get("highlight", ""),
            "year": meta.get("year", int(repo["created_at"][:4])),
            "order": meta.get("order", 99),
            "stars": repo["stargazers_count"],
            "commits": commits,
            "pushed": repo["pushed_at"][:10],
            "languages": [
                {"name": lang, "share": round(size / max(sum(langs.values()), 1) * 100)}
                for lang, size in sorted(langs.items(), key=lambda kv: -kv[1])[:4]
            ],
            "url": repo["html_url"],
            "live": repo.get("homepage") or None,
        }
        # keep only live links we can stand behind
        if entry["live"] and not entry["live"].startswith("http"):
            entry["live"] = None
        (projects if meta.get("featured") else also).append(entry)

    projects.sort(key=lambda p: p["order"])
    also.sort(key=lambda p: p["title"].lower())

    top_langs = sorted(lang_bytes.items(), key=lambda kv: -kv[1])[:6]
    total_bytes = sum(lang_bytes.values()) or 1
    languages = [
        {"name": k, "share": round(v / total_bytes * 100, 1)}
        for k, v in top_langs
    ]

    years = sorted({int(r["created_at"][:4]) for r in repos if not r["fork"]})
    payload = {
        "generated": date.today().isoformat(),
        "profile": {
            "login": user.get("login", LOGIN),
            "name": user.get("name") or user.get("login", LOGIN),
            "avatar": user.get("avatar_url", ""),
            "url": user.get("html_url", f"https://github.com/{LOGIN}"),
            "joined": (user.get("created_at") or "")[:4],
            "followers": user.get("followers", 0),
        },
        "stats": {
            "projects": len(projects) + len(also),
            "featured": len(projects),
            "commits": total_commits,
            "languages": len(lang_bytes),
            "stars": sum(p["stars"] for p in projects + also),
            "since": years[0] if years else 2026,
        },
        "languages": languages,
        "projects": projects,
        "also": also,
        "categories": CATEGORY_LABELS,
    }

    body = json.dumps(payload, indent=2, ensure_ascii=False)
    OUT.write_text(
        "/* Generated by scripts/sync_github.py — edit the script, not this file. */\n"
        f"window.PORTFOLIO = {body};\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT.name}: {len(projects)} featured, {len(also)} more, "
          f"{total_commits} commits across {len(lang_bytes)} languages")


if __name__ == "__main__":
    main()
