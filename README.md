# GemRadar: Resurrection 🪦 💎

**Submission for the Solana Graveyard Hackathon (Audius Track)**

GemRadar: Resurrection is an AI-powered discovery engine built to resurrect "dead" or undiscovered tracks from the @Audius protocol. While mainstream algorithms favor the top 1%, our engine specifically crawls the long-tail "graveyard" of low-play tracks to find high-engagement gems before they break out.

🔗 **Hackathon Demo:** [https://gemradar-resurrection.vercel.app](https://gemradar-resurrection.vercel.app)

## 🪦 The Problem: The Content Graveyard
Thousands of tracks are uploaded to Audius every day. Without a massive marketing budget, most of these tracks end up in the "graveyard"—zero plays, zero visibility—regardless of quality. 

## ⚡️ The Solution: Resurrection
GemRadar uses a custom weighted algorithm to identify tracks with high organic engagement relative to their play count. We "resurrect" these artists by bringing them to our immersive, high-conversion discovery dashboard.

## 🚀 Solana + Audius Integration

### 1. Artist Coin Detection
GemRadar automatically detects if an artist has an active **Artist Coin** on Solana. High-scoring gems from artists with tokens are prioritized and given a "SOL COIN" badge, making it seamless for fans to support rising talent on-chain.

### 2. On-Chain Curation (The Scout Score)
Our **Scout Score** system tracks the performance of your "picks" over time. 
*   When you "Resurrect" a track, we timestamp its current plays.
*   We award points as that track gains traction.
*   **Pivot Idea:** This score can be minted as a compressed NFT (cNFT) on Solana to prove your "Alpha" as a music curator.

## 🛠 Features

*   **Resurrection Feed**: A real-time analysis of the latest Audius uploads filtered through our Gem Score algorithm.
*   **Daily Discovery Reroll**: A randomized daily mix of high-percentile undiscovered hits.
*   **Glassmorphism UI**: A Cyberpunk/Graveyard aesthetic built with translucent panels and neon accents.
*   **Automated Auto-Scout**: A background service that ensures the database is always fresh with the latest "undiscovered" content.

## 🧠 The Resurrection Algorithm (Gem Score)

Tracks are scored (0-100) using:
*   **Freshness (40%)**: Rewards tracks uploaded in the last 24-48 hours.
*   **Organic Engagement (40%)**: Ratio of favorites/reposts to plays.
*   **Underdog Signal (20%)**: Inverse log-scale boost favoring artists with smaller follower counts.

---

Built with Node.js, ES6+, and the Audius SDK.
Submitted by S (@Snrbeats)
