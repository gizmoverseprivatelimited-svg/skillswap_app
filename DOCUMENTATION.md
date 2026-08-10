# SkillSwap Platform — Technical Documentation

## Executive Overview

**SkillSwap** is a full-stack cross-platform mobile and web application designed for peer-to-peer skill exchange, live group learning workshops, resource sharing, and tokenized knowledge monetization. 

The platform enables users to trade knowledge 1-on-1 (e.g. trading Spanish lessons for Python tutoring) or host/attend group classes powered by live WebRTC video calling. A built-in point economy allows users to earn credits by teaching and spend credits on learning, with cashout capabilities for top creators.

---

## 1. Architecture & Technology Stack

SkillSwap uses a decoupled client-server architecture. The mobile/web front end communicates with a Node.js/Express API gateway for persistent HTTP transactions and a Socket.IO server for real-time signaling and notifications. Live video streams are managed via the 100ms WebRTC infrastructure.

```mermaid
flowchart TD
    subgraph Client ["Client Tier (Expo Router v56 / React Native 0.85)"]
        UI["React Native / Web UI"]
        State["React Query / Context Providers"]
        HMSClient["100ms Video SDK"]
    end

    subgraph Backend ["Backend Tier (Node.js / Express on Port 3201)"]
        API["Express HTTP REST Server"]
        Socket["Socket.IO Signaling Server"]
        Matching["Matching Algorithm Engine"]
    end

    subgraph External ["External Services & Data"]
        Mongo[("MongoDB (Mongoose ODM)")]
        HMSCloud["100ms Live Cloud Engine"]
        ExpoPush["Expo Push Notification API"]
    end

    UI <--> State
    State <-->|HTTP / JSON| API
    UI <-->|WebSocket| Socket
    HMSClient <-->|WebRTC Stream| HMSCloud
    API <--> Mongo
    API --> ExpoPush
```

### Technology Breakdown

| Component | Technology | Version / Tooling |
| :--- | :--- | :--- |
| **Mobile Core** | React Native | 0.85.3 |
| **App Framework** | Expo SDK | ~56.0.16 |
| **Routing** | Expo Router (File-based) | ~56.2.15 |
| **Language** | TypeScript | ~5.3 |
| **State Hydration** | TanStack React Query + React Context | ^4.42.0 |
| **Video Calling** | 100ms Live SDK (`@100mslive/react-native-hms`) | ^1.12.3 |
| **Styling & UI** | Reanimated v4, Expo Blur, Lucide Icons, FlashList | React Native Reanimated 4.3.1 |
| **Backend Runtime** | Node.js / Express.js | Port 3201 |
| **Real-time Server** | Socket.IO Server & Client | ^4.8.3 |
| **Database** | MongoDB with Mongoose ODM | Node Mongoose Driver |
| **Authentication** | JWT, Google Sign-In, Apple Authentication | Expo Auth Session / Native Drivers |

---

## 2. Directory Structure

```
skill/
├── app/                        # Expo Router file-based pages & navigation
│   ├── (tabs)/                 # Main tab navigation screens
│   │   ├── _layout.tsx         # Bottom tab bar configuration
│   │   ├── home.tsx            # Dashboard, active swaps, recommendations
│   │   ├── explore.tsx         # Skill catalog & user discovery
│   │   ├── classes.tsx         # Group workshop listings & enrollment
│   │   ├── resources.tsx       # Educational resources library
│   │   ├── notifications.tsx   # User notification inbox
│   │   └── profile.tsx         # Personal user profile & stats
│   ├── admin/                  # Admin management dashboards
│   ├── call/                   # Video call screens & 100ms room integration
│   ├── class/                  # Group class creation & session screens
│   ├── earnings/               # Instructor balance & cashout views
│   ├── profile/                # User review & public profile details
│   ├── swaps/                  # Skill swap proposal & scheduling manager
│   ├── add-skill.tsx           # Wizard to publish skills offered/wanted
│   ├── store.tsx               # Point purchasing store
│   └── verification.tsx        # Identity & skill verification flow
├── components/                 # Reusable UI elements
│   ├── InAppNotificationBanner.tsx # Dynamic banner notifications
│   ├── MatchCard.tsx           # Match recommendation cards with compatibility %
│   ├── SkillSwapRequestModal.tsx # Proposal modal for requesting 1-on-1 swaps
│   ├── VideoCallScreen.tsx     # 100ms video call interface component
│   └── ReviewsSection.tsx      # Ratings & review list renderer
├── providers/                  # Application state & context providers
│   ├── auth.tsx                # Session token & authentication context
│   ├── skill-swaps.tsx         # Proposal lifecycle & active swaps state
│   ├── classes.tsx             # Group class discovery & enrollment state
│   ├── earnings.tsx            # Points ledger & payout request state
│   ├── admin.tsx               # Platform admin controls state
│   ├── socket.tsx              # WebSocket connection manager
│   └── notifications.tsx       # Push & in-app notification context
├── lib/                        # Core algorithms & utility libraries
│   ├── matching.ts             # Compatibility algorithm & user role derivation
│   ├── calendar.ts             # Availability scheduling & calendar sync
│   ├── payments.ts             # Points transaction processor
│   └── push-notifications.ts   # Device registration & notification dispatcher
└── server/                     # Express.js REST API & Socket.IO server
    ├── src/
    │   ├── controllers/        # REST route handler modules
    │   ├── models/             # Mongoose database schemas
    │   ├── socket.js           # Socket.IO connection & event handlers
    │   └── index.js            # Express server bootstrapper
    └── .env                    # Server environment configuration
```

---

## 3. Database Schema & Data Models

The persistence layer consists of 12 primary MongoDB collections defined via Mongoose schemas in `server/src/models/`:

### Key Data Models

#### 1. User Schema ([User.js](file:///c:/Users/Acer/Desktop/code/skill/server/src/models/User.js))
Stores user identity, credentials, published skills, trust rating, point balance, and verification status.
- **Fields**: `name`, `email`, `password`, `avatar`, `bio`, `role` (`'teacher' | 'learner' | 'swap'`), `pointsBalance`, `trustScore`, `isVerified`, `skillsOffered`, `skillsWanted`, `socialLinks`.

#### 2. Skill Swap Schema ([SkillSwap.js](file:///c:/Users/Acer/Desktop/code/skill/server/src/models/SkillSwap.js))
Tracks 1-on-1 skill exchange proposals between two users across their lifecycle.
- **Fields**: `requesterId`, `recipientId`, `offeredSkill`, `requestedSkill`, `status` (`'pending' | 'accepted' | 'scheduled' | 'completed' | 'cancelled'`), `scheduledTime`, `meetingLink`, `hmsRoomId`.

#### 3. Group Class Schema ([GroupClass.js](file:///c:/Users/Acer/Desktop/code/skill/server/src/models/GroupClass.js))
Represents live workshop sessions taught by an instructor to multiple enrolled students.
- **Fields**: `instructorId`, `title`, `description`, `category`, `priceInPoints`, `maxParticipants`, `scheduledAt`, `durationMinutes`, `meetingUrl`, `status`.

#### 4. Point Transaction Schema ([PointTransaction.js](file:///c:/Users/Acer/Desktop/code/skill/server/src/models/PointTransaction.js))
An immutable ledger capturing all point transfers (rewards, class payments, top-ups, payouts).
- **Fields**: `userId`, `amount`, `type` (`'earned' | 'spent' | 'purchased' | 'cashed_out'`), `description`, `referenceId`, `createdAt`.

#### 5. User Verification Schema ([UserVerification.js](file:///c:/Users/Acer/Desktop/code/skill/server/src/models/UserVerification.js))
Manages trust & identity verifications submitted by users for admin approval.
- **Fields**: `userId`, `idDocumentUrl`, `portfolioLinks`, `status` (`'pending' | 'approved' | 'rejected'`), `reviewedBy`, `rejectionReason`.

#### 6. Payout Request Schema ([PayoutRequest.js](file:///c:/Users/Acer/Desktop/code/skill/server/src/models/PayoutRequest.js))
Handles instructor requests to convert earned points into real-world monetary payouts.
- **Fields**: `userId`, `pointsAmount`, `monetaryValue`, `paymentMethod`, `bankDetails`, `status` (`'pending' | 'processed' | 'declined'`).

---

## 4. Business Logic & Algorithmic Engines

### Skill Compatibility & Matching Engine ([matching.ts](file:///c:/Users/Acer/Desktop/code/skill/lib/matching.ts))

SkillSwap implements a multi-variable matching algorithm to pair users based on reciprocal teaching capabilities, mutual interests, user ratings, and past platform activity.

#### Mathematical Formula

The compatibility score \( C \in [0, 100] \) between User A and User B is computed as:

\[
C = \min\left(100, \max\left(0, \left\lfloor (L_{\text{you}} \cdot 28) + (L_{\text{them}} \cdot 22) + (I_{\text{shared}} \cdot 8) + \left(\frac{R}{5} \cdot 18\right) + \left(\frac{\min(S, 40)}{40} \cdot 12\right) + (M_{\text{cat}} \cdot 5) \right\rfloor\right)\right)
\]

Where:
- \( L_{\text{you}} \): Count of skills User B offers that User A wants to learn.
- \( L_{\text{them}} \): Count of skills User A offers that User B wants to learn.
- \( I_{\text{shared}} \): Count of mutual skills both users want to explore.
- \( R \): Average rating score of the partner user (scale 0–5).
- \( S \): Total completed swap count of the partner user.
- \( M_{\text{cat}} \): Count of overlapping category tags across offer sets.

#### Role Derivation Logic
User roles are dynamically computed if omitted:
- **Teacher**: Offers skills but requests none.
- **Learner**: Requests skills but offers none.
- **Swap**: Offers skills and requests skills (reciprocal participant).

---

## 5. State Management & Context Architecture

The application relies on modular React Context Providers (`providers/`) paired with React Query for cached data fetching and optimistic UI updates:

```
[ Root Provider Layer ]
 ├── AuthProvider (`providers/auth.tsx`)
 ├── SocketProvider (`providers/socket.tsx`)
 ├── CurrentUserProvider (`providers/current-user.tsx`)
 ├── SkillSwapsProvider (`providers/skill-swaps.tsx`)
 ├── ClassesProvider (`providers/classes.tsx`)
 ├── ResourcesProvider (`providers/resources.tsx`)
 ├── EarningsProvider (`providers/earnings.tsx`)
 ├── AdminProvider (`providers/admin.tsx`)
 └── NotificationsProvider (`providers/notifications.tsx`)
```

- **AuthProvider**: Stores authentication state, JWT storage in AsyncStorage, and session validation.
- **SkillSwapsProvider**: Manages active swap proposals, real-time status transitions, and proposal creation modals.
- **ClassesProvider**: Handles class creation, student enrollment, filter state, and 100ms room code fetching.
- **EarningsProvider**: Controls point balances, transaction log history, and payout submission workflows.
- **AdminProvider**: Powers administrator actions including user moderation, verification reviews, and platform metrics.

---

## 6. Real-Time Communication & Video Integration

### WebSockets ([socket.js](file:///c:/Users/Acer/Desktop/code/skill/server/src/socket.js))

The Socket.IO connection is managed by `providers/socket.tsx`. Key socket channels include:
- `join_room` / `leave_room`: Joins user to session rooms for live messaging and status listening.
- `send_message` / `receive_message`: Instant messaging during active skill swaps.
- `swap_update`: Emitted when a swap proposal is accepted, scheduled, or completed.
- `notification`: Delivers instant in-app alerts (triggering `InAppNotificationBanner.tsx`).

### Live Video Calling ([VideoCallScreen.tsx](file:///c:/Users/Acer/Desktop/code/skill/components/VideoCallScreen.tsx))

1-on-1 swaps and group workshops leverage 100ms WebRTC infrastructure (`@100mslive/react-native-hms`).
- Rooms are dynamically provisioned via backend endpoints.
- Web fallback (`HMSView.web.tsx`) uses iframe embedding, while native iOS/Android builds use native SDK components (`HMSView.native.tsx`).

---

## 7. API Specification Summary

The Express backend routes are mounted under the following path prefixes:

| Prefix | Handler Module | Primary Operations |
| :--- | :--- | :--- |
| `/api/auth` | `controllers/auth` | Login, Registration, Google OAuth, Password Reset, OTP verification |
| `/users` | `controllers/user` | Profile management, skill publishing, search, trust score updates |
| `/skills` | `controllers/skills` | Skill taxonomy catalog, category lookup, trending skills |
| `/swaps` | `controllers/skillswap` | Match suggestions, swap proposals, scheduling, status updates |
| `/classes` | `controllers/classes` | Workshop creation, class listing, student enrollment, room codes |
| `/resources` | `controllers/resource` | Upload learning materials, resource indexing, voting |
| `/reviews` | `controllers/reviews` | Post swap reviews, instructor rating aggregations |
| `/verifications` | `controllers/verifications` | Submit verification documents, proof auditing |
| `/payments` | `controllers/payment` | Point package purchases, payment callbacks |
| `/earnings` | `controllers/earnings` | Instructor revenue dashboard, cashout requests |
| `/admin/users` | `controllers/admin` | Platform statistics, content moderation, user management |

---

## 8. Local Setup & Execution Guide

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **Package Manager**: Bun (`bun`) or NPM (`npm`)
- **Database**: Active MongoDB instance (Local or MongoDB Atlas connection string)

### 1. Environment Setup

Create `.env` in the root folder:
```env
EXPO_PUBLIC_RORK_API_BASE_URL=https://api.example.com
EXPO_PUBLIC_API_URL=https://api.example.com

EXPO_PUBLIC_GOOGLE_WEB_ID=YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_ID=YOUR_GOOGLE_ANDROID_CLIENT_ID.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_ID=YOUR_GOOGLE_IOS_CLIENT_ID.apps.googleusercontent.com

```

Create `.env` in the `server/` directory:
```env
PORT=3201
MONGODB_URI='mongodb+srv://YOUR_DB_USER:YOUR_DB_PASSWORD@cluster.mongodb.net/skillswap?appName=skillswap'
JWT_SECRET='YOUR_JWT_SECRET_KEY_HERE'
RAZORPAY_KEY_ID=rzp_test_YOUR_RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_KEY_SECRET
TWO_FACTOR_API_KEY=YOUR_2FACTOR_API_KEY
HMS_ACCESS_KEY=YOUR_HMS_ACCESS_KEY
HMS_SECRET=YOUR_HMS_SECRET

# Swap Page Video Call Template
HMS_SWAP_TEMPLATE_ID=YOUR_HMS_SWAP_TEMPLATE_ID
HMS_TEMPLATE_ID=YOUR_HMS_TEMPLATE_ID

# Teacher-Student Class Video Call Template
HMS_TEACHER_CLASS_TEMPLATE_ID=YOUR_HMS_TEACHER_CLASS_TEMPLATE_ID
HMS_GROUP_CLASS_TEMPLATE_ID=YOUR_HMS_GROUP_CLASS_TEMPLATE_ID
HMS_GROUP_CLASS_HOST_ROOM_CODE=xxx-xxxx-xxx
HMS_GROUP_CLASS_STUDENT_ROOM_CODE=xxx-xxxx-xxx
HMS_GROUP_CLASS_ROOM_CODE=xxx-xxxx-xxx
HMS_GROUP_CLASS_AUTH_TOKEN=YOUR_HMS_GROUP_CLASS_AUTH_TOKEN

```

### 2. Running the Backend Server

```bash
cd server
npm install
npm start
```
The server will start listening on `http://localhost:3201`.

### 3. Running the Mobile & Web Client

In the project root directory:

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Start web preview directly in browser
npx expo start --web
```

---

## 9. Quality Verification & Build

- **Linter**: Run `bun run lint` to execute Expo ESLint checks across TypeScript files.
- **Native Builds**: Configured via [eas.json](file:///c:/Users/Acer/Desktop/code/skill/eas.json) and [app.json](file:///c:/Users/Acer/Desktop/code/skill/app.json) for Android APK/AAB and iOS IPA generation via Expo Application Services.
