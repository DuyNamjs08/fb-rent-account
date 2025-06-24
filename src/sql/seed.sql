INSERT INTO budgets (id, name, description, amount, currency, start_date, end_date, percentage, country, created_at, updated_at)
VALUES 
-- Việt Nam
(gen_random_uuid(), 'Ngân sách VN dưới 500 triệu', ARRAY['Áp dụng cho ngân sách dưới 500 triệu VND'], 500000000, 'VND', NULL, NULL, 0.05, 'vi', now(), now()),
(gen_random_uuid(), 'Ngân sách VN từ 500 triệu - 1 tỷ', ARRAY['Áp dụng cho ngân sách từ 500 triệu đến 1 tỷ VND'], 1000000000, 'VND', NULL, NULL, 0.04, 'vi', now(), now()),
(gen_random_uuid(), 'Ngân sách VN từ 1 tỷ - 2 tỷ', ARRAY['Áp dụng cho ngân sách từ 1 tỷ đến 2 tỷ VND'], 2000000000, 'VND', NULL, NULL, 0.03, 'vi', now(), now()),

-- Thái Lan
(gen_random_uuid(), 'Ngân sách Thailand dưới 20k USD', ARRAY['Áp dụng cho ngân sách dưới 20k USD'], 20000, 'USD', NULL, NULL, 0.05, 'th', now(), now()),
(gen_random_uuid(), 'Ngân sách Thailand từ 20k - 50k USD', ARRAY['Áp dụng cho ngân sách từ 20k đến 50k USD'], 50000, 'USD', NULL, NULL, 0.04, 'th', now(), now()),
(gen_random_uuid(), 'Ngân sách Thailand từ 50k - 100k USD', ARRAY['Áp dụng cho ngân sách từ 50k đến 100k USD'], 100000, 'USD', NULL, NULL, 0.03, 'th', now(), now()),
(gen_random_uuid(), 'Ngân sách Thailand từ 100k - 200k USD', ARRAY['Áp dụng cho ngân sách từ 100k đến 200k USD'], 200000, 'USD', NULL, NULL, 0.02, 'th', now(), now());
