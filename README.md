# 🪴 AI Therapist Agent

An empathetic, private, and intelligent mental health chat application built with React, Vite, Firebase, and Groq's blazing-fast LLaMA 3.1. It provides users with a safe space to reflect on their thoughts, featuring crisis detection, session memory, and actionable coping steps.

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=flat&logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=flat&logo=Firebase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)

---

## ✨ Key Features

- **🔐 Secure Authentication:** Seamless Google Login and anonymous browsing via Firebase Auth.
- **💬 Real-Time Therapy Chat:** Instant, empathetic responses powered by Groq SDK and LLaMA 3.1.
- **🚨 Crisis Detection System:** Automatically identifies self-harm language and immediately redirects users to professional emergency resources.
- **🗂 Session Memory:** Automatically saves chats securely to Firestore so users can pick up where they left off.
- **🧠 Smart Insights:** Generates a brief summary and 3 personalized actionable coping steps when a session concludes.
- **🔒 Privacy First:** Anonymous chats are ephemeral. Logged-in sessions are isolated via Firebase Security Rules.

---

## 🛠 Tech Stack

### Frontend
- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS v4
- **Database & Auth:** Firebase (Firestore + Authentication)

### Backend (Serverless)
- **Infrastructure:** Vercel Serverless Functions (`/api/*`)
- **AI Integration:** Groq SDK (LLaMA-3.1-8b-instant model)

---

## 📁 Project Structure

The project has been streamlined into a single directory for zero-config Vercel deployment.

```
AI-Therapist-Agent/
├── client/
│   ├── api/
│   │   └── chat.js          <-- Vercel Serverless Function (Backend)
│   ├── src/
│   │   ├── firebase.js      <-- Firebase Initialization
│   │   └── App.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## 🚀 Local Setup

### 1. Clone the repository
```bash
git clone https://github.com/Salvin-Sebastian/AI-Therapist-Agent.git
cd AI-Therapist-Agent/client
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file inside the `client/` directory and add your keys:
```env
# Groq API
VITE_GROQ_API_KEY=your_groq_api_key_here

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 4. Start the Development Server
```bash
npm run dev
```
Navigate to `http://localhost:5173` to view the app! *(Note: The serverless API function will not run locally under normal `npm run dev`. To test the full-stack app locally, use the Vercel CLI: `npx vercel dev`)*.

---

## 🌐 Deployment on Vercel

This project is optimized for zero-configuration deployment on Vercel!

1. Log into your Vercel dashboard and click **Add New > Project**.
2. Import this repository.
3. ⚠️ **IMPORTANT:** Click **Edit** next to "Root Directory" and select the `client` folder.
4. Copy all variables from your `.env` file into the Vercel **Environment Variables** section.
5. Click **Deploy**! Vercel will automatically build the React frontend and deploy `api/chat.js` as a secure Serverless Backend Function.
