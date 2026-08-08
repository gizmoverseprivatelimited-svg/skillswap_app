# SkillSwap — Peer-to-Peer Skill Exchange & Workshop Platform

SkillSwap is a cross-platform mobile and web application built with **React Native**, **Expo Router**, **Node.js/Express**, **MongoDB**, and **100ms Live Video SDK**.

It allows users to learn new skills from peers through 1-on-1 reciprocal skill swaps, attend live video workshops hosted by community experts, share educational resources, and participate in a point-based knowledge economy.

---

## 📑 Full Documentation

Detailed technical documentation, architectural diagrams, data model schemas, matching formulas, API endpoint tables, state management patterns, and deployment instructions are available in:

👉 **[DOCUMENTATION.md](file:///c:/Users/Acer/Desktop/code/skill/DOCUMENTATION.md)**

---

## 🚀 Key Features

- **1-on-1 Skill Swaps**: Algorithmic match suggestions based on reciprocal learning interests, ratings, and category alignment.
- **Live Video Workshops**: Group classes powered by 100ms WebRTC infrastructure for real-time video, audio, and interactive screen sharing.
- **Points & Monetization Economy**: Earn points by teaching or hosting workshops; spend points to enroll in classes; top creators can request monetary cashouts.
- **Resource Marketplace**: Community-curated guides, tutorial links, and downloadable educational assets.
- **Trust & Verification**: Identity and skill proof submission system with admin moderation and verification badges.
- **Real-Time Communication**: Socket.IO integration for instant messages, session status notifications, and live alerts.

---

## 🛠️ Stack at a Glance

| Layer | Technologies |
| :--- | :--- |
| **Mobile & Web Client** | Expo SDK 56, React Native 0.85, Expo Router v56, TypeScript, Lucide Icons |
| **State & Data Fetching** | React Context Providers, TanStack React Query v4 |
| **Real-Time & Media** | Socket.IO, 100ms Live Video SDK (`@100mslive/react-native-hms`) |
| **Backend API** | Node.js, Express.js (Port 3201), Socket.IO Server |
| **Database** | MongoDB, Mongoose ODM |

---

## ⚡ Quick Start

### 1. Backend Setup

```bash
cd server
npm install
npm start
```
The API server will run on `http://localhost:3201`.

### 2. Mobile / Web App Setup

```bash
# In project root
bun install

# Web Preview
bun run start-web

# Mobile Development (Expo Go / Emulator)
bun run start
```

For detailed environment variables setup and database configuration, refer to **[DOCUMENTATION.md](file:///c:/Users/Acer/Desktop/code/skill/DOCUMENTATION.md)**.
