<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

> Warning
> This directory is a legacy/simple C app and is not the default source for the local stack on port `3003`.
> If you need to change the running C app, edit `/Users/wenshuping/Documents/new_insurance2/insurance_code/insurance_code_full`.
> Source-of-truth workspace map: `/Users/wenshuping/Documents/new_insurance2/WORKSPACE_ACTIVE_APPS.md`

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c4d46c6c-1217-4d90-b074-78399e3cf4cc

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Backend API (local)

This repo now includes a local Express + SQLite API:

1. Copy env template:
   `cp .env.example .env.local`
2. Start API server:
   `npm run dev:api`
3. API health check:
   `http://localhost:4000/api/health`

Core endpoints implemented:

- `POST /api/auth/send-code`
- `POST /api/auth/verify-basic`
- `GET /api/me`
- `GET /api/activities`
- `POST /api/sign-in`
- `GET /api/points/summary`
- `GET /api/points/transactions`
- `GET /api/mall/items`
- `POST /api/mall/redeem`
- `GET /api/redemptions`
- `POST /api/redemptions/:id/writeoff`
