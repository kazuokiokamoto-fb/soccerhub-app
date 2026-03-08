begin;

create table if not exists public.jp_prefectures (
  prefecture text primary key,
  prefecture_kana text
);

create table if not exists public.jp_municipalities (
  prefecture text not null,
  prefecture_kana text,
  city text not null,
  city_kana text,
  primary key (prefecture, city)
);

create table if not exists public.jp_towns (
  prefecture text not null,
  prefecture_kana text,
  city text not null,
  city_kana text,
  town text not null,
  town_kana text,
  primary key (prefecture, city, town)
);

truncate table public.jp_prefectures;

insert into public.jp_prefectures (prefecture, prefecture_kana)
values
('愛知県', 'アイチケン'),
('青森県', 'アオモリケン'),
('秋田県', 'アキタケン'),
('石川県', 'イシカワケン'),
('茨城県', 'イバラキケン'),
('岩手県', 'イワテケン'),
('愛媛県', 'エヒメケン'),
('大分県', 'オオイタケン'),
('大阪府', 'オオサカフ'),
('岡山県', 'オカヤマケン'),
('沖縄県', 'オキナワケン'),
('香川県', 'カガワケン'),
('鹿児島県', 'カゴシマケン'),
('神奈川県', 'カナガワケン'),
('岐阜県', 'ギフケン'),
('京都府', 'キョウトフ'),
('熊本県', 'クマモトケン'),
('群馬県', 'グンマケン'),
('高知県', 'コウチケン'),
('埼玉県', 'サイタマケン'),
('佐賀県', 'サガケン'),
('滋賀県', 'シガケン'),
('静岡県', 'シズオカケン'),
('島根県', 'シマネケン'),
('千葉県', 'チバケン'),
('東京都', 'トウキョウト'),
('徳島県', 'トクシマケン'),
('栃木県', 'トチギケン'),
('鳥取県', 'トットリケン'),
('富山県', 'トヤマケン'),
('長崎県', 'ナガサキケン'),
('長野県', 'ナガノケン'),
('奈良県', 'ナラケン'),
('新潟県', 'ニイガタケン'),
('兵庫県', 'ヒョウゴケン'),
('広島県', 'ヒロシマケン'),
('福井県', 'フクイケン'),
('福岡県', 'フクオカケン'),
('福島県', 'フクシマケン'),
('北海道', 'ホッカイドウ'),
('三重県', 'ミエケン'),
('宮城県', 'ミヤギケン'),
('宮崎県', 'ミヤザキケン'),
('山形県', 'ヤマガタケン'),
('山口県', 'ヤマグチケン'),
('山梨県', 'ヤマナシケン'),
('和歌山県', 'ワカヤマケン');

commit;