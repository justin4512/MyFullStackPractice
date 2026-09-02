<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>ch03_5.php</title>
</head>
<body>
<table>
    <?php 
     foreach ($_SERVER as $key=>$value)  {
     echo '<tr>';
     echo '<td>'.$key.'</td>';
     echo '<td>'.$value.'</td>'; }
     echo '<tr';
     ?>
</table>
</body>
</html>