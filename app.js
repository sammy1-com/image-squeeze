const $ = (s) => document.querySelector(s);

let files = [];
let runId = 0;

const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(2) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const ext = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" };

async function squeeze(file, type, quality, maxW) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width);
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); } // no alpha in jpeg
  ctx.drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise((res) => canvas.toBlob(res, type, quality));
  return { blob, w, h, ow: bmp.width, oh: bmp.height };
}

async function process() {
  const id = ++runId;
  const type = $("#format").value;
  const quality = $("#quality").value / 100;
  const maxW = Math.max(100, +$("#maxw").value || 1600);
  const box = $("#results");
  box.innerHTML = "";
  let before = 0, after = 0;
  const links = [];

  for (const file of files) {
    let r;
    try { r = await squeeze(file, type, quality, maxW); } catch (e) { continue; }
    if (id !== runId) return; // settings changed while we were working
    before += file.size; after += r.blob.size;
    const url = URL.createObjectURL(r.blob);
    const name = file.name.replace(/\.[^.]+$/, "") + "-small." + ext[type];
    const pct = Math.round((1 - r.blob.size / file.size) * 100);
    links.push({ url, name });
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `<img src="${url}" alt="">
      <div><div class="name"></div>
      <div class="meta">${kb(file.size)} → <b class="${pct < 0 ? "bad" : ""}">${kb(r.blob.size)}</b> (${pct >= 0 ? "−" : "+"}${Math.abs(pct)}%) · ${r.ow}×${r.oh} → ${r.w}×${r.h}</div></div>
      <a href="${url}" download="${name}">Download</a>`;
    el.querySelector(".name").textContent = file.name;
    box.appendChild(el);
  }

  const sum = $("#summary");
  if (!links.length) { sum.hidden = true; return; }
  sum.hidden = false;
  sum.innerHTML = `<span>${links.length} image${links.length > 1 ? "s" : ""}: <b>${kb(before)}</b> → <b>${kb(after)}</b></span>${links.length > 1 ? `<button id="all">Download all</button>` : ""}`;
  const all = $("#all");
  if (all) all.onclick = () => links.forEach((l, i) => setTimeout(() => {
    const a = document.createElement("a"); a.href = l.url; a.download = l.name; a.click();
  }, i * 250));
}

function take(list) {
  files = [...list].filter((f) => f.type.startsWith("image/"));
  process();
}

$("#files").addEventListener("change", (e) => take(e.target.files));
const drop = $("#drop");
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => take(e.dataTransfer.files));

$("#quality").addEventListener("input", (e) => {
  $("#q-out").textContent = e.target.value + "%";
  if (files.length) process();
});
["maxw", "format"].forEach((id) => $("#" + id).addEventListener("change", () => files.length && process()));
