<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8"/>
<title>ch02_12.php</title>
</head>
<body>
<p>
<?php
 	   $i=0;
       $A=0;
        do {
         $i=$i+1; //$i++ 也可
         $A=$A+$i;
         print "\$A=$A<br>";
        }while ($i<100) 
 
 ?>
</p>

<hr/>

</body>
</html>