begin;

create temp table tmp_town_kana(
prefecture text,
city text,
town text,
town_kana text
);

insert into tmp_town_kana values
('栃木県','那須郡那珂川町','富山','とみやま'),
('栃木県','那須郡那珂川町','馬頭','ばとう'),
('栃木県','那須郡那珂川町','東戸田','ひがしとだ'),
('栃木県','那須郡那珂川町','松野','まつの'),
('栃木県','那須郡那珂川町','三輪','みわ'),
('栃木県','那須郡那珂川町','盛泉','もりいずみ'),
('栃木県','那須郡那珂川町','谷川','やかわ'),
('栃木県','那須郡那珂川町','谷田','やだ'),
('栃木県','那須郡那珂川町','矢又','やまた'),
('栃木県','那須郡那珂川町','芳井','よしい'),
('栃木県','那須郡那珂川町','吉田','よしだ'),
('栃木県','那須郡那珂川町','和見','わみ');

update jp_towns t
set town_kana = s.town_kana
from tmp_town_kana s
where t.prefecture=s.prefecture
and t.city=s.city
and t.town=s.town;

commit;