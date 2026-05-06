# 🧠 AI Therapist Chat App

An AI-powered mental health chat application that provides a **safe, empathetic, and private space** for users to talk, reflect, and cope — with support for **anonymous chats**, **secure login**, **session history**, **crisis detection**, and **end-of-session summaries**.

---

## ✨ Features

### 🔐 Authentication
- Firebase Authentication
- Email/Password login
- Anonymous “Continue without login”
- Secure session isolation per user

### 💬 Chat System
- Real-time AI therapist responses (Groq + LLaMA 3.1)
- Smooth chat UI with auto-scroll
- Message history for logged-in users
- Anonymous chats are **never stored**

### 🗂 Session Management
- Auto-generated session titles
- View past chat sessions
- Open previous sessions
- Delete individual sessions
- New chat resets current session

### 🧠 End-of-Session Summary
- AI-generated session summary
- 3 suggested coping steps
- Displayed when starting a new chat

### 🚨 Safety & Crisis Detection
- Detects self-harm / harm-related language
- Immediately shows emergency resources
- Stops normal AI flow during crisis

### 🔒 Privacy First
- Sessions tied to `userId`
- Anonymous chats are ephemeral
- Backend enforces user-level data access

---

## 🛠 Tech Stack

### Frontend
- React (Vite)
- Tailwind CSS
- Firebase Auth

### Backend
- Node.js
- Express
- MongoDB + Mongoose
- Groq SDK (LLaMA 3.1)

---

## 📁 Project Structure

project-root/
├── client/
│ ├── src/
│ │ ├── Chat.jsx
│ │ ├── Auth.jsx
│ │ ├── firebase.js
│ │ └── App.jsx
│ ├── .env
│ └── vite.config.js
│
├── server/
│ ├── models/
│ │ └── Session.js
│ ├── server.js
│ ├── db.js
│ └── .env
│
└── README.md

---

## ⚙️ Environment Variables

### 🔹 Frontend (`client/.env`)
```env
VITE_FIREBASE_API_KEY=xxxx
VITE_FIREBASE_AUTH_DOMAIN=xxxx
VITE_FIREBASE_PROJECT_ID=xxxx
VITE_FIREBASE_STORAGE_BUCKET=xxxx
VITE_FIREBASE_MESSAGING_SENDER_ID=xxxx
VITE_FIREBASE_APP_ID=xxxx# ai-therapist-app-final
# ai-therapist-app-final
# ai-therapist-app-final
