import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve("web");
test("Studio sahifasi to‘rtta loyiha turini taklif qiladi",()=>{const html=fs.readFileSync(path.join(root,"studio.html"),"utf8");for(const s of ["portfolio","school","shop","saas"]) assert.ok(html.includes(`data-kind="${s}"`),`missing ${s}`);});
test("Studio HTML/CSS/JS fayllarini ZIP qilish va preview qilishga ega",()=>{const js=fs.readFileSync(path.join(root,"studio/studio.js"),"utf8");for(const s of ["index.html","styles.css","app.js","generateAsync","srcdoc","README.md"]) assert.ok(js.includes(s),`missing ${s}`);});
test("Studio oldingi chat UI o‘rniga emas, alohida sahifa sifatida qo‘shilgan",()=>{assert.ok(fs.existsSync(path.join(root,"index.html")));assert.ok(fs.existsSync(path.join(root,"studio.html")));});
