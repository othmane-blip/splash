"""Interactive Q&A module to gather user's professional context."""

from __future__ import annotations

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt

from .models import UserContext

console = Console()

QUESTIONS = [
    {
        "key": "name",
        "question": "What's your name?",
        "help": "This will be used to personalize your posts",
    },
    {
        "key": "role",
        "question": "What's your current role and company?",
        "help": "e.g., 'Senior Product Manager at Stripe'",
    },
    {
        "key": "industry",
        "question": "What industry are you in?",
        "help": "e.g., 'FinTech', 'SaaS', 'Healthcare AI'",
    },
    {
        "key": "expertise_areas",
        "question": "What are your top 3-5 areas of expertise?",
        "help": "Comma-separated, e.g., 'product strategy, growth, B2B SaaS, data-driven decisions'",
        "is_list": True,
    },
    {
        "key": "recent_achievements",
        "question": "Share 2-3 recent wins or achievements you're proud of",
        "help": "Comma-separated, e.g., 'launched a product that hit 10K users, led a team restructure, spoke at a conference'",
        "is_list": True,
    },
    {
        "key": "opinions",
        "question": "What strong opinions or hot takes do you have about your industry?",
        "help": "Comma-separated, e.g., 'most MVPs are too complex, remote work is the future, AI will replace 50%% of tasks'",
        "is_list": True,
    },
    {
        "key": "target_audience",
        "question": "Who is your target audience on LinkedIn?",
        "help": "e.g., 'tech founders, product managers, junior engineers'",
    },
    {
        "key": "tone_preference",
        "question": "What tone do you prefer? (professional / casual / bold)",
        "help": "professional = polished, casual = friendly and approachable, bold = provocative and opinionated",
        "default": "professional",
    },
]


def gather_user_context() -> UserContext:
    """Run the interactive questionnaire and return user context."""
    console.print()
    console.print(
        Panel(
            "[bold cyan]Let's personalize your LinkedIn posts![/]\n\n"
            "I'll ask you a few questions about your professional life.\n"
            "Your answers help me craft posts that sound authentically like you.",
            title="LinkedIn Post Generator",
            border_style="cyan",
        )
    )
    console.print()

    context = UserContext()

    for q in QUESTIONS:
        console.print(f"[dim]{q['help']}[/dim]")
        default = q.get("default", "")
        answer = Prompt.ask(f"[bold]{q['question']}[/bold]", default=default or None)

        if not answer:
            continue

        if q.get("is_list"):
            value = [item.strip() for item in answer.split(",") if item.strip()]
            setattr(context, q["key"], value)
        else:
            setattr(context, q["key"], answer)

    console.print()
    console.print("[green]Thanks! I have everything I need.[/green]")
    console.print()
    _display_context_summary(context)

    return context


def build_user_context(answers: dict) -> UserContext:
    """Build a UserContext from a dict of answers (for non-interactive use, e.g. web UI)."""
    ctx = UserContext()
    for q in QUESTIONS:
        value = answers.get(q["key"], q.get("default", ""))
        if not value:
            continue
        if q.get("is_list"):
            setattr(ctx, q["key"], [item.strip() for item in value.split(",") if item.strip()])
        else:
            setattr(ctx, q["key"], value)
    return ctx


def save_user_context(ctx: UserContext, path: str = "output/user_context.json"):
    """Save user context to JSON for persistence across sessions."""
    from dataclasses import asdict
    from pathlib import Path

    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        import json
        json.dump(asdict(ctx), f, indent=2)


def load_user_context(path: str = "output/user_context.json") -> UserContext | None:
    """Load cached user context from disk."""
    from pathlib import Path

    p = Path(path)
    if not p.exists():
        return None
    with open(p) as f:
        import json
        data = json.load(f)
    return UserContext(**data)


def _display_context_summary(ctx: UserContext):
    """Display a summary of gathered context."""
    lines = [
        f"[bold]Name:[/] {ctx.name}",
        f"[bold]Role:[/] {ctx.role}",
        f"[bold]Industry:[/] {ctx.industry}",
        f"[bold]Expertise:[/] {', '.join(ctx.expertise_areas)}",
        f"[bold]Achievements:[/] {', '.join(ctx.recent_achievements)}",
        f"[bold]Opinions:[/] {', '.join(ctx.opinions)}",
        f"[bold]Audience:[/] {ctx.target_audience}",
        f"[bold]Tone:[/] {ctx.tone_preference}",
    ]
    console.print(Panel("\n".join(lines), title="Your Profile", border_style="green"))
