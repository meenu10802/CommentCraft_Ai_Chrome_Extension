// Put your public backend URL here (Codespaces: Ports tab -> port 3000 -> Public).
const API = "https://cautious-space-system-9xrr4gp54hw96-3000.app.github.dev/generate";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "GENERATE") return;

  fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ post: msg.post, tone: msg.tone }),
  })
    .then(async (r) => {
      const data = await r.json().catch(() => ({}));
      // Success: { comment }. Failure: { error }. The page inserts whichever comes back.
      sendResponse(data);
    })
    .catch(() =>
      sendResponse({ error: "Could not reach the AI service. Please try again later." })
    );

  return true; // keep the message channel open for the async response
});