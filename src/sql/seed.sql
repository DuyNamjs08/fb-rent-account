INSERT INTO public.budgets (id,name,description,amount,currency,start_date,end_date,created_at,updated_at,percentage,country,overview,subtitle)
VALUES
-- Việt Nam
(gen_random_uuid(),'Dưới 500 triệu',ARRAY['Tiết kiệm thời gian khởi tạo và phê duyệt','Hạn mức chi tiêu cao','Tăng độ uy tín quảng cáo','Giảm rủi ro bị khóa tài khoản','Hỗ trợ kỹ thuật và quản lý','Phù hợp với nhiều mục đích chạy ads','Thanh toán linh hoạt','Dễ test nhiều sản phẩm/ngành hàng'],1000000,'VND',NULL,NULL,now(),now(),5.0,'vi','Lựa chọn kinh tế cho người mới bắt đầu hoặc dự án nhỏ, đảm bảo tài khoản hoạt động ổn định và hỗ trợ thiết lập ban đầu.','Bắt đầu'),
(gen_random_uuid(),'500 triệu - 1 tỷ',ARRAY['Tiết kiệm thời gian khởi tạo và phê duyệt','Hạn mức chi tiêu cao','Tăng độ uy tín quảng cáo','Giảm rủi ro bị khóa tài khoản','Hỗ trợ kỹ thuật và quản lý','Phù hợp với nhiều mục đích chạy ads','Thanh toán linh hoạt','Dễ test nhiều sản phẩm/ngành hàng','Bypass các ngành hàng khó','Có thể mở rộng quy mô nhanh chóng'],500000000,'VND',NULL,NULL,now(),now(),4.0,'vi','Gói dịch vụ phù hợp cho các đơn vị đang mở rộng, cung cấp tài khoản chất lượng với hỗ trợ kỹ thuật đầy đủ và linh hoạt theo nhu cầu.','Best seller'),
(gen_random_uuid(),'1 tỷ - 2 tỷ',ARRAY['Tiết kiệm thời gian khởi tạo và phê duyệt','Hạn mức chi tiêu cao','Tăng độ uy tín quảng cáo','Giảm rủi ro bị khóa tài khoản','Hỗ trợ kỹ thuật và quản lý','Phù hợp với nhiều mục đích chạy ads','Thanh toán linh hoạt','Dễ test nhiều sản phẩm/ngành hàng','Bypass các ngành hàng khó','Có thể mở rộng quy mô nhanh chóng'],100000000,'VND',NULL,NULL,now(),now(),3.0,'vi','Giải pháp mạnh mẽ cho doanh nghiệp vừa và lớn, cân bằng giữa chi phí và hiệu quả, hỗ trợ vận hành liên tục với độ tin cậy cao.','Được yêu thích'),
(gen_random_uuid(),'Trên 2 tỷ',ARRAY['Tiết kiệm thời gian khởi tạo và phê duyệt','Hạn mức chi tiêu cao','Tăng độ uy tín quảng cáo','Giảm rủi ro bị khóa tài khoản','Hỗ trợ kỹ thuật và quản lý','Phù hợp với nhiều mục đích chạy ads','Thanh toán linh hoạt','Dễ test nhiều sản phẩm/ngành hàng','Bypass các ngành hàng khó','Có thể mở rộng quy mô nhanh chóng'],2000000000,'VND',NULL,NULL,now(),now(),NULL,'vi','Dịch vụ cao cấp dành cho các chiến dịch quy mô lớn, hiệu suất cao và quyền truy cập ưu tiên vào các tài nguyên tối ưu nhất.','Đặc biệt'),

-- Thái Lan
(gen_random_uuid(),'Under 20000 USD',ARRAY[
  'Save time on setup and approval',
  'High spending limit',
  'Boost ad credibility',
  'Reduce risk of account bans',
  'Technical and management support',
  'Suitable for various ad goals',
  'Flexible payments',
  'Easily test multiple products/industries'
],1000,'USD',NULL,NULL,now(),now(),5.0,'en',
'A cost-effective option for beginners or small projects, ensuring stable account operation and initial setup support.',
'Start'),
(gen_random_uuid(),'20000 - 50000 USD',ARRAY[
  'Save time on setup and approval',
  'High spending limit',
  'Boost ad credibility',
  'Reduce risk of account bans',
  'Technical and management support',
  'Suitable for various ad goals',
  'Flexible payments',
  'Easily test multiple products/industries',
  'Bypass restricted verticals',
  'Easily scalable'
],20000,'USD',NULL,NULL,now(),now(),4.0,'en',
'A service package suitable for growing businesses, offering high-quality accounts with full technical support tailored to needs.',
'Best seller'),
(gen_random_uuid(),'50000 - 100000 USD',ARRAY[
  'Save time on setup and approval',
  'High spending limit',
  'Boost ad credibility',
  'Reduce risk of account bans',
  'Technical and management support',
  'Suitable for various ad goals',
  'Flexible payments',
  'Easily test multiple products/industries',
  'Bypass restricted verticals',
  'Easily scalable'
],50000,'USD',NULL,NULL,now(),now(),3.0,'en',
'A powerful solution for medium to large businesses, balancing cost and performance with reliable operational support.',
'Popular choice'),
(gen_random_uuid(),'100000 - 200000 USD',ARRAY[
  'Save time on setup and approval',
  'High spending limit',
  'Boost ad credibility',
  'Reduce risk of account bans',
  'Technical and management support',
  'Suitable for various ad goals',
  'Flexible payments',
  'Easily test multiple products/industries',
  'Bypass restricted verticals',
  'Easily scalable'
],100000,'USD',NULL,NULL,now(),now(),2.0,'en',
'Premium service for large-scale, high-performance campaigns with prioritized access to top-tier resources.',
'Special')
