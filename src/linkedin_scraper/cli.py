"""CLI orchestrator for the LinkedIn content pipeline."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

from .analyzer import filter_top_posts, get_engagement_summary
from .ai_analyzer import analyze_post_patterns
from .generator import generate_posts, save_generated_posts
from .questionnaire import gather_user_context
from .scraper import load_profiles, scrape_linkedin_posts, save_posts, load_posts

console = Console()


def main():
    """Main entry point for the CLI."""
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="LinkedIn AI Content Pipeline - Scrape, analyze, and generate LinkedIn posts"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # scrape command
    scrape_parser = subparsers.add_parser("scrape", help="Scrape LinkedIn posts from top voices")
    scrape_parser.add_argument(
        "--config", default="config/profiles.json", help="Path to profiles config"
    )
    scrape_parser.add_argument(
        "--output", default="output/scraped_posts.json", help="Output path for scraped posts"
    )

    # analyze command
    analyze_parser = subparsers.add_parser("analyze", help="Analyze top posts with AI")
    analyze_parser.add_argument(
        "--input", default="output/scraped_posts.json", help="Path to scraped posts"
    )
    analyze_parser.add_argument("--top-n", type=int, default=5, help="Number of top posts to analyze")
    analyze_parser.add_argument("--min-likes", type=int, default=0, help="Minimum likes threshold (0 = no filter)")

    # generate command
    gen_parser = subparsers.add_parser("generate", help="Generate personalized LinkedIn posts")
    gen_parser.add_argument(
        "--input", default="output/scraped_posts.json", help="Path to scraped posts"
    )
    gen_parser.add_argument(
        "--output", default="output/generated_posts.md", help="Output path for generated posts"
    )
    gen_parser.add_argument("--num-posts", type=int, default=3, help="Number of posts to generate")
    gen_parser.add_argument("--top-n", type=int, default=5, help="Number of top posts to analyze")
    gen_parser.add_argument("--min-likes", type=int, default=0, help="Minimum likes threshold (0 = no filter)")

    # run command (full pipeline)
    run_parser = subparsers.add_parser("run", help="Run the full pipeline (scrape + analyze + generate)")
    run_parser.add_argument(
        "--config", default="config/profiles.json", help="Path to profiles config"
    )
    run_parser.add_argument("--num-posts", type=int, default=3, help="Number of posts to generate")
    run_parser.add_argument("--top-n", type=int, default=5, help="Top posts to analyze")
    run_parser.add_argument("--min-likes", type=int, default=0, help="Minimum likes threshold (0 = no filter)")

    # schedule command
    schedule_parser = subparsers.add_parser("schedule", help="Run the pipeline on a weekly schedule")
    schedule_parser.add_argument(
        "--day", default="monday", help="Day of the week to run (default: monday)"
    )
    schedule_parser.add_argument(
        "--time", default="09:00", help="Time to run in HH:MM format (default: 09:00)"
    )
    schedule_parser.add_argument(
        "--config", default="config/profiles.json", help="Path to profiles config"
    )

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    try:
        if args.command == "scrape":
            cmd_scrape(args)
        elif args.command == "analyze":
            cmd_analyze(args)
        elif args.command == "generate":
            cmd_generate(args)
        elif args.command == "run":
            cmd_run(args)
        elif args.command == "schedule":
            cmd_schedule(args)
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted.[/yellow]")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[red]Error: {e}[/red]")
        sys.exit(1)


def cmd_scrape(args):
    """Scrape LinkedIn posts from configured profiles."""
    console.print(Panel("[bold]Step 1: Scraping LinkedIn Posts[/bold]", border_style="blue"))

    config = load_profiles(args.config)
    profile_urls = [p["linkedin_url"] for p in config["profiles"]]
    settings = config.get("scrape_settings", {})

    console.print(f"  Scraping {len(profile_urls)} profiles...")
    posts = scrape_linkedin_posts(
        profile_urls,
        posts_per_profile=settings.get("posts_per_profile", 20),
    )

    save_posts(posts, args.output)
    summary = get_engagement_summary(posts)
    console.print(f"  [green]Done! {summary['total']} posts scraped.[/green]")


def cmd_analyze(args):
    """Analyze scraped posts with AI."""
    console.print(Panel("[bold]Step 2: Analyzing Top Posts with AI[/bold]", border_style="magenta"))

    posts = load_posts(args.input)
    top_posts = filter_top_posts(posts, top_n=args.top_n, min_likes=args.min_likes)

    if not top_posts:
        console.print("[yellow]No posts meet the criteria. Try lowering --min-likes.[/yellow]")
        return

    summary = get_engagement_summary(top_posts)
    console.print(f"  Analyzing {len(top_posts)} top posts (avg {summary['avg_likes']:.0f} likes)...")

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
        task = progress.add_task("Running AI analysis...", total=None)
        patterns = analyze_post_patterns(top_posts)

    output_path = "output/patterns.json"
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(patterns, f, indent=2)

    console.print(f"  [green]Analysis saved to {output_path}[/green]")
    _display_patterns(patterns)


def cmd_generate(args):
    """Generate personalized LinkedIn posts."""
    console.print(Panel("[bold]Step 3: Generating Your Posts[/bold]", border_style="green"))

    # Load posts and analyze
    posts = load_posts(args.input)
    top_posts = filter_top_posts(posts, top_n=args.top_n, min_likes=args.min_likes)

    if not top_posts:
        console.print("[yellow]No top posts found. Run 'scrape' first.[/yellow]")
        return

    # Check for cached patterns
    patterns_path = Path("output/patterns.json")
    if patterns_path.exists():
        with open(patterns_path) as f:
            patterns = json.load(f)
        console.print("  Using cached pattern analysis.")
    else:
        console.print("  Running AI analysis on top posts...")
        patterns = analyze_post_patterns(top_posts)

    # Gather user context via Q&A
    user_context = gather_user_context()

    # Generate posts
    console.print("\n  Generating posts with AI...")
    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
        task = progress.add_task("Crafting your LinkedIn posts...", total=None)
        generated = generate_posts(user_context, patterns, top_posts, num_posts=args.num_posts)

    save_generated_posts(generated, args.output)
    _display_generated_posts(generated)


def cmd_run(args):
    """Run the full pipeline."""
    console.print(
        Panel(
            "[bold cyan]LinkedIn AI Content Pipeline[/bold cyan]\n\n"
            "This will:\n"
            "1. Scrape posts from your configured LinkedIn top voices\n"
            "2. Identify and analyze top-performing posts with AI\n"
            "3. Ask you about your professional context\n"
            "4. Generate personalized LinkedIn posts for you",
            border_style="cyan",
        )
    )

    # Step 1: Scrape
    console.print(Panel("[bold]Step 1/4: Scraping LinkedIn Posts[/bold]", border_style="blue"))
    config = load_profiles(args.config)
    profile_urls = [p["linkedin_url"] for p in config["profiles"]]
    settings = config.get("scrape_settings", {})

    posts = scrape_linkedin_posts(
        profile_urls,
        posts_per_profile=settings.get("posts_per_profile", 20),
    )
    save_posts(posts)

    # Step 2: Filter & Analyze
    console.print(Panel("[bold]Step 2/4: Analyzing Top Posts[/bold]", border_style="magenta"))
    top_posts = filter_top_posts(posts, top_n=args.top_n, min_likes=args.min_likes)

    if not top_posts:
        console.print("[yellow]No posts meet the engagement criteria. Try lowering --min-likes.[/yellow]")
        return

    summary = get_engagement_summary(top_posts)
    console.print(f"  Found {len(top_posts)} top posts (avg {summary['avg_likes']:.0f} likes)")

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
        task = progress.add_task("Running AI pattern analysis...", total=None)
        patterns = analyze_post_patterns(top_posts)

    _display_patterns(patterns)

    # Step 3: Q&A
    console.print(Panel("[bold]Step 3/4: Your Professional Context[/bold]", border_style="yellow"))
    user_context = gather_user_context()

    # Step 4: Generate
    console.print(Panel("[bold]Step 4/4: Generating Your Posts[/bold]", border_style="green"))
    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
        task = progress.add_task("Crafting your LinkedIn posts...", total=None)
        generated = generate_posts(user_context, patterns, top_posts, num_posts=args.num_posts)

    save_generated_posts(generated)
    _display_generated_posts(generated)

    console.print(
        Panel(
            "[bold green]All done![/bold green]\n\n"
            "Your posts are saved to output/generated_posts.md\n"
            "Review, tweak, and post them to LinkedIn!",
            border_style="green",
        )
    )


def cmd_schedule(args):
    """Run the pipeline on a weekly schedule."""
    import schedule
    import time

    console.print(
        Panel(
            f"[bold]Weekly Schedule[/bold]\n\n"
            f"Running every [cyan]{args.day}[/cyan] at [cyan]{args.time}[/cyan]\n"
            f"Press Ctrl+C to stop.",
            border_style="blue",
        )
    )

    def weekly_job():
        console.print(f"\n[bold blue]Starting scheduled run...[/bold blue]")

        class Args:
            config = args.config
            num_posts = 3
            top_n = 5
            min_likes = 0

        # In scheduled mode, we scrape and analyze but skip Q&A
        # (uses cached user context or env-based defaults)
        try:
            config = load_profiles(Args.config)
            profile_urls = [p["linkedin_url"] for p in config["profiles"]]
            settings = config.get("scrape_settings", {})

            posts = scrape_linkedin_posts(
                profile_urls,
                posts_per_profile=settings.get("posts_per_profile", 20),
            )
            save_posts(posts)

            top_posts = filter_top_posts(posts, top_n=Args.top_n, min_likes=Args.min_likes)
            if not top_posts:
                console.print("[yellow]No qualifying posts found this week.[/yellow]")
                return

            patterns = analyze_post_patterns(top_posts)

            # Load cached user context
            ctx_path = Path("output/user_context.json")
            if ctx_path.exists():
                with open(ctx_path) as f:
                    ctx_data = json.load(f)
                from .models import UserContext

                user_context = UserContext(**ctx_data)
            else:
                console.print("[yellow]No cached user context. Run 'generate' first to set up your profile.[/yellow]")
                return

            generated = generate_posts(user_context, patterns, top_posts, num_posts=Args.num_posts)
            save_generated_posts(generated)
            console.print(f"[green]Generated {len(generated)} posts![/green]")

        except Exception as e:
            console.print(f"[red]Scheduled run failed: {e}[/red]")

    # Schedule the job
    day_map = {
        "monday": schedule.every().monday,
        "tuesday": schedule.every().tuesday,
        "wednesday": schedule.every().wednesday,
        "thursday": schedule.every().thursday,
        "friday": schedule.every().friday,
        "saturday": schedule.every().saturday,
        "sunday": schedule.every().sunday,
    }

    scheduler = day_map.get(args.day.lower())
    if not scheduler:
        console.print(f"[red]Invalid day: {args.day}[/red]")
        return

    scheduler.at(args.time).do(weekly_job)

    console.print(f"  Next run: {schedule.next_run()}")
    while True:
        schedule.run_pending()
        time.sleep(60)


def _display_patterns(patterns: dict):
    """Display extracted patterns nicely."""
    if not patterns:
        return

    lines = []
    if "common_hooks" in patterns:
        lines.append("[bold]Top Hook Types:[/bold]")
        for hook in patterns["common_hooks"][:5]:
            if isinstance(hook, dict):
                lines.append(f"  - {hook.get('type', hook)}: {hook.get('example', '')}")
            else:
                lines.append(f"  - {hook}")

    if "dos" in patterns:
        lines.append("\n[bold green]Do's:[/bold green]")
        for do in patterns["dos"][:5]:
            lines.append(f"  [green]+[/green] {do}")

    if "donts" in patterns:
        lines.append("\n[bold red]Don'ts:[/bold red]")
        for dont in patterns["donts"][:5]:
            lines.append(f"  [red]-[/red] {dont}")

    if lines:
        console.print(Panel("\n".join(lines), title="Pattern Analysis", border_style="magenta"))


def _display_generated_posts(posts: list):
    """Display generated posts in the terminal."""
    for i, post in enumerate(posts, 1):
        console.print(
            Panel(
                f"{post.content}\n\n"
                f"[dim]Hook: {post.hook_type} | Pattern: {post.pattern_used} | "
                f"Expected engagement: {post.estimated_engagement}[/dim]",
                title=f"Post {i}",
                border_style="green",
            )
        )
        if post.tips:
            for tip in post.tips:
                console.print(f"  [dim]Tip: {tip}[/dim]")
        console.print()


if __name__ == "__main__":
    main()
