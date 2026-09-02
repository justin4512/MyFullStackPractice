<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8"/>
<title>ch02_18.php</title>
</head>
<body>
<p>
<?php
   $vMath=$_GET['sMath'];
   $vChinese=$_GET['sChinese'];
   $vEnglish=$_GET['sEnglish'];  
   if (is_numeric($vMath) && is_numeric($vChinese) && is_numeric($vEnglish)){
   $vSum=($vMath+$vChinese+$vEnglish);
   $vAvg=$vSum/3;
   echo "數學成績:$vMath<br>";
   echo "國文成績:$vChinese<br>";
   echo "英文成績:$vEnglish<br>";
   echo "成績總分:$vSum<br>";
   echo "平均成績:$vAvg<br>";}
   else
    print "請輸入數字<br>";

?>
</p>
</body>
</html>