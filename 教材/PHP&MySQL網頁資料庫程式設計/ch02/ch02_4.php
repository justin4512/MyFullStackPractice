<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8"/>
<title>ch02_1.html</title>
</head>
<body>
<p>
<?php
//書籍資料標頭
 print "書籍"."資料".":<br>\n"; //使用print指令輸出
 print "<h1>當程式太長的時候，".
       "換列請要加.不然會發生錯誤</h1>";
 ?>
</p>
<table border="1">
<tr>
   <th id="bookName">書名</th>
   <th id="bookPrice">價格</th>
</tr>
<tr>
   <td headers="bookName">PHP學習手冊</td>
   <td headers="bookPrice">300</td>
</tr>
<tr>
   <td>MySQL學習手冊</td>
   <td>250</td>
</tr>
</table>
<hr/>

</body>
</html>