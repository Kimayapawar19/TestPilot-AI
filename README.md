# TestPilot AI – AI-Powered QA Assistant

TestPilot AI is a beginner-friendly AI-powered software testing assistant designed to simplify common Quality Assurance (QA) activities.

It uses Google's Gemini API to help users analyze software requirements, generate test scenarios and test cases, prepare QA documentation, and evaluate prompts.

## Features

- **Requirement Analyzer:** Analyzes requirements and generates structured summaries.
- **Test Scenario Generator:** Generates test scenarios based on given requirements.
- **Test Case Generator:** Creates structured test cases.
- **QA Document Generator:** Helps generate QA documentation.
- **Bug Report Generator:** Creates and saves bug reports.
- **Change Impact Analyzer:** Helps identify the possible impact of requirement changes.
- **Prompt Lab:** Evaluates and improves prompts.
- **History:** Saves and manages previously generated results.
- **Dashboard & Test Summary:** Displays saved testing activities and test status.
- **Export:** Supports exporting selected results.

## Technology Stack

**Frontend**
- HTML
- CSS
- JavaScript

**Backend**
- Node.js
- Express.js

**AI Integration**
- Google Gemini API

**Storage**
- Browser Local Storage

## Project Structure

```text
TestPilot-AI/
│
├── backend/
│   ├── prompts/
│   ├── server.js
│   └── package.json
│
├── fronted/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── package.json
└── README.md
```

## Installation & Setup

1. Clone the repository:

```bash
git clone https://github.com/Kimayapawar19/TestPilot-AI.git
```

2. Open the project folder:

```bash
cd TestPilot-AI
```

3. Install the backend dependencies:

```bash
cd backend
npm install
```

4. Create a `.env` file inside the backend folder and configure your Gemini API key using the environment variable expected by `server.js`.

5. Start the backend server from the project root:

```bash
npm start
```

6. Open `fronted/index.html` using VS Code Live Server.

## Important Note

- A valid Gemini API key is required for AI-powered features.
- Keep your API key private. Never upload your `.env` file to GitHub.

## Purpose

The purpose of TestPilot AI is to make software testing activities easier, more organized, and accessible through AI assistance.

---

**Developed as a Mini Project – TestPilot AI**