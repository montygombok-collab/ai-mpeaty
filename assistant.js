/* =========================================
   SHAHRAZAD ELECTRIC - assistant.js
   المساعد الذكي المحلي (NLP صغير للعربية)
   يعتمد على دوال database.js (Firestore)
========================================= */

/*
  متطلبات:
   - وجود js/database.js الذي يصدّر: getAllRecords(collectionName), getLowStockProducts(threshold), getRecordById(collectionName,id) (اختياري)
   - index.html يحتوي على الأنماط اللازمة أو استخدم الأنماط المضمّنة في index.html
*/

import { getAllRecords, getLowStockProducts, getRecordById } from "./database.js";

/* ------------------ واجهة المستخدم البسيطة ------------------ */
const assistantBtn = document.createElement("button");
assistantBtn.id = "assistant-btn";
assistantBtn.title = "المساعد الذكي";
assistantBtn.textContent = "💬";
document.body.appendChild(assistantBtn);

const chatWindow = document.createElement("div");
chatWindow.id = "assistant-chat";
chatWindow.innerHTML = `
  <div class="chat-header">المساعد الذكي — SHAHRAZAD 💡</div>
  <div class="chat-messages" id="chat-messages" aria-live="polite"></div>
  <div class="chat-input">
    <input type="text" id="chat-query" placeholder="اسأل عن المخزون، الفواتير، العملاء... (مثال: كم عدد الأصناف الناقصة؟)" aria-label="سؤال للمساعد" />
    <button id="chat-send">إرسال</button>
  </div>
`;
document.body.appendChild(chatWindow);

let open = false;
assistantBtn.onclick = () => {
  open = !open;
  chatWindow.classList.toggle("open", open);
  if (open) document.getElementById("chat-query").focus();
};

/* نُسق مضمّن خفيف (في حال لم يكن موجوداً) */
const styleId = "assistant-inline-style";
if (!document.getElementById(styleId)) {
  const s = document.createElement("style");
  s.id = styleId;
  s.innerHTML = `
    #assistant-btn{position:fixed;bottom:20px;left:20px;background:#004aad;color:#fff;border:none;border-radius:50%;width:56px;height:56px;font-size:26px;cursor:pointer;z-index:10000;box-shadow:0 6px 18px rgba(0,0,0,0.2)}
    #assistant-chat{position:fixed;bottom:90px;left:20px;width:340px;height:420px;background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(2,6,23,0.2);display:none;flex-direction:column;overflow:hidden;z-index:10000}
    #assistant-chat.open{display:flex}
    .chat-header{background:#004aad;color:#fff;padding:12px 14px;font-weight:700;text-align:center}
    .chat-messages{flex:1;padding:10px;overflow-y:auto;background:#f6f9fc;display:flex;flex-direction:column-reverse;gap:8px}
    .chat-input{display:flex;padding:10px;border-top:1px solid #eee;background:#fff}
    .chat-input input{flex:1;padding:8px;border-radius:8px;border:1px solid #ddd}
    .chat-input button{background:#004aad;color:#fff;border:none;padding:8px 12px;border-radius:8px;margin-left:8px;cursor:pointer}
    .msg{max-width:86%;padding:8px 10px;border-radius:10px;line-height:1.2}
    .msg.user{background:#dbeafe;align-self:flex-end}
    .msg.bot{background:#eef2ff;align-self:flex-start}
    .typing{font-style:italic;color:#666;padding:6px 8px;border-radius:8px;background:#fff}
  `;
  document.head.appendChild(s);
}

/* ------------------ إدارة الرسائل ------------------ */
const messagesDiv = document.getElementById("chat-messages");
const sendBtn = document.getElementById("chat-send");
const queryInput = document.getElementById("chat-query");

function appendMessage(sender, htmlOrText, isHTML = false) {
  // We keep simple text; minimal HTML allowed for emphasis
  const msg = document.createElement("div");
  msg.className = `msg ${sender}`;
  if (isHTML) msg.innerHTML = htmlOrText;
  else msg.textContent = htmlOrText;
  messagesDiv.prepend(msg); // newest at top visually (col-reverse)
  return msg;
}

function setTypingIndicator(show = true) {
  // show or remove a typing indicator node
  const existing = document.getElementById("assistant-typing");
  if (show) {
    if (!existing) {
      const el = document.createElement("div");
      el.id = "assistant-typing";
      el.className = "typing";
      el.textContent = "⏳ جارٍ التفكير...";
      messagesDiv.prepend(el);
    }
  } else {
    if (existing) existing.remove();
  }
}

/* ------------------ مسك الحدث ------------------ */
sendBtn.addEventListener("click", handleUserQuery);
queryInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleUserQuery();
});

/* ------------------ NLP خفيف (Arabic-friendly) ------------------ */

function normalizeArabic(text) {
  // remove tashkeel, normalize characters, trim
  let t = text + "";
  t = t.replace(/[\u064B-\u065F]/g, ""); // remove diacritics
  t = t.replace(/[إأآا]/g, "ا");
  t = t.replace(/ؤ/g, "و");
  t = t.replace(/ئ/g, "ي");
  t = t.replace(/ى/g, "ي");
  t = t.replace(/ة/g, "ه");
  t = t.replace(/گ/g, "ك");
  t = t.replace(/[\u2000-\u206F\u2E00-\u2E7F\\'"]/g, " ");
  t = t.replace(/\s+/g, " ").trim().toLowerCase();
  return t;
}

function containsAny(text, list) {
  for (const w of list) if (text.includes(w)) return true;
  return false;
}

function extractNumber(text) {
  // try to extract Arabic/Latin numbers (basic)
  const digits = text.match(/(\d+(\.\d+)?)/);
  if (digits) return parseFloat(digits[0]);
  return null;
}

function detectIntent(normal) {
  // returns { intent: string, entities: {} }
  // intents: products_count, low_stock, invoices_count, invoices_total, today_invoices, month_invoices, top_customers, product_info, product_price, product_stock, backup, help
  const out = { intent: null, entities: {} };

  // keywords sets
  const productsK = ["صنف", "منتج", "أصناف", "منتجات", "بضاعة", "سلعة"];
  const lowK = ["ناقص", "منخفض", "نقص", "نقصان", "نفد", "قليل"];
  const invoicesK = ["فاتورة", "فواتير", "فاتور"];
  const todayK = ["اليوم", "النهارده", "النهاردة", "اليومين"];
  const monthK = ["هذا الشهر", "الشهر", "الشهر الحالي", "الشهر هذا", "الشهرية"];
  const topK = ["أعلى", "اكبر", "الأكثر", "الأكثر مبيعا", "أكثر مبيعا", "الأكثر شراء"];
  const customersK = ["عميل", "عملاء", "زبون", "زبائن", "مميز"];
  const priceK = ["سعر", "ثمن", "كام سعر", "بكم", "قيمة"];
  const stockK = ["مخزون", "كمية", "كم في", "في المخزن", "بالمخزن"];
  const backupK = ["نسخ", "نسخة احتياطية", "باك أب", "backup"];
  const helpK = ["مساعدة", "متى", "كيف", "ممكن", "ساعدني", "شنو"];

  // detect product-specific question (contains product name or code)
  // product name in entity extraction will be attempted later

  // products count
  if (containsAny(normal, productsK) && !containsAny(normal, invoicesK)) {
    // low stock?
    if (containsAny(normal, lowK) || normal.includes("الناقص") || normal.includes("منخفض")) {
      out.intent = "low_stock";
      return out;
    }
    out.intent = "products_count";
    return out;
  }

  // invoices
  if (containsAny(normal, invoicesK)) {
    if (containsAny(normal, todayK) || normal.includes("اليوم")) {
      out.intent = "invoices_today";
      return out;
    }
    if (containsAny(normal, monthK) || normal.includes("الشهر")) {
      out.intent = "invoices_month";
      return out;
    }
    if (containsAny(normal, topK) || normal.includes("اجمالي") || normal.includes("المجموع")) {
      out.intent = "invoices_total";
      return out;
    }
    out.intent = "invoices_count";
    return out;
  }

  // customers
  if (containsAny(normal, customersK)) {
    if (containsAny(normal, topK) || normal.includes("مميز")) {
      out.intent = "top_customers";
      return out;
    }
    out.intent = "customers_count";
    return out;
  }

  // price or stock of a specific product (look for كلمات like 'سعر X' or 'كم في X')
  if (containsAny(normal, priceK) || containsAny(normal, stockK)) {
    out.intent = "product_lookup";
    return out;
  }

  // low stock generic
  if (containsAny(normal, lowK) && containsAny(normal, productsK)) {
    out.intent = "low_stock";
    return out;
  }

  // backup
  if (containsAny(normal, backupK)) {
    out.intent = "backup";
    return out;
  }

  // help
  if (containsAny(normal, helpK)) {
    out.intent = "help";
    return out;
  }

  // fallback
  out.intent = "fallback";
  return out;
}

/* ------------------ عمليات الاستعلام ------------------ */

async function handleProductsCount() {
  const products = await getAllRecords("products");
  return `📦 إجمالي الأصناف المسجلة حالياً: ${products.length} صنف.`;
}

async function handleLowStock() {
  // threshold default: 10, but also try to fetch using provided threshold if user mentioned number (handled outside)
  const low = await getLowStockProducts(10);
  if (low.length === 0) return "✅ لا توجد أصناف منخفضة حالياً.";
  // show up to 6
  const list = low.slice(0, 6).map(p => `${p.name} (الكمية: ${p.stock ?? p.quantity ?? 'N/A'})`).join("، ");
  return `⚠️ توجد ${low.length} أصناف منخفضة المخزون. أمثلة: ${list}${low.length > 6 ? "، ... والمزيد" : ""}`;
}

async function handleInvoicesCount(period = "all") {
  const invoices = await getAllRecords("invoices");
  if (period === "today") {
    const today = new Date().toISOString().slice(0, 10);
    const todayInv = invoices.filter(i => (i.date || i.createdAt || "").toString().startsWith(today));
    return `🧾 عدد الفواتير اليوم: ${todayInv.length} فاتورة.`;
  }
  if (period === "month") {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const monthPrefix = `${y}-${m}`;
    const monthInv = invoices.filter(i => (i.date || i.createdAt || "").toString().startsWith(monthPrefix));
    return `🧾 عدد الفواتير في هذا الشهر: ${monthInv.length} فاتورة.`;
  }
  // total
  return `🧾 إجمالي عدد الفواتير: ${invoices.length} فاتورة.`;
}

async function handleInvoicesTotalToday() {
  const invoices = await getAllRecords("invoices");
  const today = new Date().toISOString().slice(0, 10);
  const todayInv = invoices.filter(i => (i.date || i.createdAt || "").toString().startsWith(today));
  const total = todayInv.reduce((s, inv) => s + (inv.total || inv.amount || 0), 0);
  return `💰 إجمالي مبيعات اليوم: ${total.toFixed(2)} ر.ق (من ${todayInv.length} فاتورة).`;
}

async function handleTopCustomers() {
  const customers = await getAllRecords("customers");
  if (!customers || customers.length === 0) return "لا توجد بيانات عن العملاء حالياً.";
  const sorted = [...customers].sort((a, b) => (b.totalSpent || b.totalPurchases || 0) - (a.totalSpent || a.totalPurchases || 0));
  const top = sorted.slice(0, 5);
  const list = top.map(c => `${c.name || c.phone || c.id} (${(c.totalSpent || c.totalPurchases || 0).toFixed ? (c.totalSpent || c.totalPurchases || 0).toFixed(2) : (c.totalSpent || c.totalPurchases || 0)})`).join("، ");
  return `👑 أفضل العملاء: ${list}`;
}

async function handleCustomersCount() {
  const customers = await getAllRecords("customers");
  return `👥 إجمالي العملاء المسجلين: ${customers.length} عميل.`;
}

async function handleProductLookup(queryNormalized, originalQuery) {
  // Try to find product by exact code, id, or approximate name substring
  const products = await getAllRecords("products");
  const q = originalQuery.trim();

  // 1. try numeric code or sku
  const idMatch = q.match(/(sku[:#\s\-]*\d+|#\d+|كود\s*\d+|رمز\s*\d+)/i);
  if (idMatch) {
    const digits = idMatch[0].replace(/[^\d]/g, "");
    // try to find product where code or sku contains digits
    const found = products.find(p => (p.code || p.sku || "").toString().includes(digits) || (p.id || "").includes(digits));
    if (found) return `🔎 ${found.name} — السعر: ${(found.price || found.salePrice || 0).toFixed ? (found.price || found.salePrice).toFixed(2) : (found.price || found.salePrice)} — المخزون: ${found.stock ?? found.quantity ?? 'N/A'}`;
  }

  // 2. find by name substring (normalize both)
  const normalizedProducts = products.map(p => ({ original: p, norm: normalizeArabic((p.name || "") + " " + (p.code || p.sku || "")) }));
  // attempt to get product name from query: pick last word(s)
  // We search for any product whose normalized name words are included in normalized query
  const tokens = queryNormalized.split(" ").filter(Boolean);
  // try longest matches
  let best = null;
  for (const prod of normalizedProducts) {
    // count matching token occurrences
    const score = tokens.reduce((s, t) => s + (prod.norm.includes(t) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { prod: prod.original, score };
  }
  if (best && best.score > 0.5) {
    const p = best.prod;
    return `🔎 ${p.name} — السعر: ${(p.price || p.salePrice || 0).toFixed ? (p.price || p.salePrice).toFixed(2) : (p.price || p.salePrice)} — المخزون: ${p.stock ?? p.quantity ?? 'N/A'}`;
  }

  // fallback: list top 5 matching by substring
  const candidates = products.filter(p => {
    const n = normalizeArabic((p.name || "") + " " + (p.code || p.sku || ""));
    return queryNormalized.split(" ").some(tok => tok.length > 2 && n.includes(tok));
  });

  if (candidates.length > 0) {
    const first = candidates[0];
    return `🔎 ${first.name} — السعر: ${(first.price || 0).toFixed ? (first.price || 0).toFixed(2) : (first.price || 0)} — المخزون: ${first.stock ?? first.quantity ?? 'N/A'}`;
  }

  return `لم أتمكن من تحديد الصنف المطلوب من سؤالك. جرّب: \"كم سعر [اسم الصنف]\" أو اذكر رمز/كود الصنف.`;
}

/* ------------------ المعالج الرئيسي ------------------ */

async function processQuery(rawQuery) {
  const original = rawQuery;
  const q = normalizeArabic(rawQuery);
  if (!q) return "من فضلك اكتب سؤالك.";

  const intentObj = detectIntent(q);

  // handle entity: if user provided threshold number e.g., "الحد 5" or "أقل من 10"
  const num = extractNumber(rawQuery);

  try {
    switch (intentObj.intent) {
      case "products_count":
        return await handleProductsCount();

      case "low_stock":
        if (num && !isNaN(num)) {
          const low = await getLowStockProducts(num);
          return low.length ? `⚠️ توجد ${low.length} أصناف منخفضة (حد ${num}): ${low.slice(0,6).map(p=>p.name + " (" + (p.stock ?? p.quantity ?? 'N/A') + ")").join("، ")}` : `✅ لا توجد أصناف بكمية ≤ ${num}.`;
        }
        return await handleLowStock();

      case "invoices_today":
        return await handleInvoicesCount("today");

      case "invoices_month":
        return await handleInvoicesCount("month");

      case "invoices_total":
      case "invoices_count":
        return await handleInvoicesCount("all");

      case "top_customers":
        return await handleTopCustomers();

      case "customers_count":
        return await handleCustomersCount();

      case "product_lookup":
        return await handleProductLookup(q, original);

      case "backup":
        return "🔰 لعمل نسخة احتياطية: انتقل إلى صفحة الإعدادات أو اضغط زر 'نسخ احتياطي' في الواجهة الرئيسية. (يمكنني تنفيذ التحميل إذا رغبت بذلك)";

      case "help":
        return `مرحباً! يمكنك سؤالي أمثلة مثل:
- "كم عدد الأصناف؟"
- "هل عندي أصناف ناقصة؟"
- "كم عدد الفواتير اليوم؟"
- "ما سعر كابل 1.5مم؟"
- "من هم أفضل 5 عملاء؟"`;

      case "fallback":
      default:
        // Try some heuristic lookups in case of fallback:
        // if contains product word, try product lookup
        if (q.includes("سعر") || q.includes("كم") || q.includes("كمية") || q.includes("مخزون") || q.includes("بكم")) {
          return await handleProductLookup(q, original);
        }
        // default helpful answer
        return `عذراً لم أفهم سؤالك تمامًا. جرّب: "كم عدد الأصناف؟" أو "هل عندي أصناف ناقصة؟" أو "كم عدد فواتير اليوم؟"`;
    }
  } catch (err) {
    console.error("Assistant processing error:", err);
    return "حصل خطأ داخلي أثناء معالجة طلبك. حاول مرة أخرى أو تواصل مع الدعم.";
  }
}

/* ------------------ تنفيذ الاستعلام من واجهة المستخدم ------------------ */

async function handleUserQuery() {
  const query = queryInput.value.trim();
  if (!query) return;
  appendMessage("user", query);
  queryInput.value = "";
  setTypingIndicator(true);

  try {
    // small artificial delay for UX
    await new Promise(resolve => setTimeout(resolve, 300));
    const res = await processQuery(query);
    setTypingIndicator(false);
    appendMessage("bot", res, true); // allow small HTML
  } catch (err) {
    setTypingIndicator(false);
    appendMessage("bot", "عذراً، حدث خطأ أثناء الإجابة. حاول مرة أخرى.");
    console.error(err);
  }
}

/* expose helper for console debugging */
window._shAssistant = {
  processQuery,
  normalizeArabic
};

// ready
appendMessage("bot", "مرحباً! اسألني عن المخزون أو الفواتير أو العملاء. مثلاً: \"هل عندي أصناف ناقصة؟\"");

export default { processQuery };
