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
<?php
  $bk_Name ="PHP變數與應用";
  $bk_Price=100;
  print "<tr>\n";
  print '<td headers="bookName">'.$bk_Name."</td>\n";
  print '<td headers="bookPrice">'.$bk_Price."</td>\n";
  print "</tr>\n";
  print "<tr>\n";
  print "<td headers=\"bookName\"> $bk_Name</td>\n";
  print "<td headers=\"bookPrice\"> $bk_Price </td>\n";  
  print "</tr>"
?>
</table>
<hr/>

</body>
</html>