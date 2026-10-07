(() => {
  if (window.__commentcraftLoaded) return;
  window.__commentcraftLoaded = true;

  // [emoji, label, tone id sent to the backend]
  const TONES = [
    ["😊", "Happy", "happy"],
    ["😢", "Sad", "sad"],
    ["👍", "Agree", "agree"],
    ["👎", "Disagree", "disagree"],
    ["⚔️", "Argue", "argue"],
    ["💡", "Explain", "explain"],
  ];

  let activeEditor = null;
  let busy = false;

  // ------------------------------------------------------------
  // 1. Button bar (inside a shadow root so site CSS can't break it)
  // ------------------------------------------------------------
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      .bar {
        position: fixed; display: none; flex-wrap: wrap; align-items: center; gap: 4px;
        padding: 6px; box-sizing: border-box; background: #fff;
        border: 1px solid #d6d6d6; border-radius: 12px;
        box-shadow: 0 2px 5px rgba(0,0,0,.08), 0 5px 15px rgba(0,0,0,.10);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      }
      .bar.show { display: flex; }
      button {
        height: 36px; padding: 0 10px; display: inline-flex; align-items: center; gap: 5px;
        border: none; border-radius: 8px; background: transparent; color: #333;
        font: 500 13px inherit; font-family: inherit; white-space: nowrap; cursor: pointer;
        transition: background .15s, transform .1s;
      }
      button:hover { background: #f2f2f2; }
      button:active { transform: scale(.96); }
      .bar.loading button { opacity: .5; pointer-events: none; }
      .status { display: none; font-size: 12px; color: #666; padding: 0 8px; }
      .bar.loading .status { display: inline; }
    </style>
    <div class="bar"><span class="status">Generating...</span></div>
  `;
  const bar = shadow.querySelector(".bar");

  TONES.forEach(([emoji, label, tone]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${emoji} ${label}`;
    b.addEventListener("click", () => onToneClick(tone));
    bar.appendChild(b);
  });

  // Clicking the bar must not steal focus from the comment box.
  bar.addEventListener("mousedown", (e) => e.preventDefault());

  // ------------------------------------------------------------
  // 2. Detect any comment box on any site
  // ------------------------------------------------------------
  // Chat apps and search engines: never show buttons here.
  const BLOCKED_HOSTS =
    /(^|\.)(web\.whatsapp\.com|messenger\.com|discord\.com|web\.telegram\.org|slack\.com|teams\.microsoft\.com|mail\.google\.com|outlook\.live\.com|outlook\.office\.com|google\.com|bing\.com|duckduckgo\.com)$/i;

  // Words in the box's own labels that mean "this is not a comment box".
  const NOT_COMMENT_LABEL =
    /search|find anything|type a message|send a message|message|chat|query|e-?mail|user|phone|password|url|subject/i;

  function isExcluded(el) {
    if (BLOCKED_HOSTS.test(location.hostname)) return true;

    // The box's own labels
    const label = [
      el.getAttribute("aria-label"),
      el.getAttribute("aria-placeholder"),
      el.getAttribute("placeholder"),
      el.getAttribute("name"),
      el.getAttribute("id"),
      el.getAttribute("title"),
      el.getAttribute("data-testid"),
      el.getAttribute("type"),
    ]
      .filter(Boolean)
      .join(" ");
    if (NOT_COMMENT_LABEL.test(label)) return true;

    // Anything inside a search component (checks up to 8 parents, crossing shadow DOM)
    let node = el;
    for (let i = 0; node && i < 8; i++) {
      const tag = node.tagName || "";
      const role = node.getAttribute ? node.getAttribute("role") : "";
      if (/search/i.test(tag) || role === "search" || role === "searchbox") return true;
      node = parentOf(node);
    }
    return false;
  }

  function findEditable(target) {
    if (!(target instanceof HTMLElement)) return null;
    const el = target.closest(
      'textarea, input, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
    );
    if (!el) return null;
    if (isExcluded(el)) return null;

    if (el.matches("textarea")) {
      if (el.readOnly || el.disabled) return null;
    } else if (el.matches("input")) {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (type !== "text") return null;
      const label = `${el.getAttribute("aria-label") || ""} ${el.name || ""} ${el.placeholder || ""}`;
      if (/search|e-?mail|user|phone|password|url/i.test(label)) return null;
    } else if (!el.isContentEditable && !el.matches('[role="textbox"]')) {
      return null;
    }

    const r = el.getBoundingClientRect();
    if (r.width < 150 || r.height < 20) return null; // skip tiny inputs
    return el;
  }

  function onFocusOrClick(e) {
    if (busy) return;
    const target = e.composedPath ? e.composedPath()[0] : e.target; // works inside shadow DOM
    const editor = findEditable(target);
    if (!editor) return;
    activeEditor = editor;
    show();
  }

  document.addEventListener("focusin", onFocusOrClick, true);
  document.addEventListener("click", onFocusOrClick, true);

  document.addEventListener(
    "focusout",
    () => {
      setTimeout(() => {
        if (busy || !activeEditor) return;
        let a = document.activeElement;
        while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
        if (a && (a === activeEditor || activeEditor.contains(a))) return;
        hide();
      }, 200);
    },
    true
  );

  // ------------------------------------------------------------
  // 3. Show, hide, position
  // ------------------------------------------------------------
  function show() {
    if (!host.isConnected) document.documentElement.appendChild(host);
    bar.classList.add("show");
    position();
  }

  function hide() {
    bar.classList.remove("show");
    activeEditor = null;
  }

  function position() {
    if (!activeEditor || !activeEditor.isConnected) return hide();
    const r = activeEditor.getBoundingClientRect();
    const h = bar.offsetHeight || 48;
    let top = r.bottom + 6;
    if (top + h > window.innerHeight) top = Math.max(8, r.top - h - 6); // flip above if no room
    bar.style.top = `${top}px`;
    bar.style.left = `${Math.max(8, r.left)}px`;
    bar.style.maxWidth = `${Math.max(r.width, 280)}px`;
  }

  window.addEventListener("scroll", () => activeEditor && position(), true);
  window.addEventListener("resize", () => activeEditor && position());

  // ------------------------------------------------------------
  // 4. Read the post the user is replying to
  // ------------------------------------------------------------
  function parentOf(node) {
    if (node.parentElement) return node.parentElement;
    const root = node.getRootNode();
    return root instanceof ShadowRoot ? root.host : null; // climb out of shadow DOM
  }

  function getContext(editor) {
    const own = (editor.value ?? editor.innerText ?? "").trim();
    let text = "";
    let node = parentOf(editor);

    // Walk up until an ancestor holds enough text: that is the post/comment thread.
    while (node && node !== document.documentElement) {
      let t = (node.innerText || "").trim();
      if (own) t = t.replace(own, "");
      t = t.replace(/\s+/g, " ").trim();
      if (t.length >= 150) {
        text = t;
        break;
      }
      node = parentOf(node);
    }

    if (!text) {
      const meta = document.querySelector('meta[name="description"], meta[property="og:description"]');
      text = meta?.content || "";
    }

    return `Page title: ${document.title}\n\n${text.slice(0, 1500)}`;
  }

  // ------------------------------------------------------------
  // 5. Insert text into any kind of editor
  // ------------------------------------------------------------
  function insertText(el, text) {
    el.focus();

    // <textarea> / <input>: use the native setter so React-style sites notice the change
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const proto =
        el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    // contenteditable (Reddit, LinkedIn, X, etc.): replace content like real typing
    document.execCommand("selectAll", false, null);
    const ok = document.execCommand("insertText", false, text);
    if (!ok) {
      el.textContent = text;
      el.dispatchEvent(
        new InputEvent("input", { bubbles: true, inputType: "insertText", data: text })
      );
    }
  }

  // ------------------------------------------------------------
  // 6. Button click: page -> background -> backend -> AI -> comment box
  // ------------------------------------------------------------
  async function onToneClick(tone) {
    if (busy || !activeEditor) return;

    const editor = activeEditor;
    busy = true;
    bar.classList.add("loading");

    const post = getContext(editor);
    let output;

    try {
      const res = await chrome.runtime.sendMessage({ type: "GENERATE", post, tone });
      // Insert the AI comment, or the error text (for example "high demand") if it failed.
      output = res?.comment || res?.error || "Something went wrong. Please try again.";
    } catch (e) {
      output = "Could not reach the AI service. Please try again later.";
    }

    insertText(editor, output);

    busy = false;
    bar.classList.remove("loading");
    position();
  }
})();