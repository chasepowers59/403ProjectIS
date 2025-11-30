# Deployment Guide

This guide outlines the steps to deploy the Slack Event Dashboard application to a production environment. We recommend **Render** for its ease of use and free tier availability, but these instructions apply generally to any Node.js hosting provider (Heroku, Railway, AWS, etc.).

## Prerequisites

1.  **GitHub Account**: Your code must be pushed to a GitHub repository.
2.  **Render Account**: Sign up at [render.com](https://render.com).
3.  **OpenAI API Key**: Required for the AI event extraction features.

## 1. Database Setup (PostgreSQL)

You need a hosted PostgreSQL database. Render provides this easily.

1.  Log in to your Render Dashboard.
2.  Click **New +** and select **PostgreSQL**.
3.  **Name**: `slack-events-db` (or any name).
4.  **Region**: Choose the one closest to you (e.g., Ohio, Oregon, Frankfurt).
5.  **Instance Type**: Select **Free** (for hobby projects) or a paid plan.
6.  Click **Create Database**.
7.  Once created, copy the **Internal Connection String** (if deploying the app on Render) or **External Connection String** (if connecting from your local machine).
    *   *Note: You will need the individual connection details (Host, Port, User, Password, Database Name) for the environment variables.*

## 2. Application Deployment

1.  Go to your Render Dashboard.
2.  Click **New +** and select **Web Service**.
3.  Connect your GitHub repository.
4.  **Name**: `slack-events-app` (or any name).
5.  **Region**: Same as your database.
6.  **Branch**: `main` (or your working branch).
7.  **Runtime**: `Node`
8.  **Build Command**: `npm install`
9.  **Start Command**: `npm start`
10. **Instance Type**: **Free**

## 3. Environment Variables

Scroll down to the **Environment Variables** section and add the following keys. You can get these values from your Render Database details page.

| Key | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Tells the app to run in production mode. |
| `DB_HOST` | *Your DB Host* | e.g., `dpg-xxxx-a.oregon-postgres.render.com` |
| `DB_PORT` | `5432` | Standard PostgreSQL port. |
| `DB_NAME` | *Your DB Name* | e.g., `slack_events_db` |
| `DB_USER` | *Your DB User* | e.g., `slack_user` |
| `DB_PASSWORD` | *Your DB Password* | The long password string. |
| `OPENAI_API_KEY` | *sk-...* | Your OpenAI API Key. |
| `SESSION_SECRET` | *random_string* | A long random string for securing sessions. |
| `SLACKDUMP_CMD` | `./tools/linux/slackdump` | **CRITICAL for Sync**: See note below. |

> **IMPORTANT: The Sync Feature & Linux**
> The "Sync" button uses `slackdump`, which is a command-line tool. The version in your project is likely for Windows (`slackdump.exe`).
>
> *   **If deploying to Linux (Render/Heroku):** You must download the **Linux** version of `slackdump` from its repository, place it in your project (e.g., `tools/linux/slackdump`), commit it, and set `SLACKDUMP_CMD` to point to it.
> *   **If you skip this:** The "Sync" button will fail on the live site. You can still use the app to view and manage events, but you won't be able to pull new data from Slack directly on the server.

## 4. Database Migration

After your app is deployed, the database will be empty. You need to create the tables.

**Option A: Run locally (Easiest)**
1.  On your local machine, create a `.env.production` file with your **External** database connection details.
2.  Run the migration command pointing to production:
    ```bash
    # Windows PowerShell
    $env:NODE_ENV="production"; npx knex migrate:latest
    ```

**Option B: Run as a Build Script**
1.  Update your **Build Command** in Render to:
    ```bash
    npm install && npx knex migrate:latest
    ```
    *Note: This requires the app to have DB access during the build phase, which might require additional configuration on some platforms.*

## 5. Verify Deployment

1.  Wait for the build to finish.
2.  Click the URL provided by Render (e.g., `https://slack-events-app.onrender.com`).
3.  Log in and verify the Dashboard and Calendar load correctly.

## 6. Admin User Setup

To log in, you need an admin user. We have included a script to create one.

**Option A: Run via Render Shell (Recommended)**
1.  In your Render Dashboard, go to your **Web Service**.
2.  Click the **Shell** tab.
3.  Run: `npm run seed`
4.  This will create the user:
    *   **Email**: `admin@example.com`
    *   **Password**: `password`

**Option B: Run locally against Production DB**
1.  Ensure your `.env.production` has the external DB connection string.
2.  Run:
    ```bash
    $env:NODE_ENV="production"; npm run seed
    ```

