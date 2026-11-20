import type { Story } from "./types";
type Tab = "home" | "stories" | "passed" | "atlas";
const KEY = "pamchenga.answered";
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const hash = (s: string) =>
  [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
const hues = ["ochre", "clay", "leaf", "indigo", "rose"];
const prompts = [
  ["A name", "Who gave you your name, and why that one?"],
  ["A song", "A song from the work you did as a child."],
  ["A proverb", "One your grandmother said, and when she said it."],
  ["A journey", "How your family came to the place you call home."],
  ["A hand", "Something you were taught by watching, not by being told."],
];
const regions: [string, string, string, string][] = [
  [
    "Southern Africa",
    "Malawi, Pamchenga storytelling call",
    "Pamchenga! · Padangokhala! · Tilitonse!",
    "The chant this app is named for: a call-and-response from MBC Radio 1 Malawi.",
  ],
  [
    "East Africa",
    "Swahili opening",
    "Hadithi Hadithi! · Hadithi Njoo!",
    "An opening the app already listens for in transcripts.",
  ],
  [
    "West Africa",
    "Openings from the app's list",
    "Alo o! · Olo o!",
    "Language not labelled in the app yet. Add it with the storyteller.",
  ],
];
function tines(seed: string, n = 13, h = 44) {
  const base = hash(seed);
  return Array.from({ length: n }, (_, i) => {
    const d = Math.abs(i - (n - 1) / 2);
    const v = 0.35 + 0.65 * (1 - d / (n / 2)) * (0.65 + ((base >> i) % 5) / 14);
    return `<i style="height:${Math.round(h * v)}px;animation-delay:${(i * 90) % 900}ms"></i>`;
  }).join("");
}
function pluck() {
  try {
    const A = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )();
    [392, 523.25, 659.25, 587.33, 783.99].forEach((f, i) => {
      const o = A.createOscillator(),
        g = A.createGain(),
        t = A.currentTime + i * 0.14;
      o.type = "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(A.destination);
      o.start(t);
      o.stop(t + 1);
    });
  } catch {
    /* Sound is optional. */
  }
}
export function mountShell(actions: {
  record(): void;
  open(id: string): void;
  importAudio(): void;
}) {
  const root = document.createElement("div");
  root.id = "afro";
  let tab: Tab = "home";
  let list: Story[] = [];
  let answered = false;
  try {
    answered = localStorage.getItem(KEY) === "1";
  } catch {
    /* ignore */
  }
  root.innerHTML = `<div class="a-entry" id="a-entry" ${answered ? "hidden" : ""}><div class="a-band"></div><div class="a-call"><p class="a-kicker">THE CIRCLE IS CALLING</p><h1 id="a-call-word">Pamchenga!</h1><button class="a-drum" id="a-drum" aria-label="Answer the call: Padangokhala"><span class="r r1"></span><span class="r r2"></span><span class="r r3"></span><span class="r r4"></span><span class="core"><b>Padangokhala!</b></span></button><p class="a-hint" id="a-hint">Tap the drum and answer.</p><p class="a-note">A storytelling call from Malawi</p></div><div class="a-mbira" aria-hidden="true">${tines("entry", 17, 70)}</div></div><header class="a-top"><div class="a-logo"><img src="/icon.svg" alt=""><b>Pamchenga</b></div><span class="a-net" id="a-net"></span></header><main id="a-main"></main><nav class="a-tabs" aria-label="Pamchenga"><button data-t="home">${ic("home")}<span>Circle</span></button><button data-t="stories">${ic("ear")}<span>Listen</span></button><button class="a-rec" id="a-rec" aria-label="Record a voice">${ic("mic")}</button><button data-t="passed">${ic("hands")}<span>Passed on</span></button><button data-t="atlas">${ic("sun")}<span>Atlas</span></button></nav>`;
  document.body.append(root);
  const main = root.querySelector<HTMLElement>("#a-main")!;
  const tile = (s: Story) =>
    `<button class="a-tile ${hues[hash(s.language + s.region) % hues.length]}" data-id="${s.id}"><span class="a-lang">${esc(s.language)}</span><span class="a-tines">${tines(s.id, 11, 52)}</span><strong>${esc(s.title)}</strong><em>${esc(s.storyteller)} · ${clock(s.duration)}</em><span class="a-play">▶</span></button>`;
  const empty = (t: string, b: string) =>
    `<div class="a-empty"><div class="a-pulse"><i></i><i></i><i></i></div><h3>${t}</h3><p>${b}</p><button class="a-cta" data-act="rec">Record a voice</button></div>`;
  function draw() {
    root
      .querySelectorAll<HTMLElement>(".a-tabs [data-t]")
      .forEach((b) => b.classList.toggle("on", b.dataset.t === tab));
    const mins = Math.round(list.reduce((n, s) => n + s.duration, 0) / 60);
    const langs = new Set(list.map((s) => s.language.toLowerCase())).size;
    if (tab === "home")
      main.innerHTML = `<section class="a-hero"><div class="a-sun"><i></i><i></i><i></i></div><p class="a-kicker">PASS IT ON</p><h2>Every elder is a library.</h2><p>Open one shelf today. Record a voice before it goes quiet.</p><div class="a-chain" aria-hidden="true"><span><b>Elder</b></span><u></u><span><b>You</b></span><u></u><span><b>Next</b></span></div><button class="a-cta big" data-act="rec">${ic("mic")} Record a voice</button></section><section><h3 class="a-h">Ask them about</h3><div class="a-rail">${prompts.map(([t, b], i) => `<button class="a-prompt p${i % 3}" data-act="rec"><span>${t}</span><p>${b}</p></button>`).join("")}</div></section><section><div class="a-row"><h3 class="a-h">Gathered here</h3><span class="a-count">${list.length ? `${list.length} · ${mins} min · ${langs} ${langs === 1 ? "language" : "languages"}` : ""}</span></div>${list.length ? `<div class="a-rail tiles">${list.slice(0, 8).map(tile).join("")}</div>` : empty("The circle is quiet.", "Bring the first voice. It stays on this phone, even offline.")}</section><section class="a-promise"><div><b>Permission first</b><span>Recording and sharing are separate yes answers.</span></div><div><b>Works offline</b><span>Stored on this device. Export a copy to be safe.</span></div></section>`;
    if (tab === "stories")
      main.innerHTML = `<h2 class="a-title">Listen</h2><p class="a-sub">Voices gathered on this device.</p>${list.length ? `<div class="a-grid">${list.map(tile).join("")}</div>` : empty("Nothing to hear yet.", "Record a story or import audio you already hold with permission.")}<button class="a-ghost" data-act="imp">Import audio</button>`;
    if (tab === "passed")
      main.innerHTML = `<h2 class="a-title">Passed on</h2><p class="a-sub">Each story keeps its origin. Open one to see its fingerprint, permissions and unsigned passport.</p>${list.length ? `<div class="a-list">${list.map((s) => `<button class="a-line" data-id="${s.id}"><span class="a-badge ${hues[hash(s.language + s.region) % hues.length]}">${esc(s.storyteller.slice(0, 1).toUpperCase())}</span><span><strong>${esc(s.title)}</strong><em>from ${esc(s.storyteller)} · ${esc(s.location)}</em></span><u>›</u></button>`).join("")}</div>` : empty("No one has passed anything on yet.", "A passport is made when a story is saved.")}`;
    if (tab === "atlas")
      main.innerHTML = `<h2 class="a-title">Story openings</h2><p class="a-sub">Calls the app already recognises in transcripts. These are examples, not the whole story of any region.</p><div class="a-list">${regions.map(([r, n, c, note], i) => `<div class="a-region r${i}"><span class="a-tines">${tines(r, 15, 40)}</span><small>${r.toUpperCase()}</small><strong>${esc(n)}</strong><em>${esc(c)}</em><small>${esc(note)} ${list.filter((s) => s.region === r).length} in your circle.</small></div>`).join("")}</div>`;
  }
  root.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const act = t.closest<HTMLElement>("[data-act]")?.dataset.act;
    const id = t.closest<HTMLElement>("[data-id]")?.dataset.id;
    const tb = t.closest<HTMLElement>("[data-t]")?.dataset.t as Tab | undefined;
    if (t.closest("#a-rec") || act === "rec") actions.record();
    else if (act === "imp") actions.importAudio();
    else if (id) actions.open(id);
    else if (tb) {
      tab = tb;
      draw();
      scrollTo(0, 0);
    }
  });
  root.querySelector("#a-drum")!.addEventListener("click", () => {
    pluck();
    root.querySelector("#a-call-word")!.textContent = "Tilitonse!";
    root.querySelector("#a-hint")!.textContent = "We are all here.";
    root.querySelector("#a-entry")!.classList.add("answered");
    setTimeout(() => {
      root.querySelector<HTMLElement>("#a-entry")!.hidden = true;
      try {
        localStorage.setItem(KEY, "1");
      } catch {
        /* ignore */
      }
    }, 1400);
  });
  const net = () =>
    (root.querySelector("#a-net")!.innerHTML = navigator.onLine
      ? "<i></i> Saved on this phone"
      : "<i class='off'></i> Offline, still gathering");
  addEventListener("online", net);
  addEventListener("offline", net);
  net();
  draw();
  return {
    update(s: Story[]) {
      list = s;
      draw();
    },
  };
}
function ic(n: string) {
  const p: Record<string, string> = {
    home: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="10.5"/>',
    ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 3.5-3 6.5a2.5 2.5 0 0 1-5 0"/><path d="M10 9a2 2 0 0 1 4 0"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    hands:
      '<circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/><path d="M9 12h6" stroke-dasharray="1.5 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[n]}</svg>`;
}
