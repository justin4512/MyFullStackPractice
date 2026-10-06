import 'package:flutter/material.dart';

void main() {
  
  
  var appBar = AppBar(
    backgroundColor: Colors.amber,
    title: Text('Fitst Flutter App',
      style: TextStyle(fontSize: 30, color: Colors.blueAccent,),
    )
  );

  var appBody = Center(
    child: Text('Hi! Flutter!!', 
    style: TextStyle(
      fontSize: 30,
      color: Colors.blueAccent,),
    )
  );

  var app = MaterialApp(
    home: Scaffold(
      appBar: appBar,
      body: appBody,
    ),
  );

  runApp(app);

}
