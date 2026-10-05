//串接
$.ajax({
    type: "GET",
    url: "js/HotelList.json",
    dataType: "json",
    success: showdata,
    error: function() {
        console.log("資料介接失敗!");
    }
});

function showdata(data) {
    $("#mytbody").empty(); //將範例表格留著日後使用，但網頁迴圈載入前先清空範例資料

    for (let i = 0; i < 100; i++) {
    //將表格內容轉為字串
    const strHTML = `<tr>
        <td data-th="民宿編號"><span class="table-col">${data.Hotels[i].HotelID}</span></td>
        <td data-th="民宿名稱"><span class="table-col">${data.Hotels[i].HotelName}</span></td>
        <td data-th="民宿地址"><span class="table-col">${data.Hotels[i].PostalAddress.City}${data.Hotels[i].PostalAddress.Town}${data.Hotels[i].PostalAddress.StreetAddress}</span></td>
        <td data-th="民宿電話"><span class="table-col">${data.Hotels[i].Telephones[0]?.Tel ?? "無聯絡方式"}</span></td>
        <td data-th="民宿描述"><span class="table-col scroll-box">${data.Hotels[i]?.Description?.trim() || "目前無資訊"}</span></td>
    </tr>`;
    $("#mytbody").append(strHTML);
    }
}
