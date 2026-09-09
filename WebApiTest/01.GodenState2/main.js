// 請將此處替換為你的 Google Apps Script Web App 部署網址
const API_URL = 'https://script.google.com/macros/s/AKfycbz2P3HC0yT_N01k2kjTCH2p4X5c_lsOR38xuxV7Qa8FCRVCds1c8gGkg7WzAKWA3RZKVA/exec';

document.addEventListener('DOMContentLoaded', () => {
    // 初始載入資料
    fetchMembers();

    // 綁定表單提交事件
    const form = document.getElementById('memberForm');
    form.addEventListener('submit', handleFormSubmit);
});

/**
 * 取得會員資料 (GET)
 */
async function fetchMembers() {
    const tableBody = document.getElementById('tableBody');
    const loader = document.getElementById('tableLoader');

    // 顯示 Loading 動畫，隱藏表格內容
    tableBody.innerHTML = '';
    loader.style.display = 'flex';

    try {
        // 發送 GET 請求 (假設 API 有處理 action=read 參數)
        // 如果 API 網址尚未設定，提供假資料作展示
        if (API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL' || !API_URL) {
            console.warn('API_URL 尚未設定，載入展示用假資料。');
            setTimeout(() => {
                const mockData = [
                    { id: '1', name: 'Stephen Curry', role: 'Admin', email: 'stephen.curry@gsw.com' },
                    { id: '2', name: 'Klay Thompson', role: 'Pro', email: 'klay.thompson@gsw.com' },
                    { id: '3', name: 'Draymond Green', role: 'User', email: 'draymond.green@gsw.com' }
                ];
                renderTable(mockData);
            }, 1500); // 模擬網路延遲
            return;
        }

        const response = await fetch(`${API_URL}?action=read`);
        const result = await response.json();

        // 假設回傳的資料結構為 { status: 'success', data: [...] } 或直接是陣列
        const data = result.data || result;
        renderTable(data);

    } catch (error) {
        console.error('取得資料失敗:', error);
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--neon-pink);">資料讀取失敗，請檢查 API 狀態。</td></tr>`;
    } finally {
        // 隱藏 Loading 動畫
        loader.style.display = 'none';
    }
}

/**
 * 渲染表格資料
 */
function renderTable(data) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">目前沒有任何資料</td></tr>`;
        return;
    }

    data.forEach((item, index) => {
        const tr = document.createElement('tr');

        // 根據角色給予不同樣式的 Badge
        let badgeClass = 'badge-user';
        let roleText = item.role || '一般成員';

        // 班級角色對應不同 NBA Street Badge
        if (roleText.includes('班代') && !roleText.includes('副')) {

            badgeClass = 'badge-leader';

        }
        else if (roleText.includes('副班代')) {

            badgeClass = 'badge-vice';

        }
        else if (roleText.includes('服務股長')) {

            badgeClass = 'badge-service';

        }

        tr.innerHTML = `
            <td>#${item.id || (index + 1)}</td>
            <td>${item.name}</td>
            <td>${item.email}</td>
            <td><span class="badge ${badgeClass}">${roleText}</span></td>
        `;
        tableBody.appendChild(tr);
    });
}

/**
 * 處理表單提交 (POST)
 */
async function handleFormSubmit(event) {
    event.preventDefault(); // 阻止預設行為

    const form = event.target;
    const submitBtn = document.getElementById('submitBtn');

    // 收集表單資料
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    // 將按鈕設為 Loading 狀態
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="neon-spinner" style="width: 20px; height: 20px; border-width: 2px; display: inline-block; vertical-align: middle; margin-right: 10px;"></span> 傳送中...';

    try {
        if (API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL' || !API_URL) {
            // 模擬成功寫入
            await new Promise(resolve => setTimeout(resolve, 1500));
            showCustomAlert('資料新增成功！(展示模式)');
            form.reset();
            fetchMembers();
            return;
        }

        // 發送 POST 請求
        // 注意：為了避開 GAS 的 CORS 限制，將 Content-Type 設為 text/plain
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
        });

        // 檢查回應
        if (response.ok) {
            showCustomAlert('成員資料新增成功！');
            form.reset(); // 清空表單
            fetchMembers(); // 重新整理表格
        } else {
            throw new Error('伺服器回應錯誤');
        }

    } catch (error) {
        console.error('寫入資料失敗:', error);
        showCustomAlert('資料寫入失敗，請稍後再試。', true);
    } finally {
        // 恢復按鈕狀態
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

/**
 * 顯示自訂美化提示框
 */
function showCustomAlert(message, isError = false) {
    const overlay = document.getElementById('customAlertOverlay');
    const msgElement = document.getElementById('alertMessage');
    const titleElement = overlay.querySelector('h3');

    msgElement.textContent = message;

    if (isError) {
        titleElement.textContent = 'Error';
        titleElement.style.color = 'var(--neon-pink)';
        titleElement.style.textShadow = '0 0 10px var(--neon-pink)';
        overlay.querySelector('.custom-alert').style.borderColor = 'var(--neon-pink)';
        overlay.querySelector('.custom-alert').style.boxShadow = '0 0 30px rgba(255, 0, 255, 0.4)';
    } else {
        titleElement.textContent = 'Success!';
        titleElement.style.color = 'var(--neon-green)';
        titleElement.style.textShadow = '0 0 10px var(--neon-green)';
        overlay.querySelector('.custom-alert').style.borderColor = 'var(--neon-green)';
        overlay.querySelector('.custom-alert').style.boxShadow = '0 0 30px rgba(57, 255, 20, 0.4)';
    }

    overlay.classList.add('show');
}

/**
 * 關閉自訂提示框
 */
function closeCustomAlert() {
    document.getElementById('customAlertOverlay').classList.remove('show');
}
