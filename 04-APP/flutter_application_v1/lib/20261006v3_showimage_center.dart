import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});
@override
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
      backgroundColor: Colors.amber,
      appBar: AppBar(
        backgroundColor: Colors.redAccent,
        title: const Text(
          'Change Test',
          style: TextStyle(backgroundColor: Color(0xFF00FF00)),
        ),
      ),
      body: Center(
        heightFactor: 1,
        widthFactor: 3,
        child: Stack(
          alignment: Alignment.topCenter,
          children: [
          //本地端圖片寫法
          //Image.asset('assets/images/Warriors_black.jpg'),
          //網路圖片寫法
          Image.network('https://image.knowing.asia/fa2a9985-98db-41a8-947f-cb8070624687/657da15d3e588a302ce07c70040f4c25.png', cacheWidth: 350, cacheHeight: 350,),
            const Text(
            '金洲勇士隊',
            style: TextStyle(
              fontSize: 40,
              color: Color(0xFFFFFFFF),
              decoration: TextDecoration.underline,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.start,
            maxLines: 2,
          ),
        ],
        ),
      ),    
    );
  }
}
