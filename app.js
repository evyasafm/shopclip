(() => {
  const PRODUCTS = [
    { id: "mug", src: "items/mug.jpg", name: "Stoneware mug", price: "$24" },
    { id: "sneakers", src: "items/sneakers.jpg", name: "Court sneakers", price: "$89" },
    { id: "candle", src: "items/candle.jpg", name: "Soy candle", price: "$18" },
    { id: "earrings", src: "items/earrings.jpg", name: "Gold hoops", price: "$42" },
    { id: "tote", src: "items/tote.jpg", name: "Canvas tote", price: "$32" },
    { id: "skincare", src: "items/skincare.jpg", name: "Daily serum", price: "$28" },
  ];
  const ROUTES = ["camera", "library", "confirm", "paywall", "generating", "play", "share", "clips", "account"];
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    product: { ...PRODUCTS[0] },
    style: "orbit",
    usedFree: false,
    subscribed: false,
    clips: PRODUCTS.slice(0, 4).map((p, i) => ({
      ...p,
      id: "seed-" + p.id,
      style: ["orbit", "studio", "lifestyle", "orbit"][i],
    })),
    from: "library",
    objectUrl: null,
  };

  try {
    const saved = JSON.parse(localStorage.getItem("shopclip-demo") || "null");
    if (saved && typeof saved.usedFree === "boolean") {
      state.usedFree = saved.usedFree;
      state.subscribed = !!saved.subscribed;
    }
  } catch {}

  function persist() {
    try {
      localStorage.setItem(
        "shopclip-demo",
        JSON.stringify({ usedFree: state.usedFree, subscribed: state.subscribed })
      );
    } catch {}
  }

  function clipsLeft() {
    if (state.subscribed) return 20;
    return state.usedFree ? 0 : 1;
  }

  function hasNativeCamera() {
    const ua = navigator.userAgent || "";
    const touch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
    return touch && /iPhone|iPad|iPod|Android/i.test(ua);
  }

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("on");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("on"), 1600);
  }

  function setProduct(p) {
    state.product = { ...p };
    $$(".hero-photo").forEach((img) => {
      img.src = p.src;
      img.alt = p.name;
    });
    const name = $("#name");
    const price = $("#price");
    if (name && document.activeElement !== name) name.value = p.name || "";
    if (price && document.activeElement !== price) price.value = p.price || "";
    $$(".listing .nm").forEach((n) => (n.textContent = p.name || "Listing"));
    $$(".listing .pr").forEach((n) => (n.textContent = p.price || ""));
    const thumb = $("#gallery-thumb-img");
    if (thumb) thumb.src = p.src;
  }

  function renderLibrary() {
    const grid = $("#lib-grid");
    grid.innerHTML = "";
    PRODUCTS.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lib-cell";
      btn.setAttribute("aria-label", p.name);
      btn.innerHTML = `<img src="${p.src}" alt="${p.name}">`;
      btn.addEventListener("click", () => {
        state.from = "library";
        setProduct(p);
        go("confirm");
      });
      grid.appendChild(btn);
    });
  }

  function renderClips() {
    const grid = $("#clips-grid");
    grid.innerHTML = "";
    const list = state.clips.length ? state.clips : PRODUCTS.slice(0, 2).map((p) => ({ ...p, style: "orbit" }));
    list.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "clip-card";
      btn.innerHTML = `<img src="${c.src}" alt="${c.name}"><span class="dur">0:06</span><span class="meta">${c.name}</span>`;
      btn.addEventListener("click", () => {
        setProduct(c);
        if (c.style) state.style = c.style;
        syncChips();
        go("play");
      });
      grid.appendChild(btn);
    });
  }

  function syncChips() {
    $$(".chip").forEach((c) => c.classList.toggle("on", c.dataset.style === state.style));
    const card = $("#orbit-card");
    if (card) {
      card.classList.remove("style-orbit", "style-studio", "style-lifestyle");
      card.classList.add("style-" + state.style);
    }
  }

  function syncQuota() {
    const n = clipsLeft();
    const confirmFine = $("#confirm-fine");
    if (confirmFine) {
      confirmFine.textContent = n === 1 ? "1 free clip left" : n > 0 ? `${n} clips left` : "Upgrade to keep clipping";
    }
    const playNote = $("#play-left");
    if (playNote) {
      playNote.textContent = state.subscribed ? "20 clips left" : "19 clips left";
    }
    const acc = $("#acct-left");
    if (acc) acc.textContent = state.subscribed ? "20 / 20" : state.usedFree ? "0 free" : "1 free";
    const plan = $("#acct-plan");
    if (plan) plan.textContent = state.subscribed ? "Pro · $9.99/mo" : "Free";
  }

  let genRaf = 0;
  let playRaf = 0;

  function startGenerating() {
    const fill = $("#gen-fill");
    if (fill) fill.style.width = "0%";
    const t0 = performance.now();
    const dur = 4000;
    cancelAnimationFrame(genRaf);
    const tick = (now) => {
      if (currentRoute() !== "generating") return;
      const p = Math.min(1, (now - t0) / dur);
      if (fill) fill.style.width = p * 100 + "%";
      if (p < 1) genRaf = requestAnimationFrame(tick);
      else finishGenerating();
    };
    genRaf = requestAnimationFrame(tick);
  }

  function finishGenerating() {
    if (!state.clips.some((c) => c.src === state.product.src && c.name === (state.product.name || $("#name")?.value))) {
      const made = {
        ...state.product,
        name: $("#name")?.value || state.product.name,
        price: $("#price")?.value || state.product.price,
        style: state.style,
        id: "clip-" + Date.now(),
      };
      state.clips.unshift(made);
      state.product = made;
    }
    if (!state.usedFree) {
      state.usedFree = true;
      persist();
    }
    renderClips();
    go("play");
  }

  function startPlayback() {
    const fill = $("#play-fill");
    const tlabel = $("#play-t");
    const dur = 6000;
    cancelAnimationFrame(playRaf);
    const loop = (now) => {
      const r = currentRoute();
      if (r !== "play" && r !== "share") return;
      const p = (now % dur) / dur;
      if (fill) fill.style.width = p * 100 + "%";
      if (tlabel) tlabel.textContent = "0:0" + Math.min(5, Math.floor(p * 6));
      playRaf = requestAnimationFrame(loop);
    };
    playRaf = requestAnimationFrame(loop);
  }

  function currentRoute() {
    const h = (location.hash || "#camera").slice(1).split("?")[0];
    return ROUTES.includes(h) ? h : "camera";
  }

  function go(name) {
    if (location.hash === "#" + name) applyRoute(name);
    else location.hash = name;
  }

  function setScreen(name) {
    $$(".screen").forEach((s) => s.classList.toggle("active", s.dataset.screen === (name === "share" ? "play" : name)));
    const sheet = $("#share-sheet");
    const scrim = $("#sheet-scrim");
    const onShare = name === "share";
    sheet.classList.toggle("on", onShare);
    scrim.classList.toggle("on", onShare);
    $$(".tab").forEach((t) => t.classList.toggle("on", t.dataset.tab === name));
  }

  function applyRoute(name) {
    const nameEl = $("#name");
    const priceEl = $("#price");
    if (nameEl && nameEl.value) state.product.name = nameEl.value;
    if (priceEl && priceEl.value) state.product.price = priceEl.value;
    setProduct(state.product);
    syncChips();
    syncQuota();

    const swap = () => {
      setScreen(name);
      if (name === "generating") startGenerating();
      if (name === "play" || name === "share") startPlayback();
      if (name === "clips") renderClips();
    };

    if (document.startViewTransition && !reduceMotion) {
      document.startViewTransition(swap);
    } else swap();
  }

  function onHash() {
    applyRoute(currentRoute());
  }

  function onShutter() {
    const btn = $("#shutter");
    btn.classList.remove("bounce");
    void btn.offsetWidth;
    btn.classList.add("bounce");
    if (hasNativeCamera()) {
      $("#camFile").click();
    } else {
      state.from = "library";
      go("library");
    }
  }

  function onPickedFile(file) {
    if (!file) return;
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = URL.createObjectURL(file);
    setProduct({
      id: "capture",
      src: state.objectUrl,
      name: "New listing",
      price: "",
    });
    $("#name").value = "";
    $("#price").value = "";
    state.from = "camera";
    go("confirm");
  }

  function makeClip() {
    const n = $("#name");
    const p = $("#price");
    state.product.name = n.value || state.product.name;
    state.product.price = p.value || state.product.price;
    if (state.usedFree && !state.subscribed) {
      go("paywall");
      return;
    }
    go("generating");
  }

  function bind() {
    $("#shutter").addEventListener("click", onShutter);
    $("#gallery-thumb").addEventListener("click", () => {
      state.from = "library";
      go("library");
    });
    $("#camFile").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      onPickedFile(f);
      e.target.value = "";
    });
    $("#lib-cancel").addEventListener("click", () => go("camera"));
    $("#confirm-back").addEventListener("click", () => go(state.from === "camera" ? "camera" : "library"));
    $$(".chip").forEach((c) =>
      c.addEventListener("click", () => {
        state.style = c.dataset.style;
        syncChips();
      })
    );
    $("#make").addEventListener("click", makeClip);
    $("#pay-close").addEventListener("click", () => go(state.usedFree ? "confirm" : "camera"));
    $("#pay-start").addEventListener("click", () => {
      state.subscribed = true;
      persist();
      syncQuota();
      go("generating");
    });
    $("#pay-restore").addEventListener("click", () => {
      toast("No purchases to restore");
    });
    $("#share-btn").addEventListener("click", () => go("share"));
    $("#new-btn").addEventListener("click", () => go("camera"));
    $("#sheet-scrim").addEventListener("click", () => go("play"));
    $("#share-cancel").addEventListener("click", () => go("play"));
    $$(".share-app").forEach((b) =>
      b.addEventListener("click", async () => {
        const dest = b.dataset.dest;
        const title = state.product.name || "Shopclip";
        const text = `${title} · ${state.product.price || ""} — listing clip from Shopclip`.trim();
        if (dest === "save") {
          toast("Saved to Photos");
          return;
        }
        if (navigator.share) {
          try {
            await navigator.share({ title, text });
          } catch {}
        } else {
          toast(dest === "tiktok" ? "Open TikTok to post" : dest === "reels" ? "Open Reels to post" : "Open Etsy to list");
        }
      })
    );
    window.addEventListener("hashchange", onHash);
  }

  renderLibrary();
  renderClips();
  setProduct(state.product);
  bind();
  onHash();
})();
