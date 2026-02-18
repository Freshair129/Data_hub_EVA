# ADR 002: Hybrid Architecture (Node.js + Python Integration)

## Status
Accepted

## Context
The CRM system requires advanced data processing capabilities, including OCR for slip verification and potential AI-driven chat analysis. While Next.js is excellent for the web interface and API routing, Python is the industry standard for AI, Data Science, and OCR tasks due to its mature ecosystem (Gemini SDK, OpenCV, Pandas).

## Decision
We decided to implement a "Hybrid Architecture" where:
1.  **Next.js (Node.js)** serves as the primary Web/API entry point.
2.  **Python Worker** handles heavy-lift logic (Chat Syncing, AI Verification).
3.  **The Bridge**: A child-process execution mechanism (`pythonBridge.js`) allows Node.js to call Python logic directly, providing a "Direct Mode" that works even without a message queue (Redis).

## Consequences
### Pros
- **Specialization**: Each language does what it's best at.
- **AI Readiness**: Easy integration with AI/ML libraries in Python.
- **Decoupling**: Business logic is separated from UI concerns.
- **Direct Mode**: System remains functional in environments without Redis.

### Cons
- **Overhead**: Spawning child processes adds minor latency compared to native JS functions.
- **Complexity**: Multiple language runtimes to manage (Node.js + Python).
- **Environment Management**: Requires `requirements.txt` and proper Python setup on the host.
