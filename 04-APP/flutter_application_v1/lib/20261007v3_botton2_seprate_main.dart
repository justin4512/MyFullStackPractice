import 'package:flutter/material.dart';
import 'package:flutter_application_v1/20261007v3_botton2_seprate_body.dart';
void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Elevated Button',
      home: const MyHomePage(),
    );
  }
}

class MyHomePage extends StatelessWidget {
  const MyHomePage({super.key});  

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color.fromARGB(255, 218, 169, 96),
        title: const Text(
          'Design of Elevated Button',
        ),
      ),
      body: const AppBody(),
    );
  }
}


