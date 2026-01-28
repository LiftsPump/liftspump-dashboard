<div align="center">

# LiftsPump Dashboard

### A Modern SaaS Platform for Fitness Coaches

[![Next.js](https://img.shields.io/badge/Next.js-15.4-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?style=for-the-badge&logo=stripe)](https://stripe.com/)

**A full-stack B2B SaaS application enabling fitness trainers to manage clients, monetize coaching services, and deliver AI-powered personalized training experiences.**

[Features](#features) • [Tech Stack](#tech-stack) • [Architecture](#architecture) • [Getting Started](#getting-started) • [API Reference](#api-reference)

</div>

---

## Overview

LiftsPump Dashboard is a production-ready SaaS platform that demonstrates modern full-stack development practices. The application provides fitness coaches with tools to manage their business, from client subscriptions to AI-powered coaching sessions.

### Key Highlights

- **Full-Stack TypeScript** - End-to-end type safety with Next.js App Router
- **Real-Time Features** - WebRTC video sessions and live data sync
- **AI Integration** - Generative AI for personalized coaching personas
- **Payment Processing** - Complete Stripe integration with Connect for marketplace payments
- **Production Infrastructure** - Dockerized deployment on AWS ECS with CI/CD

---

## Features

### Dashboard & Analytics
- Real-time subscriber metrics and MRR tracking
- Interactive charts with ECharts for revenue visualization
- Activity feeds and client engagement insights
- Glass-morphism dark theme UI with Material-UI

### Subscription Management
- Custom tier creation with flexible pricing
- Stripe Checkout integration for seamless payments
- Stripe Connect for marketplace-style payouts to trainers
- Webhook-driven subscription lifecycle management
- Customer portal for self-service billing

### Client Management
- Assign workout routines to subscribers
- Track client progress (sets, reps, PRs, weight)
- Performance insights and achievement system
- Multi-tenant architecture with trainer isolation

### Real-Time Coaching Sessions
- LiveKit WebRTC integration for video/audio calls
- Calendar-based session scheduling with availability slots
- iCalendar export for external calendar sync
- AI agent dispatch for automated coaching

### MiniMe - AI Persona Builder
- Extract transcripts from YouTube fitness videos
- Generate coach personas using Google Gemini 2.5 Pro
- Text-to-speech with Cartesia for voice cloning
- Audio clip extraction with FFmpeg processing

### Exercise Library
- 300+ built-in exercises with images
- Custom exercise creation per trainer
- Categorized by muscle group and equipment
- Progressive overload tracking

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **Next.js 15** | React framework with App Router and Turbopack |
| **React 19** | UI library with concurrent features |
| **TypeScript 5** | Static typing and enhanced DX |
| **Material-UI 7** | Component library with custom theming |
| **Emotion** | CSS-in-JS styling solution |
| **ECharts** | Data visualization for analytics |

### Backend
| Technology | Purpose |
|------------|---------|
| **Next.js API Routes** | Serverless API endpoints |
| **Supabase** | PostgreSQL database + Auth + Storage + Realtime |
| **Stripe** | Payment processing and Connect marketplace |
| **Zod** | Runtime schema validation |

### AI & Media
| Technology | Purpose |
|------------|---------|
| **Google Gemini** | LLM for persona generation |
| **Cartesia** | Text-to-speech synthesis |
| **LiveKit** | WebRTC video/audio infrastructure |
| **FFmpeg** | Audio/video processing |
| **ytdl-core** | YouTube content extraction |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **Docker** | Multi-stage containerization |
| **AWS ECS** | Container orchestration |
| **AWS ECR** | Container registry |
| **GitHub Actions** | CI/CD pipeline |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Client (Browser)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   React +   │  │   MUI +     │  │   ECharts   │  │  LiveKit   │ │
│  │   Next.js   │  │   Emotion   │  │   Charts    │  │   Client   │ │
│  └──────┬──────┘  └─────────────┘  └─────────────┘  └──────┬─────┘ │
└─────────┼──────────────────────────────────────────────────┼───────┘
          │                                                  │
          ▼                                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Next.js App Router (API)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Auth      │  │  Payments   │  │   MiniMe    │  │  Sessions  │ │
│  │   Routes    │  │   Routes    │  │   Routes    │  │   Routes   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬─────┘ │
└─────────┼────────────────┼────────────────┼────────────────┼───────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐
│   Supabase   │  │    Stripe    │  │    Gemini    │  │   LiveKit   │
│  PostgreSQL  │  │   Payments   │  │      AI      │  │    Cloud    │
│  Auth + RLS  │  │   Connect    │  │   Cartesia   │  │    WebRTC   │
└──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘
```

### Database Schema

```sql
-- Core entities
profile        -- User profiles with trainer associations
trainer        -- Trainer business profiles and settings
routine        -- Workout routines with exercises
exercise       -- Individual exercises in routines
sets           -- Tracked sets with reps, weight, PRs

-- Subscriptions
tiers          -- Trainer-defined subscription tiers
stripe_customers    -- Stripe customer mappings
stripe_subscriptions -- Active subscriptions

-- Features
trainer_sessions   -- Scheduled coaching sessions
minime_personas    -- AI-generated coach personas
weight_entries     -- Client weight tracking
memories           -- Achievement and insight records
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account
- Stripe account
- Google Cloud account (for Gemini API)

### Environment Setup

Create a `.env.local` file:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...

# AI Services
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key

# LiveKit (optional)
LIVEKIT_API_KEY=your_livekit_key
LIVEKIT_API_SECRET=your_livekit_secret
```

### Installation

```bash
# Clone the repository
git clone https://github.com/LiftsPump/liftspump-dashboard.git
cd liftspump-dashboard

# Install dependencies
npm install

# Run development server with Turbopack
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests with Node test runner |

---

## API Reference

### Authentication
All protected endpoints require a valid Supabase session cookie.

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard/activity` | Fetch recent activity feed |
| `GET` | `/api/users/dashboard` | Get user workout data |
| `GET` | `/api/exercises/builtin` | List built-in exercises |
| `POST` | `/api/sessions` | Create coaching session |
| `GET` | `/api/sessions/eligible` | Get eligible session users |

### Subscription Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/checkout` | Initiate Stripe checkout |
| `POST` | `/api/stripe/webhook` | Handle Stripe webhooks |
| `GET` | `/api/stripe/portal` | Get customer portal URL |
| `GET/POST` | `/api/settings/tiers` | Manage subscription tiers |

### MiniMe AI Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/minime/process` | Process YouTube video for persona |
| `POST` | `/api/minime/upsert-persona` | Save persona to database |

### Public Endpoints (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/public/trainer-info` | Get trainer public profile |
| `GET` | `/api/public/tiers` | Get trainer's pricing tiers |
| `GET` | `/api/public/subscription-status` | Check subscription status |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # 20+ API route handlers
│   ├── (pages)/           # Feature pages (dashboard, routines, users, etc.)
│   └── layout.tsx         # Root layout with theme + auth
├── components/            # Reusable UI components
├── hooks/                 # Custom React hooks
├── lib/                   # Business logic (AI, YouTube)
├── utils/                 # Utilities (Supabase clients, Stripe)
├── types/                 # TypeScript definitions
└── data/                  # Static data (300+ exercises)
```

---

## Deployment

### Docker Build

```bash
# Build production image
docker build -t liftspump-dashboard .

# Run container
docker run -p 3000:3000 liftspump-dashboard
```

### AWS ECS Deployment

The project includes GitHub Actions workflow for automated deployment:

1. Push to `main` branch triggers deployment
2. Docker image built and pushed to ECR
3. ECS task definition updated
4. Service deployed to ECS cluster

---

## Technical Decisions

### Why Next.js 15 App Router?
- Server components for improved performance
- Built-in API routes eliminate separate backend
- Turbopack for fast development builds
- Native TypeScript support

### Why Supabase?
- PostgreSQL with row-level security
- Built-in auth with OAuth providers
- Real-time subscriptions for live updates
- Storage buckets for media files

### Why Material-UI?
- Comprehensive component library
- Excellent TypeScript support
- Customizable theming system
- Accessibility built-in

### Why Stripe Connect?
- Marketplace payment splitting
- Handles complex tax and compliance
- Customer portal reduces support burden
- Webhook-driven architecture

---

## Skills Demonstrated

- **Full-Stack Development** - Next.js, React, Node.js, TypeScript
- **Database Design** - PostgreSQL, Supabase, row-level security
- **API Development** - RESTful design, webhook handling, validation
- **Payment Integration** - Stripe Checkout, Connect, webhooks
- **AI/ML Integration** - LLM APIs, prompt engineering, audio processing
- **Real-Time Systems** - WebRTC, WebSockets, live data sync
- **Cloud Infrastructure** - Docker, AWS ECS/ECR, CI/CD
- **UI/UX** - Material Design, responsive layouts, dark themes

---

## License

This project is proprietary software. All rights reserved.

---

<div align="center">

**Built with modern technologies for scalable, maintainable SaaS applications.**

</div>
