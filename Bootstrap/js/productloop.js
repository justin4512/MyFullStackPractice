$("#mytbody").empty(); //將範例表格留著日後使用，但網頁迴圈載入前先清空範例資料
for (let i = 0; i < products.length; i++) {
    // console.log(products[i].ID);
    // console.log(products[i].name);
    // console.log(products[i].en_name);
    //將表格內容轉為字串
    const strHTML = `<tr>
        <td data-th="訂單類別編號"><span class="table-col">${products[i].sales_records[0]?.order_id ?? "無訂單紀錄"}</span></td>
        <td data-th="訂單種類"><span class="table-col">${products[i].sales_records[0]?.purchase_time ?? "無此訂單"}</span></td>
        <td data-th="訂單名稱"><span class="table-col">${products[i].name}</span></td>
        <td data-th="訂單英文名"><span class="table-col">${products[i].en_name}</span></td>
        <td data-th="訂單價格"><span class="table-col">${products[i].price}</span></td>
        <td data-th="訂單重量"><span class="table-col">${products[i].weight}</span></td>
        <td data-th="訂單描述"><span class="table-col">${products[i].desc}</span></td>
    </tr>`;
    $("#mytbody").append(strHTML);
}