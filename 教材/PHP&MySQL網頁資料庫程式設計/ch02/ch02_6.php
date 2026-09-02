<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8"/>
<title>ch02_6.php</title>
</head>
<body>
<p>
<?php
//常數
define("PI", 3.1416);
define("PIN", "圓周率");

print PIN."=".PI."<br>\n"; //使用print指令輸出
 ?>
</p>

<?php
$num = 100;
$a = "$num";
$b = '$num';
echo "$a $b";
?>

<hr/>

</body>
</html>