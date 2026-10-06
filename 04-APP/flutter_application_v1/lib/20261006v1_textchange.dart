import 'package:flutter/material.dart';

void main() {
  // runApp() 是 Flutter 官方 SDK 內建的核心函式，
  // 存放在你程式碼第一行引入的 package:flutter/material.dart
  // （準確地說是底層的 widgets.dart）裡面
  // const MyApp()是這段程式在下面定義的類別（Class）所實例化出來的物件
  runApp(const MyApp());
}

//StatelessWidget（無狀態元件）：Flutter 官方提供的「無狀態元件」模具。
//繼承它之後，你的 MyApp 就正式擁有了變成「Flutter 畫面元件」的能力。

class MyApp extends StatelessWidget {
  //{super.key}：這是 Flutter 用來管理各個元件的「身分證字號（Key）」。
  //super 代表把這個身分證號碼往上傳給StatelessWidget，
  //讓 Flutter 引擎在背後調度畫面時不會認錯人。
  const MyApp({super.key});

  //以下這一段是「畫圖的實作過程」。
  // @override意思是「父層（StatelessWidget）原本有一套預設的畫圖方法，
  // 但現在我要用我自己寫的規則來取代它！」
  @override
  //Widget：代表這個大括號 { ... } 執行完後，
  //必須回傳一個 Flutter 的畫面元件給系統。
  //build(...)：這是 Flutter 規定一定要寫的函式名稱，
  //當 App 要顯示這個元件時，就會自動來執行這個 build 裡面的內容。
  //BuildContext context：這是「上下文 / 關係圖」。
  //它像是一張地圖，讓這個元件知道自己目前在整個 App 架構中的哪個位置、
  //週邊有哪些資源可以用。
  Widget build(BuildContext context) {
    //MaterialApp：這是 Flutter 內建最強大的外殼元件。
    //處理好了很多底層瑣事（例如網頁版的網址、Android/iOS 的多國語言支援、全域字體等）。
    return MaterialApp(
      //title是 App 的標題。在 Android 手機上代表「切換多工視窗時顯示的 App 名稱」；
      //在網頁版代表「瀏覽器的分頁標籤名稱」
      title: 'Change Text!!',
      //home定義「首頁是誰」。這行直接指定App外殼套好後，
      //裡面第一個要秀給使用者看的畫面內容，就是 MyHomePage()。
      home: const MyHomePage(),    
    );
  }
}
//建立一個叫MyHomePage的物件並繼承StatelessWidget
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
      body: const Center(
        child: Text(
          'Stateless\nWidge',
          style: TextStyle(
            fontSize: 30.5,
            color: Color(0xFFFF0000),
            decoration: TextDecoration.underline,
            fontWeight: FontWeight.bold,
          ),
          textAlign: TextAlign.start,
          maxLines: 2,
        ),
      ),    
    );
  }
}
