<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8"/>
<title>ch02_11.php</title>
</head>
<body>
<p>
<?php
$A = 4 ;
Switch ($A) {
Case 1:
	echo "A級分";
	break;
Case 2:
	echo "級分";
	break;
Case 3:
	echo "C級分";
	break;
Default:
   echo "D級分";
}


echo "<br>結束" ;


 ?>
</p>

<hr/>

</body>
</html>