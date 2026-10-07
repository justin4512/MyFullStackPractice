import 'package:flutter/material.dart';
import 'package:fluttertoast/fluttertoast.dart';

void _showToast() {
    Fluttertoast.showToast(
      msg: '按鈕',
      toastLength: Toast.LENGTH_LONG,
      gravity: ToastGravity.BOTTOM,
      backgroundColor: const Color.fromARGB(255, 248, 223, 83),
      textColor: const Color.fromARGB(255, 59, 59, 59),
      fontSize: 20.0,
    );
  }
  void _showSnackBar(BuildContext context, String message) {
    final snackBar = SnackBar(
      //可變動的變數，const要拿掉
      content: Text(message), //對應到上面
      duration: const Duration(seconds: 3),
      backgroundColor: Colors.brown,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.0)),
      action: SnackBarAction(
        label: 'Toast', 
        onPressed: _showToast,
        textColor: Colors.white,
      ),
    );
    ScaffoldMessenger.of(context)
     ..hideCurrentSnackBar()..showSnackBar(snackBar);
  }

  class AppBody extends StatelessWidget {
    const AppBody({super.key});
    @override
    Widget build(BuildContext context) {
      return Center(
        child: Column(
          //直的軸線對齊方式
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container
            (
              //多按鈕的距離要margin
              margin: const EdgeInsets.symmetric(vertical: 10.0),
              //padding: const EdgeInsets.all(30.0),
              child: ElevatedButton
              (
                //onPressed: showToast, 
                onPressed: () => _showSnackBar(context,"Button1"),
                style: ElevatedButton.styleFrom
                (
                  backgroundColor: const Color.fromARGB(255, 78, 189, 245),
                  elevation: 8.0,
                  padding: const EdgeInsets.symmetric(horizontal: 30.0,vertical: 15.0,),
                ),
                
                child: const Text
                (
                  'button1',
                  style: TextStyle(fontSize: 20.0,color: Color.fromARGB(255, 247, 245, 244),),    
                ),
              ),
            ),         
        
            Container(
              margin: const EdgeInsets.symmetric(vertical: 10.0),
              child: TextButton(
                onPressed: () => _showSnackBar(context,"Button2"),
                style: TextButton.styleFrom(foregroundColor: const Color.fromARGB(255, 0, 126, 230)),            
                child: Text(
                  'button2',
                  style: TextStyle(fontSize: 20.0, color: Color.fromARGB(255, 3, 3, 3),),
                ),
              ),
            ),

            Container(
              margin: const EdgeInsets.symmetric(vertical: 10.0),
              child: OutlinedButton(
                onPressed: () => _showSnackBar(context,"Button3"),
                style: OutlinedButton.styleFrom
                (
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric
                  (
                    horizontal: 30.0,
                    vertical: 15.0,
                  ),
                
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.0)),            
                  side: const BorderSide
                  (
                    color: Colors.green, 
                    width: 2.0
                  ),
                ),
                child: Text(
                  'button3',
                  style: TextStyle(fontSize: 20.0, color: Color.fromARGB(255, 253, 83, 83),),
                ),
              ),
            ),  
          ],
        ),
      );
    }
  }