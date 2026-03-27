# LinkedIn AI Content Pipeline

Automated system that scrapes top LinkedIn voices, analyzes what makes their posts successful, and generates personalized posts for your profile.

## How It Works

1. **Scrape** - Fetches recent posts from LinkedIn top voices via [Apify](https://apify.com)
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

# Add LinkedIn profiles to scrape
# Edit config/profiles.json with your target top voices
```

## Usage

### Full Pipeline (recommended)
```bash
linkedin-ai run
```

### Step by Step
```bash
# 1. Scrape posts from configured profiles
linkedin-ai scrape

# 2. Analyze top posts with AI
linkedin-ai analyze

# 3. Generate personalized posts (includes Q&A)
linkedin-ai generate --num-posts 5
```

### Weekly Schedule
```bash
# Run automatically every Monday at 9am
linkedin-ai schedule --day monday --time 09:00
```

## Configuration

Edit `config/profiles.json` to set:
- **profiles**: LinkedIn profile URLs of top voices to track
- **scrape_settings**: posts per profile, minimum likes threshold, lookback period

## Output

Generated posts are saved to `output/generated_posts.md` - review, tweak, and publish!
