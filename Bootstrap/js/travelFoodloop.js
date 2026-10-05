$("#mytbody").empty(); //將範例表格留著日後使用，但網頁迴圈載入前先清空範例資料
for (let i = 0; i < food.length; i++) {
    //將表格內容轉為字串
    const strHTML = `<tr>
        <td data-th="編號"><span class="table-col">${food[i].ID}</span></td>
        <td data-th="景點名稱"><span class="table-col">${food[i].Name}</span></td>
        <td data-th="景點地址"><span class="table-col">${food[i].City}${food[i].Address}</span></td>
        <td data-th="電話"><span class="table-col">${food[i].Tel}</span></td>
        <td data-th="景點圖示"><span class="table-col"><img src="${food[i].PicURL}" alt="${food[i].Name}" class="img-fluid" loading="lazy"></span></td>
        <td data-th="景點描述"><span class="table-col scroll-box">${food[i]?.FoodFeature?.trim() || "目前無資訊"}</span></td>
    </tr>`;
    $("#mytbody").append(strHTML);
}