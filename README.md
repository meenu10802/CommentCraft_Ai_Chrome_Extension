# CommentCraft_Ai_Chrome_Extension

A Chrome extension that generates comments with an Ai and inserts them directly into the comment box on social platforms.

Instead of copying a post into a separate AI tool and pasting the reply back, you click one button on the page and the comment appears where you need it.

> **Status:** In active development.


## Features

- One-click AI comment generation on the page you are viewing
- Reads the post content from the page using DOM manipulation
- Inserts the generated comment directly into the platform's comment box
---

## How It Works

```
Web page (post)
     |
     |  1. When comment box is clciked buttons are populated  that asks for tone of comment once selected content script reads the post text (DOM)
     v
Background service worker
     |
     |  2. Sends post data to the backend API
     v
Backend (Node.js + Express)
     |
     |  3. Builds the prompt and calls the LLM API
     v
LLM 
     |
     |  4. Returns the generated comment
     v
Backend  -->  Background worker  -->  Content script
                                          |
                                          |  5. Inserts the comment into the comment box (DOM)
                                          v
                                    Comment box
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Extension | JavaScript (ES6+), Chrome Extension Manifest V3, HTML/CSS |
| Backend | Node.js, Express.js |
| AI | LLM API with prompt engineering |
| Design | Figma (UI designs) |
| Dev environment | GitHub Codespaces |

---

## Project Structure

```
commentcraft-ai/
├── extension/
│   ├── manifest.json      # Extension config and permissions
│   ├── background.js      # Service worker: talks to the backend
│   ├── content.js         # Reads posts and inserts comments (DOM)
│   └── [popup.html/js]    # Optional settings UI
├── backend/
│   ├── server.js          # Express API: /generate endpoint
│   ├── package.json
│   └── .env               # API key (not committed)
├── .gitignore
└── README.md
```


## Disclaimer

This project is built for learning and productivity. Automating activity may violate the terms of some platforms. Review each platform's policies and always review comments before posting.

---
