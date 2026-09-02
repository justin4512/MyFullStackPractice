<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8"/>
<title>ch02_15.php</title>
</head>
<body>
<p>
<?php
$vMath=$_POST['sMath'];
$vPass=$_POST['Pass'];
$vAddress=$_POST['Address'];
$vR1=$_POST['R1'];
$vS1=$_POST['S1'];

print "sMath=$vMath<br>";
print "Pass=$vPass<br>";
print "Address=$vAddress<br>";
if (isset($_POST['C1'])){
$vC1=$_POST['C1'];
for ($i=0;$i<count($vC1);$i++){ 
    print "C[$i]=$vC1[$i]<br>";
}
}
print "R1=$vR1<br>";
print "S1=$vS1<br>";

?>
</p>
</body>
</html>