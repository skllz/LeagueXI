-- World Cup 2026 Teams
-- 48 qualified nations

insert into public.teams (id, name, short_name, country) values
-- Group A
('t-usa','United States','USA','United States'),
('t-pan','Panama','PAN','Panama'),
('t-uru','Uruguay','URU','Uruguay'),
('t-bfa','Burkina Faso','BFA','Burkina Faso'),
-- Group B
('t-arg','Argentina','ARG','Argentina'),
('t-chl','Chile','CHI','Chile'),
('t-alg','Algeria','ALG','Algeria'),
('t-ukr','Ukraine','UKR','Ukraine'),
-- Group C
('t-mex','Mexico','MEX','Mexico'),
('t-guy','Guyana','GUY','Guyana'),
('t-kor','South Korea','KOR','South Korea'),
('t-irq','Iraq','IRQ','Iraq'),
-- Group D
('t-can','Canada','CAN','Canada'),
('t-jor','Jordan','JOR','Jordan'),
('t-bel','Belgium','BEL','Belgium'),
('t-civ','Côte d''Ivoire','CIV','Côte d''Ivoire'),
-- Group E
('t-ger','Germany','GER','Germany'),
('t-jpg','Japan','JPN','Japan'),
('t-crc','Costa Rica','CRC','Costa Rica'),
('t-ecl','Ecuador','ECU','Ecuador'),
-- Group F
('t-por','Portugal','POR','Portugal'),
('t-aut','Austria','AUT','Austria'),
('t-egy','Egypt','EGY','Egypt'),
('t-bov','Bolivia','BOL','Bolivia'),
-- Group G
('t-spa','Spain','ESP','Spain'),
('t-sco','Scotland','SCO','Scotland'),
('t-sau','Saudi Arabia','KSA','Saudi Arabia'),
('t-nig','Nigeria','NGA','Nigeria'),
-- Group H
('t-bra','Brazil','BRA','Brazil'),
('t-par','Paraguay','PAR','Paraguay'),
('t-swe','Sweden','SWE','Sweden'),
('t-tun','Tunisia','TUN','Tunisia'),
-- Group I
('t-fra','France','FRA','France'),
('t-cro','Croatia','CRO','Croatia'),
('t-mar','Morocco','MAR','Morocco'),
('t-tnz','Tanzania','TAN','Tanzania'),
-- Group J
('t-eng','England','ENG','England'),
('t-ser','Serbia','SRB','Serbia'),
('t-mex2','Honduras','HON','Honduras'),
('t-ang','Angola','ANG','Angola'),
-- Group K
('t-net','Netherlands','NED','Netherlands'),
('t-pol','Poland','POL','Poland'),
('t-sen','Senegal','SEN','Senegal'),
('t-aus','Australia','AUS','Australia'),
-- Group L
('t-ira','Iran','IRN','Iran'),
('t-mrc','South Africa','RSA','South Africa'),
('t-swz','Switzerland','SUI','Switzerland'),
('t-col','Colombia','COL','Colombia')
on conflict (id) do nothing;
