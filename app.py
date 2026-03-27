"""Streamlit web UI for the LinkedIn AI Content Pipeline."""

import json
import os
import sys
from dataclasses import asdict
from pathlib import Path

import streamlit as st
from dotenv import load_dotenv

# Ensure src/ is importable when running via `streamlit run app.py`
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

load_dotenv()

from linkedin_scraper.analyzer import filter_top_posts, get_engagement_summary
from linkedin_scraper.ai_analyzer import analyze_post_patterns
from linkedin_scraper.generator import generate_posts, save_generated_posts
from linkedin_scraper.models import UserContext
from linkedin_scraper.questionnaire import (
    QUESTIONS,
    build_user_context,
    load_user_context,
    save_user_context,
)
from linkedin_scraper.scraper import load_posts, save_posts, scrape_linkedin_posts

# ---------------------------------------------------------------------------
# App config
# ---------------------------------------------------------------------------
st.set_page_config(page_title="Splash - LinkedIn AI Content", page_icon="S", layout="wide")

PROFILES_PATH = "config/profiles.json"
POSTS_PATH = "output/scraped_posts.json"
PATTERNS_PATH = "output/patterns.json"
USER_CTX_PATH = "output/user_context.json"
GENERATED_PATH = "output/generated_posts.md"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _check_env_var(name: str, label: str) -> bool:
    val = os.environ.get(name, "")
    if not val:
        st.error(f"{label} not set. Add `{name}` to your `.env` file.")
        return False
    return True


def _load_profiles() -> dict:
    p = Path(PROFILES_PATH)
    if not p.exists():
        return {"profiles": [], "scrape_settings": {"posts_per_profile": 20}}
    with open(p) as f:
        return json.load(f)


def _save_profiles(data: dict):
    Path(PROFILES_PATH).parent.mkdir(parents=True, exist_ok=True)
    with open(PROFILES_PATH, "w") as f:
        json.dump(data, f, indent=2)


def _load_cached_patterns() -> dict | None:
    p = Path(PATTERNS_PATH)
    if not p.exists():
        return None
    with open(p) as f:
        return json.load(f)


def _save_patterns(patterns: dict):
    Path(PATTERNS_PATH).parent.mkdir(parents=True, exist_ok=True)
    with open(PATTERNS_PATH, "w") as f:
        json.dump(patterns, f, indent=2)


# ---------------------------------------------------------------------------
# Restore session state from disk on first load
# ---------------------------------------------------------------------------
if "initialized" not in st.session_state:
    st.session_state.initialized = True
    # Posts
    if Path(POSTS_PATH).exists():
        try:
            st.session_state.posts = load_posts(POSTS_PATH)
        except Exception:
            st.session_state.posts = []
    else:
        st.session_state.posts = []
    # Patterns
    st.session_state.patterns = _load_cached_patterns() or {}
    # User context
    cached_ctx = load_user_context(USER_CTX_PATH)
    if cached_ctx:
        st.session_state.user_context = cached_ctx
    # Generated posts
    st.session_state.setdefault("generated", [])


# ---------------------------------------------------------------------------
# Sidebar navigation
# ---------------------------------------------------------------------------
st.sidebar.title("Splash")
st.sidebar.caption("LinkedIn AI Content Pipeline")
page = st.sidebar.radio(
    "Navigate",
    ["1 - Configure Profiles", "2 - Scrape & Analyze", "3 - About You", "4 - Generate Posts"],
)

# Show status indicators in sidebar
st.sidebar.markdown("---")
st.sidebar.markdown("**Pipeline status**")
n_posts = len(st.session_state.get("posts", []))
has_patterns = bool(st.session_state.get("patterns"))
has_profile = "user_context" in st.session_state
n_generated = len(st.session_state.get("generated", []))
st.sidebar.markdown(f"{'OK' if n_posts else '--'} Scraped posts: **{n_posts}**")
st.sidebar.markdown(f"{'OK' if has_patterns else '--'} Patterns analyzed: **{'Yes' if has_patterns else 'No'}**")
st.sidebar.markdown(f"{'OK' if has_profile else '--'} Your profile: **{'Saved' if has_profile else 'Not set'}**")
st.sidebar.markdown(f"{'OK' if n_generated else '--'} Generated posts: **{n_generated}**")


# ===================================================================
# PAGE 1: Configure Profiles
# ===================================================================
if page == "1 - Configure Profiles":
    st.header("Configure LinkedIn Profiles")
    st.write("Add the LinkedIn top voices you want to study. We'll scrape their recent posts and analyze what makes them perform.")

    config = _load_profiles()
    profiles = config.get("profiles", [])
    settings = config.get("scrape_settings", {"posts_per_profile": 20})

    st.subheader("Profiles")

    # Editable profile list
    updated_profiles = []
    for i, prof in enumerate(profiles):
        cols = st.columns([3, 5, 2, 1])
        name = cols[0].text_input("Name", value=prof.get("name", ""), key=f"pname_{i}")
        url = cols[1].text_input("LinkedIn URL", value=prof.get("linkedin_url", ""), key=f"purl_{i}")
        cat = cols[2].text_input("Category", value=prof.get("category", ""), key=f"pcat_{i}")
        remove = cols[3].button("X", key=f"premove_{i}")
        if not remove:
            updated_profiles.append({"name": name, "linkedin_url": url, "category": cat})

    # Add new profile
    st.markdown("---")
    st.subheader("Add a profile")
    add_cols = st.columns([3, 5, 2, 1])
    new_name = add_cols[0].text_input("Name", value="", key="new_name")
    new_url = add_cols[1].text_input("LinkedIn URL", value="", key="new_url", placeholder="https://www.linkedin.com/in/...")
    new_cat = add_cols[2].text_input("Category", value="", key="new_cat")
    if add_cols[3].button("Add"):
        if new_url:
            updated_profiles.append({"name": new_name, "linkedin_url": new_url, "category": new_cat})
            st.rerun()

    st.markdown("---")
    posts_per_profile = st.slider("Posts to scrape per profile", min_value=5, max_value=50, value=settings.get("posts_per_profile", 20))

    if st.button("Save Configuration", type="primary"):
        new_config = {
            "profiles": updated_profiles,
            "scrape_settings": {"posts_per_profile": posts_per_profile},
        }
        _save_profiles(new_config)
        st.success(f"Saved {len(updated_profiles)} profiles.")


# ===================================================================
# PAGE 2: Scrape & Analyze
# ===================================================================
elif page == "2 - Scrape & Analyze":
    st.header("Scrape & Analyze Top Posts")

    config = _load_profiles()
    profiles = config.get("profiles", [])
    settings = config.get("scrape_settings", {})

    if not profiles:
        st.warning("No profiles configured. Go to **Configure Profiles** first.")
        st.stop()

    st.write(f"**{len(profiles)} profile(s)** configured: {', '.join(p['name'] or p['linkedin_url'] for p in profiles)}")

    # --- SCRAPE ---
    st.subheader("Step 1: Scrape Posts")

    if st.session_state.posts:
        st.info(f"Loaded {len(st.session_state.posts)} cached posts. Click below to re-scrape.")

    if st.button("Scrape LinkedIn Posts", type="primary"):
        if not _check_env_var("APIFY_API_TOKEN", "Apify API token"):
            st.stop()
        urls = [p["linkedin_url"] for p in profiles]
        with st.spinner(f"Scraping posts from {len(urls)} profile(s) via Apify... this may take 1-2 minutes."):
            try:
                posts = scrape_linkedin_posts(urls, posts_per_profile=settings.get("posts_per_profile", 20))
                save_posts(posts, POSTS_PATH)
                st.session_state.posts = posts
                st.success(f"Scraped **{len(posts)}** posts!")
            except Exception as e:
                st.error(f"Scraping failed: {e}")
                st.stop()

    # --- DISPLAY POSTS ---
    posts = st.session_state.posts
    if posts:
        summary = get_engagement_summary(posts)
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Total Posts", summary["total"])
        col2.metric("Avg Likes", f"{summary['avg_likes']:.0f}")
        col3.metric("Avg Comments", f"{summary['avg_comments']:.0f}")
        col4.metric("Avg Shares", f"{summary['avg_shares']:.0f}")

        # --- FILTER TOP POSTS ---
        st.subheader("Step 2: Select Top Posts")
        top_n = st.slider("Number of top posts to analyze", min_value=1, max_value=min(20, len(posts)), value=min(5, len(posts)))

        top_posts = filter_top_posts(posts, top_n=top_n, min_likes=0)

        st.write(f"**Top {len(top_posts)} posts by engagement:**")
        for i, post in enumerate(top_posts, 1):
            with st.expander(f"#{i} - {post.author_name} ({post.likes} likes, {post.comments} comments, {post.shares} shares) - Score: {post.engagement_score:.0f}"):
                st.text(post.text)
                if post.post_url:
                    st.caption(f"[View on LinkedIn]({post.post_url})")

        # --- ANALYZE ---
        st.subheader("Step 3: AI Pattern Analysis")
        if st.session_state.patterns:
            st.info("Patterns already analyzed. Click below to re-analyze.")

        if st.button("Analyze Patterns with Claude", type="primary"):
            if not _check_env_var("ANTHROPIC_API_KEY", "Anthropic API key"):
                st.stop()
            with st.spinner("Claude is analyzing post patterns..."):
                try:
                    patterns = analyze_post_patterns(top_posts)
                    _save_patterns(patterns)
                    st.session_state.patterns = patterns
                    st.success("Analysis complete!")
                except Exception as e:
                    st.error(f"Analysis failed: {e}")
                    st.stop()

        # --- DISPLAY PATTERNS ---
        patterns = st.session_state.patterns
        if patterns:
            st.markdown("---")
            st.subheader("Extracted Patterns")

            if "common_hooks" in patterns:
                with st.expander("Hook Types", expanded=True):
                    for hook in patterns["common_hooks"]:
                        if isinstance(hook, dict):
                            st.markdown(f"- **{hook.get('type', '')}**: {hook.get('example', hook.get('description', ''))}")
                        else:
                            st.markdown(f"- {hook}")

            if "winning_structures" in patterns:
                with st.expander("Winning Structures"):
                    for item in patterns["winning_structures"]:
                        if isinstance(item, dict):
                            st.markdown(f"- **{item.get('name', item.get('type', ''))}**: {item.get('description', '')}")
                        else:
                            st.markdown(f"- {item}")

            if "engagement_drivers" in patterns:
                with st.expander("Engagement Drivers"):
                    for item in patterns["engagement_drivers"]:
                        if isinstance(item, dict):
                            st.markdown(f"- {item.get('description', item.get('driver', str(item)))}")
                        else:
                            st.markdown(f"- {item}")

            col_do, col_dont = st.columns(2)
            with col_do:
                if "dos" in patterns:
                    st.markdown("**Do's**")
                    for d in patterns["dos"]:
                        st.markdown(f"- {d}")
            with col_dont:
                if "donts" in patterns:
                    st.markdown("**Don'ts**")
                    for d in patterns["donts"]:
                        st.markdown(f"- {d}")

            if "ideal_post_blueprint" in patterns:
                with st.expander("Ideal Post Blueprint"):
                    bp = patterns["ideal_post_blueprint"]
                    if isinstance(bp, list):
                        for step in bp:
                            if isinstance(step, dict):
                                st.markdown(f"- **{step.get('step', '')}**: {step.get('description', '')}")
                            else:
                                st.markdown(f"- {step}")
                    elif isinstance(bp, dict):
                        for k, v in bp.items():
                            st.markdown(f"- **{k}**: {v}")
                    else:
                        st.write(bp)


# ===================================================================
# PAGE 3: About You (Interview)
# ===================================================================
elif page == "3 - About You":
    st.header("Tell Us About Yourself")
    st.write("Your answers help us generate posts that sound authentically like you.")

    # Pre-fill from cached context
    cached = st.session_state.get("user_context")
    defaults = {}
    if cached:
        defaults = {
            "name": cached.name,
            "role": cached.role,
            "industry": cached.industry,
            "expertise_areas": ", ".join(cached.expertise_areas),
            "recent_achievements": ", ".join(cached.recent_achievements),
            "opinions": ", ".join(cached.opinions),
            "target_audience": cached.target_audience,
            "tone_preference": cached.tone_preference,
        }

    with st.form("interview_form"):
        answers = {}
        for q in QUESTIONS:
            key = q["key"]
            help_text = q.get("help", "")
            default_val = defaults.get(key, q.get("default", ""))

            if key == "tone_preference":
                options = ["professional", "casual", "bold"]
                idx = options.index(default_val) if default_val in options else 0
                answers[key] = st.radio(q["question"], options, index=idx, help=help_text, horizontal=True)
            elif q.get("is_list"):
                answers[key] = st.text_area(q["question"], value=default_val, help=help_text, height=80)
            else:
                answers[key] = st.text_input(q["question"], value=default_val, help=help_text)

        submitted = st.form_submit_button("Save Profile", type="primary")

    if submitted:
        ctx = build_user_context(answers)
        save_user_context(ctx, USER_CTX_PATH)
        st.session_state.user_context = ctx
        st.success("Profile saved!")

        # Show summary
        st.markdown("---")
        st.subheader("Your Profile")
        col1, col2 = st.columns(2)
        col1.markdown(f"**Name:** {ctx.name}")
        col1.markdown(f"**Role:** {ctx.role}")
        col1.markdown(f"**Industry:** {ctx.industry}")
        col1.markdown(f"**Tone:** {ctx.tone_preference}")
        col2.markdown(f"**Expertise:** {', '.join(ctx.expertise_areas)}")
        col2.markdown(f"**Achievements:** {', '.join(ctx.recent_achievements)}")
        col2.markdown(f"**Opinions:** {', '.join(ctx.opinions)}")
        col2.markdown(f"**Audience:** {ctx.target_audience}")


# ===================================================================
# PAGE 4: Generate Posts
# ===================================================================
elif page == "4 - Generate Posts":
    st.header("Generate LinkedIn Posts")

    # Check preconditions
    posts = st.session_state.get("posts", [])
    patterns = st.session_state.get("patterns", {})
    user_ctx = st.session_state.get("user_context")

    ready = True
    if not posts:
        st.warning("No scraped posts. Complete **Step 2 - Scrape & Analyze** first.")
        ready = False
    if not patterns:
        st.warning("No pattern analysis. Run **AI Pattern Analysis** in Step 2 first.")
        ready = False
    if not user_ctx:
        st.warning("No user profile. Fill in **Step 3 - About You** first.")
        ready = False

    if not ready:
        st.stop()

    st.success("All prerequisites met. Ready to generate!")

    num_posts = st.slider("Number of posts to generate", min_value=1, max_value=10, value=3)
    top_n = st.slider("Top posts to use as inspiration", min_value=1, max_value=min(10, len(posts)), value=min(5, len(posts)))

    if st.button("Generate Posts", type="primary"):
        if not _check_env_var("ANTHROPIC_API_KEY", "Anthropic API key"):
            st.stop()

        top_posts = filter_top_posts(posts, top_n=top_n, min_likes=0)

        with st.spinner("Claude is crafting your LinkedIn posts..."):
            try:
                generated = generate_posts(user_ctx, patterns, top_posts, num_posts=num_posts)
                save_generated_posts(generated, GENERATED_PATH)
                st.session_state.generated = generated
                st.success(f"Generated **{len(generated)}** posts!")
            except Exception as e:
                st.error(f"Generation failed: {e}")
                st.stop()

    # Display generated posts
    generated = st.session_state.get("generated", [])
    if generated:
        st.markdown("---")
        for i, post in enumerate(generated, 1):
            st.subheader(f"Post {i}")

            # Metadata row
            cols = st.columns(4)
            cols[0].caption(f"Hook: **{post.hook_type}**")
            cols[1].caption(f"Pattern: **{post.pattern_used}**")
            cols[2].caption(f"Inspired by: **{post.inspired_by}**")
            cols[3].caption(f"Engagement: **{post.estimated_engagement}**")

            # Editable post content
            st.text_area(
                "Post content (edit and copy)",
                value=post.content,
                height=250,
                key=f"post_content_{i}",
            )

            if post.tips:
                with st.expander("Posting tips"):
                    for tip in post.tips:
                        st.markdown(f"- {tip}")

            st.markdown("---")

        st.info(f"Posts also saved to `{GENERATED_PATH}`")
