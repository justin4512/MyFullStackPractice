<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8"/>
<title>ch02_10.php</title>
</head>
<body>
<p>
<?php
$A = 80 ;
if ($A >=  80 ) {
    echo "A級分";
}
elseif  ($A>=70) {
    echo "B級分";
}
elseif ($A>=60) {
    echo "C級分";
}
else {
    echo "D級分";
}

echo "<br>結束" ;


 ?>
</p>

<hr/>

</body>
</html>