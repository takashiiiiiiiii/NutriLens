let selectedCook = 'raw';
let currentImageBase64 = null;
let currentResult = null;

// 今日のログだけ保持
let mealLog = JSON.parse(localStorage.getItem('nutrilens_log') || '[]');
const today = new Date().toDateString();
mealLog = mealLog.filter(m => m.date === today);

renderHistory();

// 料理方法ボタン選択
function selectCook(btn) {
  document.querySelectorAll('.cook-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedCook = btn.dataset.val;
}

// ファイル選択
const fileInput = document.getElementById('file-input');
fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const dataUrl = ev.target.result;
    currentImageBase64 = dataUrl.split(',')[1];
    document.getElementById('preview-img').src = dataUrl;
    document.getElementById('upload-card').style.display = 'none';
    document.getElementById('preview-wrap').style.display = 'block';
    document.getElementById('analyze-btn').disabled = false;
    document.getElementById('result-card').style.display = 'none';
  };
  reader.readAsDataURL(file);
});

// ドラッグ&ドロップ
const uploadCard = document.getElementById('upload-card');
uploadCard.addEventListener('dragover', e => { e.preventDefault(); uploadCard.classList.add('drag-over'); });
uploadCard.addEventListener('dragleave', () => uploadCard.classList.remove('drag-over'));
uploadCard.addEventListener('drop', e => {
  e.preventDefault();
  uploadCard.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) {
    fileInput.files = e.dataTransfer.files;
    fileInput.dispatchEvent(new Event('change'));
  }
});

// 画像リセット
function resetImage() {
  currentImageBase64 = null;
  document.getElementById('upload-card').style.display = 'block';
  document.getElementById('preview-wrap').style.display = 'none';
  document.getElementById('analyze-btn').disabled = true;
  document.getElementById('result-card').style.display = 'none';
  fileInput.value = '';
}

// 料理方法の説明
const cookingDescriptions = {
  raw: 'raw and uncooked',
  steamed: 'steamed or boiled (no added fat)',
  grilled: 'grilled or roasted (no added fat)',
  butter: 'cooked with butter',
  oil: 'cooked with oil',
  seasoned: 'seasoned or marinated (with sauces/spices)'
};

// カロリー解析
async function analyze() {
  if (!currentImageBase64) return;
  document.getElementById('error-msg').style.display = 'none';
  document.getElementById('loading-card').style.display = 'block';
  document.getElementById('result-card').style.display = 'none';
  document.getElementById('analyze-btn').disabled = true;

  const cookDesc = cookingDescriptions[selectedCook];
  const prompt = `You are a nutrition expert. Analyze this food image. The food was prepared: ${cookDesc}. Identify each ingredient/food item visible, estimate portions, and calculate calories. Respond ONLY in this exact JSON format (no markdown, no explanation): { "meal_name": "short descriptive name", "ingredients": [ {"name": "ingredient name", "amount": "estimated amount", "calories": 123} ], "total_calories": 456, "protein_g": 12, "carbs_g": 34, "fat_g": 10, "notes": "one short sentence tip or note" }`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'YOUR_API_KEY_HERE'  // ←ここにClaude APIキーを入れる
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: currentImageBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await res.json();
    const text = data.content.map(c => c.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    currentResult = parsed;
    showResult(parsed);

  } catch (err) {
    showError('Could not analyze the image. Please try again.');
    console.error(err);
  } finally {
    document.getElementById('loading-card').style.display = 'none';
    document.getElementById('analyze-btn').disabled = false;
  }
}

// 結果表示
function showResult(r) {
  document.getElementById('result-title').textContent = r.meal_name || 'Meal Analysis';
  document.getElementById('total-cal').textContent = r.total_calories + ' kcal';
  document.getElementById('macro-protein').textContent = r.protein_g + 'g';
  document.getElementById('macro-carbs').textContent = r.carbs_g + 'g';
  document.getElementById('macro-fat').textContent = r.fat_g + 'g';

  const list = document.getElementById('ingredients-list');
  list.innerHTML = '';
  (r.ingredients || []).forEach(ing => {
    const row = document.createElement('div');
    row.className = 'ingredient-row';
    row.innerHTML = `<span class="ingredient-name">${ing.name} <span style="color:var(--muted);font-size:0.8rem;">(${ing.amount})</span></span><span class="ingredient-cal">${ing.calories} kcal</span>`;
    list.appendChild(row);
  });

  if (r.notes) {
    const note = document.createElement('p');
    note.style.cssText = 'font-size:0.82rem;color:var(--muted);margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);';
    note.textContent = '💡 ' + r.notes;
    list.after(note);
  }

  document.getElementById('result-card').style.display = 'block';
  document.getElementById('result-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// エラー表示
function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = 'block';
}

// 食事ログ保存
function saveMeal() {
  if (!currentResult) return;
  const entry = {
    id: Date.now(),
    date: today,
    name: currentResult.meal_name,
    calories: currentResult.total_calories,
    cook: selectedCook,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  mealLog.push(entry);
  const all = JSON.parse(localStorage.getItem('nutrilens_log') || '[]').filter(m => m.date !== today);
  localStorage.setItem('nutrilens_log', JSON.stringify([...all, ...mealLog]));
  renderHistory();

  const btn = document.querySelector('.save-meal-btn');
  btn.textContent = '✓ Saved!';
  setTimeout(() => { btn.textContent = '＋ Add to today\'s log'; }, 2000);
}

// ログ表示
function renderHistory() {
  const body = document.getElementById('history-body');
  const totalEl = document.getElementById('daily-total');
  const totalVal = document.getElementById('daily-total-val');
  const headerCal = document.getElementById('header-cal');

  if (!mealLog.length) {
    body.innerHTML = '<div class="history-empty">No meals logged yet</div>';
    totalEl.style.display = 'none';
    headerCal.textContent = 'Today: 0 kcal';
    return;
  }

  const total = mealLog.reduce((s, m) => s + m.calories, 0);
  headerCal.textContent = `Today: ${total} kcal`;
  totalEl.style.display = 'flex';
  totalVal.textContent = total + ' kcal';

  const list = document.createElement('div');
  list.className = 'history-list';
  mealLog.slice().reverse().forEach(m => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `<div><div class="history-item-name">${m.name}</div><div class="history-item-meta">${m.time} · ${m.cook}</div></div><div class="history-item-cal">${m.calories} kcal</div>`;
    list.appendChild(item);
  });

  body.innerHTML = '';
  body.appendChild(list);
}

// ログクリア
function clearHistory() {
  mealLog = [];
  const all = JSON.parse(localStorage.getItem('nutrilens_log') || '[]').filter(m => m.date !== today);
  localStorage.setItem('nutrilens_log', JSON.stringify(all));
  renderHistory();
}
