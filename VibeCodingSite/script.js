document.getElementById('contactForm').addEventListener('submit', async function (e) {
  e.preventDefault(); // 阻止網頁預設的跳轉重新整理行為

  const form = this;
  const submitBtn = form.querySelector('.contact-submit');
  const successBox = form.querySelector('.form-success');

  // 1. 簡易前端驗證：檢查必填欄位 (姓名、Email、最想做的作品)
  const name = form.querySelector('#contact-name').value.trim();
  const email = form.querySelector('#contact-email').value.trim();
  const project = form.querySelector('#contact-project').value.trim();

  if (!name || !email || !project) {
    alert('請填寫必要的欄位 (姓名、Email、最想做的作品)');
    return;
  }

  // 2. 收集表單所有欄位資料
  const lineId = form.querySelector('#contact-line').value.trim() || '未填寫';
  const phone = form.querySelector('#contact-phone').value.trim() || '未填寫';
  const role = form.querySelector('#contact-role').value || '未選擇';

  const codingLevelRadio = form.querySelector('input[name="coding-level"]:checked');
  const codingLevel = codingLevelRadio ? codingLevelRadio.nextElementSibling.innerText : '未選擇';

  const reason = form.querySelector('#contact-reason').value.trim() || '未填寫';

  // 3. 送到自己的後端 API，由伺服器代為通知 Telegram
  //
  //    安全性說明：
  //    Bot Token 與 Chat ID 只存在 NAS 上的 config.env，
  //    絕不出現在這份 HTML、也不會傳到瀏覽器。前端只送出
  //    表單欄位，訊息組裝、字元逸出與頻率限制都由後端負責。
  const payload = { name, email, lineId, phone, role, codingLevel, reason, project };

  // 改變按鈕文字提示「傳送中...」
  const originalBtnText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span>傳送中...</span>';
  submitBtn.disabled = true;

  try {
    // 4. 呼叫同源後端（/api/contact），不再直接打 Telegram
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({ ok: false, error: '伺服器回應格式錯誤' }));

    if (response.ok && result.ok) {
      // 成功送出：顯示成功區塊並清空表單
      successBox.classList.add('is-visible');
      form.reset();
    }
    else {
      alert('發送失敗：' + (result.error || '請稍後再試。'));
    }
  } catch (error) {
    console.error('Error:', error);
    alert('網路連線發生錯誤，請檢查網路。');
  } finally {
    // 恢復按鈕狀態...
    submitBtn.innerHTML = originalBtnText;
    submitBtn.disabled = false;
  }
});
