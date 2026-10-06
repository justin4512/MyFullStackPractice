import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});
Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Change Text!!',
      home: const MyHomePage(),    
    );
  }
}

class MyHomePage extends StatelessWidget {
  const MyHomePage({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color.fromARGB(255, 252, 189, 0),
      appBar: AppBar(
        backgroundColor: Colors.redAccent,
        title: const Text(
          'Container Widget',
          style: TextStyle(backgroundColor: Color(0xFF00FF00)),
        ),
      ),
      body: Center(
        child: Container(
          alignment: Alignment.topCenter,
          color: const Color.fromARGB(255, 30, 21, 165),
          margin: const EdgeInsets.all(45.0),
          padding: const EdgeInsets.all(50.0),
          child: const Text(
            '金洲勇士隊\n奪冠軍\n烙賽',
            style: TextStyle(
              fontSize: 40,
              color: Color(0xffffffff),
              decoration: TextDecoration.underline,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.start,
            maxLines: 3,
          ),
        ),
      ),    
    );
  }
}
