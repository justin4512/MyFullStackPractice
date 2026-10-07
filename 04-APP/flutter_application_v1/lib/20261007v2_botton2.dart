import 'package:flutter/material.dart';
import 'package:fluttertoast/fluttertoast.dart';

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

  void showToast() {
    Fluttertoast.showToast(
      msg: '按鈕',
      toastLength: Toast.LENGTH_LONG,
      gravity: ToastGravity.BOTTOM,
      backgroundColor: const Color.fromARGB(255, 248, 223, 83),
      textColor: const Color.fromARGB(255, 59, 59, 59),
      fontSize: 20.0,
    );
  }
  void showSnackBar(BuildContext context) {
    final snackBar = SnackBar(
      content: const Text('你按了按鈕'),
      duration: const Duration(seconds: 3),
      backgroundColor: Colors.brown,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.0)),
      action: SnackBarAction(
        label: 'Toast', 
        onPressed: showToast,
        textColor: Colors.white,
      ),
    );
    ScaffoldMessenger.of(context).showSnackBar(snackBar);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color.fromARGB(255, 218, 169, 96),
        title: const Text(
          'Design of Elevated Button',
        ),
      ),
      body: Center(
        child: Container(
          padding: const EdgeInsets.all(30.0),
          child: ElevatedButton(
            //onPressed: showToast, 
            onPressed: () => showSnackBar(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color.fromARGB(255, 78, 189, 245),
              elevation: 8.0,
              padding: const EdgeInsets.symmetric(
                horizontal: 30.0,
                vertical: 15.0,
              ),
            ),
            child: const Text(
              'button',
              style: TextStyle(
                fontSize: 20.0,
                color: Color.fromARGB(255, 247, 245, 244),
              ),
            ),
          ),
        ),
      ),
    );
  }
}


