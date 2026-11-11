// Isolated Chromium/CDP integration checks, following healthLiteracy.browser.mjs.
// Start Vite on 5178 and isolated headless Chromium on debugging port 9236.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const debug = process.env.HL_CDP_URL || "http://127.0.0.1:9236";
const preview = process.env.HL_PREVIEW_URL || "http://127.0.0.1:5178/tests/healthLiteracy.preview.html";
const output = fileURLToPath(new URL("../../.hub-build-check/article-gallery/", import.meta.url));
await mkdir(output, { recursive: true });
const targets = await (await fetch(`${debug}/json/list`)).json();
const socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
await new Promise((done) => socket.addEventListener("open", done, { once: true }));
let sequence = 0;
const pending = new Map();
socket.addEventListener("message", ({ data }) => {
  const result = JSON.parse(data);
  if (!result.id) return;
  const call = pending.get(result.id); pending.delete(result.id);
  if (result.error) call.reject(new Error(result.error.message)); else call.resolve(result.result);
});
const command = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const until = async (expression) => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`Timed out: ${expression}`);
};
const button = (label) => `[...document.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(label)} || e.getAttribute('aria-label') === ${JSON.stringify(label)})`;
const click = async (expression) => { await until(expression); await evaluate(`(${expression}).click()`); };
const fill = (selector, value) => evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const press = async (key, code, windowsVirtualKeyCode) => {
  await command("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode, text: key === "Enter" ? "\r" : undefined });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode });
};
const shot = async (name) => {
  const result = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(`${output}/${name}.png`, Buffer.from(result.data, "base64"));
};
const viewport = (width, height, mobile = false) => command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
const captionStyle = () => evaluate(`(() => {const s=getComputedStyle(document.querySelector('.hl-gallery figcaption'));return Object.fromEntries(['fontFamily','fontSize','lineHeight','marginTop','color','textAlign'].map(k=>[k,s[k]]));})()`);
const navigateArticle = async (slug) => {
  await evaluate(`history.pushState({},'',${JSON.stringify(`/articles/${slug}`)});dispatchEvent(new PopStateEvent('popstate'));`);
  await until("document.querySelector('.hl-reading .hl-gallery')");
};
const upload = async (selector, filename = "same.png") => {
  const { root } = await command("DOM.getDocument");
  const { nodeId } = await command("DOM.querySelector", { nodeId: root.nodeId, selector });
  await command("DOM.setFileInputFiles", { nodeId, files: [`${output}/${filename}`] });
};
const editButtons = (title) => `([...document.querySelectorAll('.hl-article-card')].find(e=>e.querySelector('h3')?.textContent===${JSON.stringify(title)})?.querySelectorAll('button') || [])`;
const edit = editButtons("Uploaded gallery with captions");
const openEdit = async () => { await click(`[...${edit}].find(e=>e.textContent.trim()==='Edit')`); await until("document.querySelector('#caption-edit-first')"); };

const checkAdminCards = async () => {
  await command("Page.navigate", { url: `${preview}?scenario=article-cards` });
  await until("document.querySelectorAll('.hl-article-card').length === 6");
  await until("[...document.querySelectorAll('.hl-article-card img')].every(e => e.complete && e.naturalWidth > 0)");
  const cards = "[...document.querySelectorAll('.hl-article-card')]";
  assert.equal(await evaluate(`${cards}.every(e => e.querySelectorAll('img').length === 1)`), true);
  assert.equal(await evaluate(`${cards}[0].querySelector('img').alt`), "A complete portrait illustration");
  assert.equal(await evaluate(`${cards}[0].querySelector('img').src.endsWith('health-literacy-tall.svg')`), true);
  assert.equal(await evaluate(`${cards}[1].querySelector('img').alt`), "", "Explicit decorative alt stays empty");
  assert.equal(await evaluate(`${cards}[1].querySelector('.hl-article-card-cover').getAttribute('aria-label')`), "Read article: Read-only article with a decorative image");
  assert.equal(await evaluate(`${cards}[1].querySelectorAll('.hl-article-card-actions button').length`), 1, "Read-only card offers Share without Edit");
  assert.equal(await evaluate(`${cards}[2].querySelector('img').alt`), "Stored main image description");
  assert.equal(await evaluate(`${cards}[3].querySelector('img').src.endsWith('generic-article.png?legacy')`), true);
  for (const i of [4, 5]) assert.equal(await evaluate(`${cards}[${i}].querySelector('img').src.endsWith('/assets/articles/generic-article.png')`), true);

  for (const width of [1440, 1024, 768, 576, 390, 320]) {
    await viewport(width, 1000, width < 768);
    const layouts = await evaluate(`${cards}.map(e => {
      const box = node => { const r = node.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
      const title = e.querySelector('h3'), summary = e.querySelector('.hl-article-card-content > p');
      return {card:box(e),cover:box(e.querySelector('.hl-article-card-cover')),content:box(e.querySelector('.hl-article-card-content')),
        title:box(title),summary:box(summary),read:box([...e.querySelectorAll('button')].find(b=>b.textContent==='Read Article')),
        actions:[...e.querySelectorAll('.hl-article-card-actions button')].map(box),
        fit:getComputedStyle(e.querySelector('img')).objectFit};
    })`);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, `No overflow at ${width}px`);
    for (const layout of layouts) {
      assert.ok(Math.abs(layout.cover.width / layout.cover.height - 4 / 3) < .01);
      assert.equal(layout.fit, "contain", "Unclassified artwork stays complete, including portrait images");
      assert.ok(layout.summary.y >= layout.title.bottom && layout.read.y >= layout.summary.bottom);
      assert.ok(layout.read.height >= 44);
      for (const action of layout.actions) {
        assert.ok(action.height >= 44 && action.x >= layout.content.x && action.right <= layout.card.right);
        if (width >= 768) assert.equal(action.y, layout.title.y, "Header actions align with title top");
      }
      if (width >= 768) {
        assert.equal(layout.cover.width, 200);
        assert.ok(layout.content.x > layout.cover.right);
      } else assert.ok(layout.content.y > layout.cover.bottom);
    }
    assert.ok(layouts[0].title.height > 52, "Long title wraps");
    await evaluate("scrollTo(0,0)");
    if ([1440, 390, 320].includes(width)) await shot(`admin-cards-${width}`);
  }

  const styles = await evaluate(`(() => {
    const style = label => {const e=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label),s=getComputedStyle(e);
      return {background:s.backgroundColor,color:s.color,font:s.fontSize,weight:s.fontWeight,padding:s.padding,height:e.getBoundingClientRect().height};};
    return {read:style('Read Article'),watch:style('Watch Video'),share:style('Share'),edit:style('Edit')};
  })()`);
  assert.deepEqual(styles.read, styles.watch, "Article/video primary actions share size and variant");
  assert.deepEqual(styles.share, styles.edit, "Secondary actions share size and variant");
  assert.equal(styles.read.background, "rgb(50, 65, 140)");
  assert.equal(styles.share.background, "rgb(255, 255, 255)");

  await viewport(1440, 1000);
  await evaluate("document.querySelector('#root > .hl-hub').style.width = '540px'");
  assert.equal(await evaluate(`(() => {const card=${cards}[0];return card.querySelector('.hl-article-card-content').getBoundingClientRect().top > card.querySelector('.hl-article-card-cover').getBoundingClientRect().bottom;})()`), true, "Constrained desktop cards stack within an expanded sidebar layout");
  assert.equal(await evaluate(`${cards}.every(e => [...e.querySelectorAll('button')].every(b => b.getBoundingClientRect().right <= e.getBoundingClientRect().right))`), true);
  await shot("admin-cards-constrained-desktop");
  await evaluate("document.querySelector('#root > .hl-hub').style.width = ''");
  await evaluate("document.querySelector('.hl-article-card-cover').focus()");
  await press("Enter", "Enter", 13);
  for (const label of ["Share", "Edit", "Read Article"]) {
    await press("Tab", "Tab", 9);
    assert.equal(await evaluate("document.activeElement.textContent.trim()"), label);
    assert.equal(await evaluate("document.activeElement.matches(':focus-visible')"), true);
    assert.equal(await evaluate("(() => {const s=getComputedStyle(document.activeElement);return s.outlineStyle!=='none' || s.boxShadow!=='none';})()"), true);
    if (label === "Edit") await press(" ", "Space", 32); else await press("Enter", "Enter", 13);
  }
  assert.deepEqual(await evaluate("__hlCardActions"), [
    { action: "open", id: "long-gallery", galleryCount: 2 },
    { action: "share", id: "long-gallery", galleryCount: 2 },
    { action: "edit", id: "long-gallery", galleryCount: 2 },
    { action: "open", id: "long-gallery", galleryCount: 2 },
  ], "Keyboard actions keep the original item and its full gallery");
  await click(button("Watch Video"));
  await click("document.querySelector('.hl-video-card').parentElement.parentElement.querySelector('.prod-btn-secondary')");
  assert.deepEqual((await evaluate("__hlCardActions")).slice(-2).map(({ action, id }) => ({ action, id })), [
    { action: "open", id: "fixture-video" }, { action: "edit", id: "fixture-video" },
  ]);
  // Even a missing generic fallback keeps a stable frame and accessible opening action.
  await evaluate(`${cards}[5].querySelector('img').dispatchEvent(new Event('error'))`);
  await until(`${cards}[5].querySelector('.hl-article-card-cover').textContent === 'Article image unavailable'`);
  assert.equal(await evaluate(`${cards}[5].querySelectorAll('img').length`), 0);
};

try {
  await command("Page.enable");
  await viewport(1440, 1000);
  await checkAdminCards();
  await command("Page.navigate", { url: `${preview}?scenario=gallery-public` });
  await until("document.querySelector('.article-item')");
  await navigateArticle("uploaded-gallery-with-captions-fixture-gallery");
  const desktopStyle = await captionStyle();
  assert.equal(await evaluate("document.querySelectorAll('.hl-gallery figure').length"), 2);
  assert.equal(await evaluate("document.querySelector('.hl-gallery img').alt"), "First accessible description");
  assert.equal(await evaluate("document.querySelector('.hl-gallery figcaption').textContent"), "First creator caption");
  await evaluate("document.querySelector('.hl-gallery').scrollIntoView({block:'center'})");
  await shot("uploaded-desktop");
  await click("document.querySelector('.hl-gallery button')");
  await until("document.querySelector('dialog[open]')");
  assert.equal(await evaluate("document.querySelector('.hl-photo-information > .hl-description').textContent"), "First creator caption");
  await click(button("Next image"));
  await until("document.querySelector('.hl-photo-information > .hl-description').textContent === 'Second creator caption'");
  await shot("viewer-desktop");
  await press("Escape", "Escape", 27);
  await until("!document.querySelector('dialog[open]')");
  const staticArticles = JSON.parse(await readFile(new URL("../src/assets/data/articles.json", import.meta.url), "utf8"));
  const bundled = staticArticles.find((article) => article.galleryImages?.length);
  await navigateArticle(bundled.articleSlug);
  assert.deepEqual(await captionStyle(), desktopStyle, "Uploaded captions match static gallery typography, color, spacing, alignment");
  await evaluate("document.querySelector('.hl-gallery').scrollIntoView({block:'center'})");
  await shot("static-desktop");
  await viewport(390, 844, true);
  const mobileStyle = await captionStyle();
  await shot("static-mobile");
  await navigateArticle("uploaded-gallery-with-captions-fixture-gallery");
  assert.deepEqual(await captionStyle(), mobileStyle);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.hl-gallery')).gridTemplateColumns.split(' ').length"), 1);
  await evaluate("document.querySelector('.hl-gallery').scrollIntoView({block:'center'})");
  await shot("uploaded-mobile");
  await click("document.querySelector('.hl-gallery button')");
  await until("document.querySelector('dialog[open] .hl-photo-information')");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
  await shot("viewer-mobile");

  await viewport(1440, 1000);
  await command("Page.navigate", { url: `${preview}?scenario=gallery-hub` });
  await until("document.querySelector('.hl-hub h3')");
  await click(`[...${edit}].find(e=>e.textContent.trim()==='Read Article')`);
  await until("document.querySelector('dialog[open] .hl-prose')");
  await until("__hlRequests.filter(r=>r.path.endsWith('/analytics/events')).length === 1");
  assert.match(await evaluate("document.querySelector('dialog[open]').textContent"), /A separate short preview for review/);
  assert.match(await evaluate("document.querySelector('dialog[open] .hl-prose').textContent"), /Creator captions and public comments stay separate/);
  await click(button("Next image"));
  await until("document.querySelector('.hl-photo-information > .hl-description').textContent === 'Second creator caption'");
  await press("Escape", "Escape", 27);
  await until("!document.querySelector('dialog[open]')");
  await click(`[...${edit}].find(e=>e.classList.contains('hl-article-card-cover'))`);
  await until("document.querySelector('dialog[open] .hl-prose')");
  await until("__hlRequests.filter(r=>r.path.endsWith('/analytics/events')).length === 2");
  await press("Escape", "Escape", 27);
  await until("!document.querySelector('dialog[open]')");
  await evaluate("Object.defineProperty(navigator,'share',{configurable:true,value:async value=>window.__hlShared=value})");
  await click(`[...${edit}].find(e=>e.textContent.trim()==='Share')`);
  await until("window.__hlShared");
  assert.equal(await evaluate("__hlShared.url"), "https://example.test/article-fixture");
  await evaluate("Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>window.__hlCopied=value}})");
  await click(`[...${edit}].find(e=>e.textContent.trim()==='Share')`);
  await until("window.__hlCopied");
  assert.equal(await evaluate("__hlCopied"), "https://example.test/article-fixture");
  await click(button("Create New Content"));
  await until("document.querySelector('#gallery-add-create')");
  assert.equal(await evaluate("document.querySelector('.hl-attachment-editor').open"), false);
  assert.equal(await evaluate("Boolean(document.querySelector('.hl-gallery-editor').compareDocumentPosition(document.querySelector('.hl-attachment-editor')) & Node.DOCUMENT_POSITION_FOLLOWING)"), true);
  await evaluate("document.querySelector('.hl-gallery-editor').scrollIntoView({block:'center'})");
  await shot("simplified-upload-desktop");
  await viewport(390, 844, true);
  await evaluate("document.querySelector('.hl-gallery-editor').scrollIntoView({block:'start'})");
  await shot("simplified-upload-mobile");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
  await viewport(1440, 1000);
  await click(button("Cancel"));
  await until("!document.querySelector('#gallery-add-create')");
  await openEdit();
  assert.equal(await evaluate("document.querySelector('[name=shortPreview]').value"), "A separate short preview for review.");
  await fill("[name=shortPreview]", "Reviewed short preview");
  assert.equal(await evaluate("document.querySelector('.hl-attachment-editor').open"), false);
  assert.match(await evaluate("document.querySelector('.hl-gallery-editor [role=status]').textContent"), /2 of 10 images added/);
  await click("document.querySelector('.hl-attachment-editor summary')");
  await until("document.querySelector('.hl-attachment-editor').open");
  await evaluate(`(() => { const transfer = new DataTransfer(); transfer.items.add(new File(['image'],'photo.png',{type:'image/png'})); document.querySelector('.hl-attachment-editor .hl-file-picker').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer})); })()`);
  await until("document.querySelector('.hl-attachment-editor [role=alert]')");
  assert.match(await evaluate("document.querySelector('.hl-attachment-editor [role=alert]').textContent"), /Use Add images above/);
  await click("document.querySelector('.hl-attachment-editor summary')");
  await until("!document.querySelector('.hl-attachment-editor').open");
  // The gallery supports multiple files by drag and drop, using the same picker.
  await evaluate(`(() => { const transfer = new DataTransfer(); transfer.items.add(new File(['one'],'same.png',{type:'image/png'})); transfer.items.add(new File(['two'],'same.png',{type:'image/png'})); document.querySelector('.hl-gallery-editor .hl-file-picker').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer})); })()`);
  await until("document.querySelectorAll('ol li textarea').length === 4");
  await click(button("Remove image 4"));
  await click(button("Remove image 3"));
  await fill("#caption-edit-first", "Edited creator caption <plain text>");
  await fill("#alt-edit-first", "Independent accessible description");
  await click("document.querySelector('#decorative-edit-first')");
  assert.equal(await evaluate("document.querySelector('#alt-edit-first').disabled"), true);
  assert.equal(await evaluate("document.querySelector('#alt-edit-first').value"), "");
  await click("document.querySelector('#decorative-edit-first')");
  assert.equal(await evaluate("document.querySelector('#alt-edit-first').value"), "Independent accessible description");
  await evaluate(`(${button("Move image 2 up")}).focus()`);
  await press("Enter", "Enter", 13);
  await until("document.querySelector('ol li textarea').id === 'caption-edit-second'");
  assert.equal(await evaluate("document.querySelector('#caption-edit-first').value"), "Edited creator caption <plain text>");
  await shot("editor-desktop");
  await click(button("Save"));
  await until("!document.querySelector('#caption-edit-first')");
  await openEdit();
  assert.equal(await evaluate("document.querySelector('[name=shortPreview]').value"), "Reviewed short preview");
  assert.equal(await evaluate("document.querySelector('[name=description]').value"), "Creator captions and public comments stay separate.");
  assert.equal(await evaluate("document.querySelector('ol li textarea').id"), "caption-edit-second");
  assert.equal(await evaluate("document.querySelector('#caption-edit-first').value"), "Edited creator caption <plain text>");
  assert.equal(await evaluate("document.querySelector('#alt-edit-first').value"), "Independent accessible description");
  await writeFile(`${output}/same.png`, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"));
  await upload("#replace-edit-first");
  await until("document.querySelector('[role=status]').textContent.includes('replaced') || [...document.querySelectorAll('[role=status]')].some(e=>e.textContent.includes('replaced'))");
  assert.equal(await evaluate("document.querySelector('#caption-edit-first').value"), "Edited creator caption <plain text>");
  await upload("#gallery-add-edit");
  await until("document.querySelectorAll('ol li textarea').length === 3");
  await click(button("Remove image 1"));
  await until("document.querySelectorAll('ol li textarea').length === 2");
  await click(button("Save"));
  await until("!document.querySelector('#caption-edit-first')");
  await openEdit();
  assert.equal(await evaluate("document.querySelectorAll('ol li textarea').length"), 2);
  assert.equal(await evaluate("document.querySelector('ol li textarea').value"), "Edited creator caption <plain text>");
  await click(button("Remove image 2"));
  await until("document.querySelectorAll('ol li textarea').length === 1");
  assert.equal(await evaluate("document.querySelector('ol li textarea').value"), "Edited creator caption <plain text>");
  await click(button("Save"));
  await until("!document.querySelector('#caption-edit-first')");
  await openEdit();
  assert.equal(await evaluate("document.querySelectorAll('ol li textarea').length"), 1);
  await click("document.querySelector('#decorative-edit-first')");
  await click(button("Save"));
  await until("!document.querySelector('#caption-edit-first')");
  await openEdit();
  assert.equal(await evaluate("document.querySelector('#decorative-edit-first').checked"), true);
  assert.equal(await evaluate("document.querySelector('#alt-edit-first').disabled"), true);
  assert.equal(await evaluate("document.querySelector('#caption-edit-first').value"), "Edited creator caption <plain text>");
  await viewport(390, 844, true);
  await evaluate("document.querySelector('#caption-edit-first').scrollIntoView({block:'center'})");
  await shot("editor-mobile");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
  await click(button("Cancel"));
  await until("!document.querySelector('#caption-edit-first')");
  const openPdf = async () => {
    await click(`[...${editButtons("Article with a PDF document")}].find(e=>e.textContent.trim()==='Edit')`);
    await until("document.querySelector('.hl-attachment-editor[open]')");
  };
  await openPdf();
  assert.equal(await evaluate("document.querySelector('.hl-upload-preview').textContent"), "guide.pdf");
  await writeFile(`${output}/support.pdf`, "%PDF-1.7\nBrowser fixture");
  await upload("#health-literacy-media-upload-edit", "support.pdf");
  await until("document.querySelector('.hl-upload-preview').textContent === 'support.pdf'");
  await evaluate("document.querySelector('.hl-attachment-editor').scrollIntoView({block:'center'})");
  await shot("attachment-mobile");
  await click(button("Save"));
  await until("!document.querySelector('#gallery-add-edit')");
  await openPdf();
  assert.equal(await evaluate("document.querySelector('.hl-upload-preview').textContent"), "support.pdf");
  console.log("PASS: admin cards at 320–1440px and constrained desktop widths, image selection/fallbacks/alt, shared button variants, keyboard actions, opening/sharing/editing/analytics, full galleries, upload/edit regressions, and public galleries/viewers.");
} finally { socket.close(); }
