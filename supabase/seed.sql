-- Public preset metadata only. These are generic demo labels, not claims about current bank products.
insert into public.card_issuers (name, country_code, slug, is_public_template)
values ('演示银行', 'KR', 'demo-bank', true), ('演示金融', 'KR', 'demo-finance', true), ('演示卡社', 'KR', 'demo-card-company', true)
on conflict do nothing;

insert into public.benefit_categories (slug, name_zh_cn, name_ko_kr, name_en, icon_key, is_public_template, sort_order)
values
  ('coffee','咖啡','커피','Coffee','coffee',true,10), ('dining','餐饮','외식','Dining','utensils',true,20),
  ('convenience','便利店','편의점','Convenience store','store',true,30), ('grocery','超市','마트','Grocery','shopping-cart',true,40),
  ('delivery','外卖','배달','Delivery','bike',true,50), ('online-shopping','网购','온라인 쇼핑','Online shopping','shopping-bag',true,60),
  ('department-store','百货商店','백화점','Department store','building',true,70), ('transport','交通','교통','Transport','train',true,80),
  ('public-transit','公共交通','대중교통','Public transit','bus',true,90), ('taxi','出租车','택시','Taxi','car',true,100),
  ('fuel','加油','주유','Fuel','fuel',true,110), ('telecom','通信费','통신비','Telecom','phone',true,120),
  ('utilities','水电煤','공과금','Utilities','zap',true,130), ('streaming','流媒体','스트리밍','Streaming','play',true,140),
  ('cinema','电影','영화','Cinema','film',true,150), ('entertainment','文化娱乐','문화 생활','Entertainment','music',true,160),
  ('fitness','健身','피트니스','Fitness','dumbbell',true,170), ('beauty','美容','뷰티','Beauty','sparkles',true,180),
  ('medical','医疗','의료','Medical','cross',true,190), ('pharmacy','药店','약국','Pharmacy','pill',true,200),
  ('education','教育','교육','Education','book',true,210), ('travel','旅行','여행','Travel','luggage',true,220),
  ('airline','航空','항공','Airline','plane',true,230), ('airport-lounge','机场贵宾厅','공항 라운지','Airport lounge','armchair',true,240),
  ('hotel','酒店','호텔','Hotel','hotel',true,250), ('hotel-valet','酒店代客泊车','호텔 발레파킹','Hotel valet','car-front',true,260),
  ('parking','停车','주차','Parking','parking',true,270), ('car-rental','租车','렌터카','Car rental','car',true,280),
  ('duty-free','免税店','면세점','Duty free','shopping-bag',true,290), ('overseas','海外消费','해외 결제','Overseas','globe',true,300),
  ('installment','分期','할부','Installment','calendar',true,310), ('insurance','保险','보험','Insurance','shield',true,320),
  ('other','其他','기타','Other','tag',true,999)
on conflict do nothing;
