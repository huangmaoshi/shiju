import express, { Request, Response, NextFunction, Router } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import config from "./config";
import { errorHandler } from "./middlewares/error_middleware";
import { generalLimiter } from "./middlewares/rate_limit_middleware";
import {
  authRoutes,
  categoryRoutes,
  quoteRoutes,
  searchRoutes,
  collectionRoutes,
  customQuoteRoutes,
  reciteRoutes,
  memberRoutes,
  orderRoutes,
  dailyRecommendRoutes,
  adRoutes,
  cardRoutes,
  compositionRoutes,
  themePackageRoutes,
  syncRoutes,
  exportRoutes,
  adminRoutes,
  statsRoutes,
  originalTextRoutes,
  aiRoutes,
} from "./routes";
import userRoutes from "./routes/user_routes";
import { ok } from "./utils/response";

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));
app.use(generalLimiter);

const startTime = Date.now();

app.get("/api/health", (_req: Request, res: Response) => {
  ok(res, {
    status: "ok",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: "1.0.0",
  });
});

app.get("/", (_req: Request, res: Response) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>拾句 · 作文素材与金句摘抄库</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh}
  .quote-card{background:linear-gradient(135deg,#fff 0%,#f8f9ff 100%);transition:all .3s}
  .quote-card:hover{transform:translateY(-2px);box-shadow:0 20px 40px -10px rgba(102,126,234,.3)}
  .tag{background:linear-gradient(135deg,#667eea,#764ba2)}
  pre{white-space:pre-wrap;word-break:break-all;max-height:300px;overflow-y:auto}
</style>
</head>
<body class="py-8 px-4">
<div class="max-w-4xl mx-auto">

<div class="text-center mb-10 text-white">
  <h1 class="text-4xl font-bold mb-2">📖 拾句</h1>
  <p class="text-lg opacity-90">作文素材与金句摘抄库 · API 调试台</p>
  <p class="text-sm opacity-75 mt-2">后端运行正常 <span id="health-dot" class="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> v1.0.0</p>
</div>

<div class="bg-white rounded-2xl shadow-2xl p-6 mb-6">
  <div class="flex gap-2 mb-4">
    <input id="search-input" type="text" placeholder="🔍 搜索金句（如：生命、勤奋、梦）" class="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none transition">
    <button onclick="doSearch()" class="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-medium hover:opacity-90 transition">搜索</button>
    <button onclick="doRandom()" class="px-6 py-3 border-2 border-purple-500 text-purple-600 rounded-xl font-medium hover:bg-purple-50 transition">🎲 随机 5 条</button>
  </div>
</div>

<div class="grid md:grid-cols-2 gap-6">

  <div class="quote-card rounded-2xl p-6 shadow-lg">
    <h3 class="font-bold text-lg mb-3 text-gray-800">📚 分类浏览</h3>
    <p class="text-xs text-gray-500 mb-3">按分类类型筛选：古诗词曲 / 名人名言 / 励志奋斗 ...</p>
    <div id="categories" class="flex flex-wrap gap-2"></div>
  </div>

  <div class="quote-card rounded-2xl p-6 shadow-lg">
    <h3 class="font-bold text-lg mb-3 text-gray-800">💡 每日推荐</h3>
    <p class="text-xs text-gray-500 mb-3">今日精选 10 条金句</p>
    <button onclick="doDaily()" class="w-full py-2 border-2 border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50 transition">获取今日推荐</button>
  </div>

</div>

<div id="results" class="mt-6 space-y-4"></div>

</div>

<script>
const api = p => \`/api/v1\${p}\`;

async function fetchJSON(url){try{const r=await fetch(url);return r.json()}catch(e){return{error:e.message}}}

async function loadCategories(){
  const r=await fetchJSON(api('/categories/'));
  if(r.code!==0)return;
  const groups={};
  r.data.forEach(c=>{groups[c.type]=groups[c.type]||[];groups[c.type].push(c)});
  const typeNames={content_type:'📖 内容类型',theme:'🎨 主题',scene:'🎬 场景'};
  let html='';
  Object.keys(groups).forEach(t=>{
    html+='<div class="mb-2 text-xs font-semibold text-gray-400">'+(typeNames[t]||t)+'</div><div class="flex flex-wrap gap-1 mb-3">';
    groups[t].forEach(c=>{
      html+=\`<button onclick="doCategory(\${c.id})" class="px-3 py-1 text-xs text-purple-700 bg-purple-50 rounded-full hover:bg-purple-100 transition">\${c.name}</button>\`;
    });
    html+='</div>';
  });
  document.getElementById('categories').innerHTML=html;
}

function renderQuote(q){
  const cats=(q.categories||[]).map(c=>typeof c==='string'?c:c.name).filter(Boolean);
  return \`
    <div class="quote-card rounded-2xl p-5 shadow-lg">
      <p class="text-lg text-gray-800 leading-relaxed mb-3">"\${q.content}"</p>
      <div class="flex items-center justify-between">
        <div>
          <span class="text-sm text-gray-600 font-medium">\${q.author||'佚名'}</span>
          <span class="text-xs text-gray-400 ml-2">\${q.source||''}</span>
        </div>
        <div class="flex gap-1">
          \${q.isFree?'<span class="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">免费</span>':'<span class="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">会员</span>'}
        </div>
      </div>
      \${cats.length?'<div class="mt-3 flex flex-wrap gap-1">'+cats.map(n=>\`<span class="tag text-white text-xs px-2 py-0.5 rounded">\${n}</span>\`).join('')+'</div>':''}
    </div>\`;
}

async function doSearch(){
  const kw=document.getElementById('search-input').value.trim();
  if(!kw)return;
  const r=await fetchJSON(api('/search/quotes?keyword='+encodeURIComponent(kw)));
  showResult(r.data?r.data.list:r.data||[], r.data?.total);
}
async function doRandom(){
  const r=await fetchJSON(api('/quotes/random?limit=5'));
  showResult(r.data, r.data?.length);
}
async function doCategory(id){
  const r=await fetchJSON(api('/quotes/?categoryId='+id));
  showResult(r.data.list, r.data.total);
}
async function doDaily(){
  const r=await fetchJSON(api('/daily-recommend/today'));
  if(r.code===0)showResult(r.data.quotes, r.data.quotes?.length, '今日精选');
}

function showResult(list, total, title){
  const el=document.getElementById('results');
  if(!list||list.length===0){
    el.innerHTML='<div class="text-center py-12 text-white opacity-80">没有找到内容 😢</div>';return;
  }
  let html='';
  if(title)html+='<h2 class="text-white font-bold text-xl mb-4">✨ '+title+'</h2>';
  if(total!=null)html+='<div class="text-white opacity-80 text-sm mb-3">共 '+total+' 条</div>';
  html+=list.map(renderQuote).join('');
  el.innerHTML=html;
}

document.getElementById('search-input').addEventListener('keydown',e=>{if(e.key==='Enter')doSearch()});
loadCategories();
doRandom();
</script>
</body>
</html>`);
});

const v1 = Router();

v1.use((_req: Request, _res: Response, next: NextFunction) => {
  next();
});

v1.use("/auth", authRoutes);
v1.use("/user", userRoutes);
v1.use("/categories", categoryRoutes);
v1.use("/quotes", quoteRoutes);
v1.use("/search", searchRoutes);
v1.use("/collections", collectionRoutes);
v1.use("/custom-quotes", customQuoteRoutes);
v1.use("/recite", reciteRoutes);
v1.use("/member", memberRoutes);
v1.use("/order", orderRoutes);
v1.use("/daily-recommend", dailyRecommendRoutes);
v1.use("/ad", adRoutes);
v1.use("/card-templates", cardRoutes);
v1.use("/compositions", compositionRoutes);
v1.use("/theme-packages", themePackageRoutes);
v1.use("/sync", syncRoutes);
v1.use("/export", exportRoutes);
v1.use("/admin", adminRoutes);
v1.use("/stats", statsRoutes);
v1.use("/original-texts", originalTextRoutes);
v1.use("/ai", aiRoutes);

app.use("/api/v1", v1);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    code: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    data: null,
  });
});

app.use(errorHandler);

export default app;
export { app };
