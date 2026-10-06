(() => {
  "use strict";
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  // True for empty values or untouched bracket placeholders like [PROJECT_1_GITHUB_URL]
  const isPlaceholder = (v) => !v || /^\s*\[[A-Z0-9_]+\]\s*$/.test(v);

  /* ---------- Sticky header state ---------- */
  function initHeader() {
    const header = $(".site-header");
    if (!header) return;
    let scrolled = false;
    const update = () => {
      const next = window.scrollY > 10;
      if (next !== scrolled) { scrolled = next; header.classList.toggle("scrolled", next); }
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  /* ---------- Mobile menu ---------- */
  function initMenu() {
    const btn = $(".menu-btn"), menu = $("#nav-menu");
    if (!btn || !menu) return;
    const setOpen = (open) => {
      menu.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
    };
    btn.addEventListener("click", () => setOpen(btn.getAttribute("aria-expanded") !== "true"));
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") { setOpen(false); btn.focus(); }
    });
    window.matchMedia("(min-width:768px)").addEventListener("change", (e) => { if (e.matches) setOpen(false); });
  }

  /* ---------- Active section highlighting ---------- */
  function initActiveNav() {
    const links = $$(".nav-menu a");
    if (!links.length || !("IntersectionObserver" in window)) return;
    const map = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.removeAttribute("aria-current"));
        const active = map.get(entry.target.id);
        if (active) active.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) observer.observe(s); });
  }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    const items = $$(".reveal");
    if (!("IntersectionObserver" in window)) { items.forEach((el) => el.classList.add("in")); return; }
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add("in"); obs.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    items.forEach((el) => observer.observe(el));
  }

  /* ---------- Image fallbacks ---------- */
  function initImages() {
    $$("img[data-fallback]").forEach((img) => {
      const hide = () => { img.hidden = true; };
      img.addEventListener("error", hide);
      if (img.complete && img.naturalWidth === 0) hide();
    });
  }

  /* ---------- Project modal ---------- */
  function initModal() {
    const modal = $("#project-modal");
    if (!modal || typeof modal.showModal !== "function") return;
    const img = $("#modal-img"), link = $("#modal-link");

    const open = (card) => {
      const srcImg = $(".media img", card);
      $("#modal-title").textContent = $("h3", card).textContent;
      $("#modal-cat").textContent = $(".cat", card).textContent;
      $("#modal-status").textContent = $(".status", card).textContent;
      $("#modal-detail").innerHTML = $(".p-detail", card).innerHTML;
      $("#modal-tags").innerHTML = $(".tags", card).innerHTML;
      $("#modal-fallback").innerHTML = $(".fallback", card).innerHTML;

      img.hidden = srcImg.hidden;
      img.src = srcImg.getAttribute("src");
      img.alt = srcImg.alt;
      img.onerror = () => { img.hidden = true; };

      const url = card.dataset.link;
      if (isPlaceholder(url)) { link.hidden = true; link.removeAttribute("href"); }
      else { link.hidden = false; link.href = url; link.textContent = card.dataset.linkLabel || "View project"; }

      document.body.classList.add("lock");
      modal.showModal(); // native dialog: focus trap, inert background, focus restored on close
    };

    $$(".project").forEach((card) => {
      const btn = $(".open", card);
      if (btn) btn.addEventListener("click", () => open(card));
    });
    $(".modal-close", modal).addEventListener("click", () => modal.close());
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); }); // backdrop click
    modal.addEventListener("close", () => document.body.classList.remove("lock"));
  }

  /* ---------- Copy email ---------- */
  function initCopyEmail() {
    const btn = $("#copy-email"), note = $("#copy-note");
    if (!btn) return;
    const original = btn.textContent;
    let timer;
    btn.addEventListener("click", async () => {
      clearTimeout(timer);
      try {
        if (!navigator.clipboard || !window.isSecureContext) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(btn.dataset.email);
        btn.textContent = "Copied!";
        if (note) note.textContent = "";
      } catch (err) {
        if (note) note.textContent = "Copy unavailable — use the email address above.";
      }
      timer = setTimeout(() => {
        btn.textContent = original;
        if (note) note.textContent = "";
      }, 2500);
    });
  }

    /* ---------- Cursor spotlight ---------- */
  function initSpotlight() {
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canHover || reduced) return; // skip touch devices and reduced-motion users

    const glow = document.createElement("div");
    glow.className = "spotlight";
    glow.setAttribute("aria-hidden", "true");
    document.body.appendChild(glow);

    let x = 0, y = 0, queued = false;
    const paint = () => {
      glow.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      queued = false;
    };
    document.addEventListener("pointermove", (e) => {
      x = e.clientX; y = e.clientY;
      glow.classList.add("on");
      if (!queued) { queued = true; requestAnimationFrame(paint); } // at most one update per frame
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", () => glow.classList.remove("on"));
  }

  /* ---------- Resume availability ---------- */
  function initResume() {
    if (!/^https?:$/.test(location.protocol) || !window.fetch) return; // file:// can't be checked
    $$("[data-resume]").forEach((a) => {
      fetch(a.getAttribute("href"), { method: "HEAD" })
        .then((res) => { if (!res.ok) throw new Error("missing"); })
        .catch(() => {
          a.removeAttribute("href");
          a.removeAttribute("download");
          a.setAttribute("aria-disabled", "true");
          a.textContent = "Resume coming soon";
        });
    });
  }

  /* ---------- Init ---------- */
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
    initHeader(); initMenu(); initActiveNav(); initReveal();
  initImages(); initModal(); initCopyEmail(); initResume(); initSpotlight();
})();