import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(title: 'Change Text!!', home: const MyHomePage());
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
          'Row Widget',
          style: TextStyle(backgroundColor: Color(0xFF00FF00)),
        ),
      ),
      body: Container(
        margin: const EdgeInsets.all(20.0),
        color: const Color(0xFFFFFFFF),
        height: 300,
        width: 300,
        transform: Matrix4.translationValues(50, 50, 0),
        child: Column(  //也可以改成Row
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              flex:3,
              child: Container(
                margin: const EdgeInsets.fromLTRB(10, 15, 20, 25 ),
                child: const Text(
                  'Flutter01',
                  style: TextStyle(
                    fontSize: 20.0,
                    color: Colors.white,
                    backgroundColor: Colors.blue,
                  ),
                ),
              ),
            ),
            Expanded(
              flex:2,
              child: Container(
                child: const Text(
                  'Flutter02',
                  style: TextStyle(
                    fontSize: 20.0,
                    color: Colors.black,
                    backgroundColor: Color.fromARGB(255, 252, 227, 8),
                  ),
                ),
              ),
            ),
            Container(
              child: const Text(
                'Flutter03',
                style: TextStyle(
                  fontSize: 20.0,
                  color: Colors.red,
                  backgroundColor: Color.fromARGB(255, 33, 243, 233),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
