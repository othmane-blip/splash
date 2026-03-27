# Splash - LinkedIn AI Content Pipeline

Automated system that scrapes top LinkedIn voices, analyzes what makes their posts successful, and generates personalized posts for your profile.

## How It Works

1. **Scrape** - Fetches recent posts from LinkedIn top voices via [Apify](https://apify.com) (no cookies needed)
2. **Analyze** - Ranks posts by engagement and uses Claude AI to extract winning patterns (hooks, structure, CTAs, formatting)
3. **Personalize** - Asks you about your role, expertise, achievements, and opinions
4. **Generate** - Creates ready-to-post LinkedIn content that matches proven patterns but sounds like you

## Setup

```bash
# Install
pip install -e .

# Configure API keys
cp .env.example .env
# Edit .env with your APIFY_API_TOKEN and ANTHROPIC_API_KEY
```

## Web UI (recommended)

```bash
streamlit run app.py
```

Opens a browser with 4 tabs:
1. **Configure Profiles** - Add/remove LinkedIn top voices to track
2. **Scrape & Analyze** - Fetch posts, view engagement stats, run AI analysis
3. **About You** - Fill in your professional context (role, expertise, opinions)
4. **Generate Posts** - Create personalized LinkedIn posts ready to copy-paste

## CLI Usage

### Full Pipeline
```bash
linkedin-ai run
```

### Step by Step
```bash
linkedin-ai scrape
linkedin-ai analyze
linkedin-ai generate --num-posts 5
```

### Weekly Schedule
```bash
linkedin-ai schedule --day monday --time 09:00
```

## Configuration

Edit `config/profiles.json` or use the web UI to set:
- **profiles**: LinkedIn profile URLs of top voices to track
- **scrape_settings**: posts per profile

## API Keys

- **APIFY_API_TOKEN**: Get from [Apify Console](https://console.apify.com/account/integrations) - used for LinkedIn scraping
- **ANTHROPIC_API_KEY**: Get from [Anthropic Console](https://console.anthropic.com/) - used for AI analysis and generation

## Output

Generated posts are saved to `output/generated_posts.md` - review, tweak, and publish!
