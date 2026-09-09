/* ============================================================
   BLACK TERMINAL STOCK SYSTEM
   FRONTEND JAVASCRIPT
============================================================ */


/* ============================================================
   API CONFIG
============================================================ */

/**
 * ==========================================================
 * ★★★ 請把你的 Google Apps Script Web App URL 放這裡 ★★★
 *
 * 例如：
 *
 * const API_URL =
 * 'https://script.google.com/macros/s/XXXXXXXX/exec';
 *
 * ==========================================================
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbxVx14xXDjZcjlqI4pZi_dBZWVWQbGt6Mn4JF8QjpTMN2hGidfioRaiiqRVY6xkF8hK/exec';


/* ============================================================
   DOM
============================================================ */

const stockForm =
    document.getElementById('stockForm');

const stockTableBody =
    document.getElementById('stockTableBody');

const tableLoading =
    document.getElementById('tableLoading');

const emptyState =
    document.getElementById('emptyState');

const submitButton =
    document.getElementById('submitButton');

const submitText =
    document.getElementById('submitText');

const submitLoader =
    document.getElementById('submitLoader');

const refreshButton =
    document.getElementById('refreshButton');

const connectionStatus =
    document.getElementById('connectionStatus');


/* ============================================================
   FORM INPUT
============================================================ */

const stockName =
    document.getElementById('stockName');

const stockCode =
    document.getElementById('stockCode');

const currentPrice =
    document.getElementById('currentPrice');

const quantity =
    document.getElementById('quantity');

const avgPrice =
    document.getElementById('avgPrice');

const priceSource =
    document.getElementById('priceSource');


/* ============================================================
   PREVIEW
============================================================ */

const previewCost =
    document.getElementById('previewCost');

const previewValue =
    document.getElementById('previewValue');

const previewProfit =
    document.getElementById('previewProfit');

const previewReturn =
    document.getElementById('previewReturn');


/* ============================================================
   SUMMARY
============================================================ */

const positionCount =
    document.getElementById('positionCount');

const totalValue =
    document.getElementById('totalValue');

const totalProfit =
    document.getElementById('totalProfit');


/* ============================================================
   TOAST
============================================================ */

const toast =
    document.getElementById('toast');

const toastTitle =
    document.getElementById('toastTitle');

const toastMessage =
    document.getElementById('toastMessage');


/* ============================================================
   INITIALIZE
============================================================ */

document.addEventListener(
    'DOMContentLoaded',
    () => {

        fetchMembers();

        setupLiveCalculation();

        setupPriceEngine();

    }
);


/* ============================================================
   GET API
============================================================ */

/**
 * 讀取股票資料
 *
 * GET:
 * API_URL?action=read
 */

async function fetchMembers() {

    showTableLoading(true);

    setConnectionStatus(
        'CONNECTING...',
        false
    );


    try {

        if (!API_URL) {

            throw new Error(
                '尚未設定 API_URL'
            );
        }


        const response =
            await fetch(
                `${API_URL}?action=read`,
                {
                    method: 'GET'
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const result =
            await response.json();


        if (
            result.status !== 'success'
        ) {

            throw new Error(
                result.message ||
                'API 讀取失敗'
            );
        }


        renderStockTable(
            result.data || []
        );


        setConnectionStatus(
            'SYSTEM ONLINE',
            true
        );


    } catch (error) {

        console.error(
            'fetchMembers:',
            error
        );


        renderError(
            error.message
        );


        setConnectionStatus(
            'CONNECTION ERROR',
            false
        );


        showToast(
            'ERROR',
            error.message
        );


    } finally {

        showTableLoading(false);

    }

}


/* ============================================================
   POST API
============================================================ */

/**
 * 新增股票
 *
 * POST
 *
 * Content-Type:
 * text/plain
 *
 * 避免 CORS preflight
 */

async function addStock(payload) {

    try {

        if (!API_URL) {

            throw new Error(
                '尚未設定 API_URL'
            );
        }


        const response =
            await fetch(
                API_URL,
                {

                    method: 'POST',

                    headers: {

                        'Content-Type':
                            'text/plain'

                    },

                    body:
                        JSON.stringify(
                            payload
                        )

                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const result =
            await response.json();


        if (
            result.status !== 'success'
        ) {

            throw new Error(
                result.message ||
                '資料新增失敗'
            );
        }


        return result;


    } catch (error) {

        console.error(
            'addStock:',
            error
        );

        throw error;

    }

}


/* ============================================================
   FORM SUBMIT
============================================================ */

stockForm.addEventListener(
    'submit',
    async (event) => {

        event.preventDefault();


        /**
         * 防止重複提交
         */
        if (
            submitButton.disabled
        ) {

            return;
        }


        const payload = {

            '股票名稱':
                stockName.value.trim(),

            '股票代號':
                stockCode.value.trim(),

            '現價':
                currentPrice.value,

            '股數':
                quantity.value,

            '均價':
                avgPrice.value,

            /**
             * 告訴 GAS：
             *
             * FETCH
             * GOOGLEFINANCE
             * MANUAL
             */
            priceSource:
                priceSource.value

        };


        try {

            setSubmitLoading(
                true
            );


            const result =
                await addStock(
                    payload
                );


            showToast(
                'SUCCESS',
                result.message ||
                '資料新增成功'
            );


            /**
             * 清空表單
             */
            stockForm.reset();


            /**
             * 清除即時計算
             */
            updateLiveCalculation();


            /**
             * 重新讀取
             */
            await fetchMembers();


        } catch (error) {

            showToast(
                'ERROR',
                error.message
            );

        } finally {

            setSubmitLoading(
                false
            );

        }

    }
);


/* ============================================================
   RENDER TABLE
============================================================ */

function renderStockTable(
    data
) {

    stockTableBody.innerHTML =
        '';


    if (
        !Array.isArray(data) ||
        data.length === 0
    ) {

        emptyState.classList.remove(
            'hidden'
        );

        updateSummary([]);

        return;

    }


    emptyState.classList.add(
        'hidden'
    );


    data.forEach(
        (stock) => {

            const row =
                document.createElement(
                    'tr'
                );


            const profit =
                Number(
                    stock['未實現預估損益']
                ) || 0;


            const returnRate =
                Number(
                    stock['未實現報酬率(估)']
                ) || 0;


            const profitClass =
                profit >= 0
                    ? 'profit-positive'
                    : 'profit-negative';


            const returnClass =
                returnRate >= 0
                    ? 'return-positive'
                    : 'return-negative';


            const source =
                detectPriceSource(
                    stock.priceFormula
                );


            row.innerHTML = `

                <td>

                    <span class="stock-name">
                        ${escapeHTML(
                            stock['股票名稱'] || '-'
                        )}
                    </span>

                </td>


                <td>

                    <span class="stock-code">
                        ${escapeHTML(
                            stock['股票代號'] || '-'
                        )}
                    </span>

                </td>


                <td>

                    <span class="price">
                        ${formatNumber(
                            stock['現價']
                        )}
                    </span>

                    ${
                        source
                        ? `
                            <span class="source-badge">
                                ${source}
                            </span>
                          `
                        : ''
                    }

                </td>


                <td>
                    ${formatInteger(
                        stock['股數']
                    )}
                </td>


                <td>
                    ${formatNumber(
                        stock['均價']
                    )}
                </td>


                <td>
                    ${formatNumber(
                        stock['成本金額']
                    )}
                </td>


                <td>
                    ${formatNumber(
                        stock['市值']
                    )}
                </td>


                <td class="${profitClass}">
                    ${formatSignedNumber(
                        profit
                    )}
                </td>


                <td class="${returnClass}">
                    ${formatPercent(
                        returnRate
                    )}
                </td>

            `;


            stockTableBody.appendChild(
                row
            );

        }
    );


    updateSummary(
        data
    );

}


/* ============================================================
   SUMMARY
============================================================ */

function updateSummary(
    data
) {

    positionCount.textContent =
        data.length;


    let value = 0;

    let profit = 0;


    data.forEach(
        stock => {

            value +=
                Number(
                    stock['市值']
                ) || 0;


            profit +=
                Number(
                    stock['未實現預估損益']
                ) || 0;

        }
    );


    totalValue.textContent =
        formatNumber(value);


    totalProfit.textContent =
        formatSignedNumber(
            profit
        );

}


/* ============================================================
   LIVE CALCULATION
============================================================ */

function setupLiveCalculation() {

    [
        currentPrice,
        quantity,
        avgPrice
    ].forEach(
        input => {

            input.addEventListener(
                'input',
                updateLiveCalculation
            );

        }
    );

}


function updateLiveCalculation() {

    const price =
        Number(
            currentPrice.value
        ) || 0;


    const qty =
        Number(
            quantity.value
        ) || 0;


    const avg =
        Number(
            avgPrice.value
        ) || 0;


    const cost =
        qty * avg;


    const value =
        qty * price;


    const profit =
        value - cost;


    const returnRate =
        cost !== 0
            ? profit / cost
            : 0;


    previewCost.textContent =
        formatNumber(cost);


    previewValue.textContent =
        formatNumber(value);


    previewProfit.textContent =
        formatSignedNumber(
            profit
        );


    previewReturn.textContent =
        formatPercent(
            returnRate
        );

}


/* ============================================================
   PRICE ENGINE
============================================================ */

function setupPriceEngine() {

    priceSource.addEventListener(
        'change',
        () => {

            const source =
                priceSource.value;


            if (
                source === 'MANUAL'
            ) {

                currentPrice.disabled =
                    false;

                currentPrice.placeholder =
                    '手動輸入股價';

            } else {

                currentPrice.disabled =
                    false;

                currentPrice.placeholder =
                    source === 'FETCH'
                        ? '由 FETCH_TW_STOCK_PRICE 同步'
                        : '由 GOOGLEFINANCE 同步';

            }

        }
    );

}


/* ============================================================
   DETECT PRICE SOURCE
============================================================ */

function detectPriceSource(
    formula
) {

    if (!formula) {

        return '';

    }


    const upper =
        formula.toUpperCase();


    if (
        upper.includes(
            'FETCH_TW_STOCK_PRICE'
        )
    ) {

        return 'FETCH';

    }


    if (
        upper.includes(
            'GOOGLEFINANCE'
        )
    ) {

        return 'GF';

    }


    return 'MANUAL';

}


/* ============================================================
   TABLE LOADING
============================================================ */

function showTableLoading(
    show
) {

    if (show) {

        tableLoading.classList.remove(
            'hidden'
        );

    } else {

        tableLoading.classList.add(
            'hidden'
        );

    }

}


/* ============================================================
   BUTTON LOADING
============================================================ */

function setSubmitLoading(
    loading
) {

    submitButton.disabled =
        loading;


    if (loading) {

        submitText.textContent =
            'EXECUTING...';

        submitLoader.classList.remove(
            'hidden'
        );

    } else {

        submitText.textContent =
            'EXECUTE INSERT';

        submitLoader.classList.add(
            'hidden'
        );

    }

}


/* ============================================================
   CONNECTION STATUS
============================================================ */

function setConnectionStatus(
    text,
    online
) {

    connectionStatus.textContent =
        text;


    connectionStatus.style.color =
        online
            ? 'var(--green)'
            : 'var(--danger)';

}


/* ============================================================
   ERROR TABLE
============================================================ */

function renderError(
    message
) {

    emptyState.classList.remove(
        'hidden'
    );


    emptyState.innerHTML = `

        <div class="empty-icon">
            !
        </div>

        <div>
            DATABASE CONNECTION FAILED
        </div>

        <small>
            ${escapeHTML(message)}
        </small>

    `;

}


/* ============================================================
   TOAST
============================================================ */

function showToast(
    title,
    message
) {

    toastTitle.textContent =
        title;

    toastMessage.textContent =
        message;


    toast.classList.add(
        'show'
    );


    setTimeout(
        () => {

            toast.classList.remove(
                'show'
            );

        },
        3500
    );

}


/* ============================================================
   NUMBER FORMAT
============================================================ */

function formatNumber(
    value
) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {

        return '0';

    }


    return number.toLocaleString(
        'zh-TW',
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );

}


function formatInteger(
    value
) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {

        return '0';

    }


    return number.toLocaleString(
        'zh-TW',
        {
            maximumFractionDigits: 0
        }
    );

}


function formatSignedNumber(
    value
) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {

        return '0';

    }


    const prefix =
        number > 0
            ? '+'
            : '';


    return prefix +
        number.toLocaleString(
            'zh-TW',
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );

}


function formatPercent(
    value
) {

    const number =
        Number(value) * 100;


    if (
        !Number.isFinite(number)
    ) {

        return '0.00%';

    }


    const prefix =
        number > 0
            ? '+'
            : '';


    return prefix +
        number.toFixed(2) +
        '%';

}


/* ============================================================
   HTML SECURITY
============================================================ */

function escapeHTML(
    value
) {

    return String(value)

        .replace(
            /&/g,
            '&amp;'
        )

        .replace(
            /</g,
            '&lt;'
        )

        .replace(
            />/g,
            '&gt;'
        )

        .replace(
            /"/g,
            '&quot;'
        )

        .replace(
            /'/g,
            '&#039;'
        );

}


/* ============================================================
   REFRESH
============================================================ */

refreshButton.addEventListener(
    'click',
    async () => {

        refreshButton.disabled =
            true;

        try {

            await fetchMembers();

        } finally {

            refreshButton.disabled =
                false;

        }

    }
);