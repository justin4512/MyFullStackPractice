const products = [
        {
            "ID": "1",
            "name": "伯牙絕弦",
            "en_name": "Jasmine Green Tea Latte",
            "category": "原葉鮮奶茶",
            "price": 65,
            "weight": "500ml",
            "tea_base": "茉莉雪芽",
            "calories": 130,
            "desc": "霸王茶姬銷量冠軍，七窨茉莉茶香交融濃醇優質鮮乳，清新淡雅。",
            "sales_records": [
                {
                    "order_id": "ORD-20261004-0102",
                    "purchase_time": "2026-10-04 12:35:18",
                    "channel": "線上點餐(門市自取)",
                    "quantity": 2,
                    "total_amount": 130,
                    "payment": {
                        "method": "LINE Pay",
                        "status": "已付款"
                    },
                    "customer": {
                        "customer_id": "VIP-9527",
                        "name": "林雨萱",
                        "gender": "女",
                        "member_tier": "黑金卡會員",
                        "contact": {
                            "phone": "0988-***-123",
                            "city": "台北市信義區"
                        }
                    },
                    "customization": {
                        "sweetness": "微糖(3分)",
                        "ice_level": "微冰",
                        "toppings": ["茉莉茶凍"]
                    },
                    "feedback": {
                        "rating": 5,
                        "comment": "茉莉香氣很幽雅，微糖配鮮奶甜度剛剛好！"
                    }
                },
                {
                    "order_id": "ORD-20261005-0043",
                    "purchase_time": "2026-10-05 09:12:05",
                    "channel": "現場櫃台",
                    "quantity": 1,
                    "total_amount": 65,
                    "payment": {
                        "method": "信用卡載具",
                        "status": "已付款"
                    },
                    "customer": {
                        "customer_id": "MEM-3312",
                        "name": "張家豪",
                        "gender": "男",
                        "member_tier": "一般會員",
                        "contact": {
                            "phone": "0912-***-886",
                            "city": "新北市板橋區"
                        }
                    },
                    "customization": {
                        "sweetness": "無糖",
                        "ice_level": "去冰",
                        "toppings": []
                    },
                    "feedback": {
                        "rating": 4,
                        "comment": "無糖能喝出茶底的天然回甘，很耐喝。"
                    }
                }
            ]
        },
        {
            "ID": "2",
            "name": "花田烏龍",
            "en_name": "White Peach Oolong Latte",
            "category": "原葉鮮奶茶",
            "price": 65,
            "weight": "500ml",
            "tea_base": "白桃烏龍",
            "calories": 142,
            "desc": "清甜白桃香氣伴隨焙火烏龍茶韻，入口如漫步春日花田。",
            "sales_records": [
                {
                    "order_id": "ORD-20261004-0521",
                    "purchase_time": "2026-10-04 15:20:44",
                    "channel": "外送平台(UberEats)",
                    "quantity": 3,
                    "total_amount": 225,
                    "payment": {
                        "method": "Apple Pay",
                        "status": "已付款"
                    },
                    "customer": {
                        "customer_id": "VIP-1108",
                        "name": "陳映竹",
                        "gender": "女",
                        "member_tier": "白金卡會員",
                        "contact": {
                            "phone": "0933-***-567",
                            "city": "台中市西區"
                        }
                    },
                    "customization": {
                        "sweetness": "半糖(5分)",
                        "ice_level": "少冰",
                        "toppings": ["白玉珍珠", "桂花凍"]
                    },
                    "feedback": {
                        "rating": 5,
                        "comment": "辦公室下午茶必點，白桃香氣超級療癒！"
                    }
                }
            ]
        },
        {
            "ID": "13",
            "name": "青青糯山",
            "en_name": "Glutinous Pu-erh Pure Tea",
            "category": "東方純茶",
            "price": 45,
            "weight": "500ml",
            "tea_base": "糯香生普洱",
            "calories": 0,
            "desc": "自帶天然糯米草香氣的雲南高山茶，零卡無負擔，生津止渴。",
            "sales_records": [
                {
                    "order_id": "ORD-20261003-0889",
                    "purchase_time": "2026-10-03 18:40:12",
                    "channel": "現場櫃台",
                    "quantity": 1,
                    "total_amount": 45,
                    "payment": {
                        "method": "現金",
                        "status": "已付款"
                    },
                    "customer": {
                        "customer_id": "MEM-8721",
                        "name": "黃冠宇",
                        "gender": "男",
                        "member_tier": "金卡會員",
                        "contact": {
                            "phone": "0921-***-902",
                            "city": "桃園市中壢區"
                        }
                    },
                    "customization": {
                        "sweetness": "無糖",
                        "ice_level": "常溫",
                        "toppings": []
                    },
                    "feedback": {
                        "rating": 5,
                        "comment": "天然糯米香非常迷人，無糖熱泡或常溫解油膩首選。"
                    }
                }
            ]
        },
        {
            "ID": "23",
            "name": "桃妹烏龍",
            "en_name": "Fresh Peach Oolong Tea",
            "category": "鮮萃果茶",
            "price": 75,
            "weight": "500ml",
            "tea_base": "白桃烏龍",
            "calories": 165,
            "desc": "當季手剝水蜜桃鮮肉融入高山烏龍，果肉脆嫩多汁，茶感清甜回甘。",
            "sales_records": [
                {
                    "order_id": "ORD-20261005-0158",
                    "purchase_time": "2026-10-05 13:10:27",
                    "channel": "線上點餐(門市自取)",
                    "quantity": 2,
                    "total_amount": 170,
                    "payment": {
                        "method": "悠遊付",
                        "status": "已付款"
                    },
                    "customer": {
                        "customer_id": "VIP-6632",
                        "name": "蘇敏琪",
                        "gender": "女",
                        "member_tier": "黑金卡會員",
                        "contact": {
                            "phone": "0960-***-311",
                            "city": "台南市東區"
                        }
                    },
                    "customization": {
                        "sweetness": "微糖(3分)",
                        "ice_level": "少冰",
                        "toppings": ["寒天晶球"]
                    },
                    "feedback": {
                        "rating": 5,
                        "comment": "果肉很多咬得到脆感，搭配晶球口感超棒！"
                    }
                }
            ]
        },
        {
            "ID": "28",
            "name": "白雪大紅袍",
            "en_name": "Cheese Foam Dahongpao",
            "category": "芝士雪頂",
            "price": 80,
            "weight": "500ml",
            "tea_base": "武夷岩茶大紅袍",
            "calories": 235,
            "desc": "特調鹹甜海鹽芝士奶蓋厚厚覆蓋，岩茶醇苦與醇滑芝士在舌尖碰撞融合。",
            "sales_records": [
                {
                    "order_id": "ORD-20261004-0994",
                    "purchase_time": "2026-10-04 16:45:00",
                    "channel": "現場櫃台",
                    "quantity": 1,
                    "total_amount": 80,
                    "payment": {
                        "method": "街口支付",
                        "status": "已付款"
                    },
                    "customer": {
                        "customer_id": "MEM-4099",
                        "name": "周彥霖",
                        "gender": "男",
                        "member_tier": "銀卡會員",
                        "contact": {
                            "phone": "0975-***-654",
                            "city": "新竹市東區"
                        }
                    },
                    "customization": {
                        "sweetness": "微糖(3分)",
                        "ice_level": "去冰",
                        "toppings": ["海鹽芝士奶蓋加倍"]
                    },
                    "feedback": {
                        "rating": 5,
                        "comment": "奶蓋厚實鹹甜，大紅袍茶底很厚，兩者搭配堪稱一絕。"
                    }
                }
            ]
        },
        {
            "ID": "32",
            "name": "冷萃金萱",
            "en_name": "Cold Brew Jinxuan Oolong",
            "category": "冷萃原茶",
            "price": 60,
            "weight": "500ml",
            "tea_base": "阿里山金萱烏龍",
            "calories": 0,
            "desc": "低溫慢速冷泡十二小時，天然微奶香與花香完全釋放，甘甜不苦澀。",
            "sales_records": [
                {
                    "order_id": "ORD-20261005-0210",
                    "purchase_time": "2026-10-05 11:05:33",
                    "channel": "外送平台(Foodpanda)",
                    "quantity": 2,
                    "total_amount": 120,
                    "payment": {
                        "method": "信用卡",
                        "status": "已付款"
                    },
                    "customer": {
                        "customer_id": "MEM-1205",
                        "name": "郭芷晴",
                        "gender": "女",
                        "member_tier": "金卡會員",
                        "contact": {
                            "phone": "0918-***-432",
                            "city": "高雄市左營區"
                        }
                    },
                    "customization": {
                        "sweetness": "固定無糖",
                        "ice_level": "固定冷萃(微冰)",
                        "toppings": []
                    },
                    "feedback": {
                        "rating": 4,
                        "comment": "金萱的淡淡奶香在冷泡下很突出，完全不苦澀！"
                    }
                }
            ]
        }
    ]