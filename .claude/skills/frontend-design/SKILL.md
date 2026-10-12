---
name: frontend-design
description: Hướng dẫn thiết kế giao diện có chủ đích, có bản sắc khi dựng UI mới hoặc làm đẹp UI cũ trong apps/web. Dùng khi cần quyết định hướng thẩm mỹ, bảng màu, typography, bố cục, chuyển động, và viết chữ giao diện (UX writing) sao cho không bị "mẫu template/AI sinh". Phỏng theo skill frontend-design của Anthropic, điều chỉnh cho CMS (shadcn/ui + Tailwind 4, giao diện tiếng Việt).
---

# Thiết kế frontend có bản sắc

Tiếp cận như **design lead của một studio** nổi tiếng vì mỗi sản phẩm có một bản sắc riêng, không bị nhầm với bất kỳ ai khác. Khách hàng đã từ chối các phương án sáo rỗng/đóng khuôn; họ trả tiền cho một quan điểm thẩm mỹ rõ ràng. Hãy ra **quyết định có chủ đích** về bảng màu, typography, bố cục — phù hợp đúng với bối cảnh của màn này — và dám mạo hiểm thẩm mỹ khi có lý do.

> **Bối cảnh CMS:** đây là tool quản trị nội bộ chạy trên shadcn/ui + Tailwind 4. Skill này dùng cho **giai đoạn làm đẹp UI/UX** và cho các màn cần điểm nhấn (đăng nhập, dashboard, empty state, màn marketing/onboarding nếu có). Với màn CRUD dày đặc (bảng người dùng, danh sách việc), ưu tiên **nhất quán + dễ dùng** trước; vẫn áp dụng phần "quality floor" và "UX writing" ở mọi nơi.

## Bám vào chủ đề (subject matter)
Nếu brief không nói rõ sản phẩm/màn này phục vụ ai và làm gì, **tự xác định trước khi thiết kế** rồi xác nhận lại: một chủ đề cụ thể, đối tượng người dùng, và việc chính màn phải làm. Bản sắc thị giác đến từ ngành nghề, chất liệu, ngôn ngữ riêng của chủ đề — dashboard cho quản lý phòng ban khác hẳn một trang marketing. Luôn dựng với **nội dung thật** của màn, không phải chữ giả chung chung.

## Nguyên tắc thiết kế
- **Hero (phần nhìn thấy đầu tiên) phải là thứ đặc trưng nhất** của màn, ở dạng phù hợp nhất: tiêu đề, ảnh, số liệu, một khoảnh khắc tương tác... Mẫu mặc định "số to + nhãn nhỏ + vài stat + gradient" chỉ dùng khi thật sự là lựa chọn tốt nhất.
- **Typography mang cá tính trang.** Dùng một hoặc hai họ chữ; nếu hai thì phải khác nhau rõ. Chọn typeface có chủ đích, không mặc định reach-for; đặt type scale có cân nhắc weight/width/spacing. Khi chữ làm tiêu đề/điểm nhấn, dùng chính cách set chữ như một phần của thiết kế.
- **Độ dài dòng < 80 ký tự.** Serif có thể dài hơn chút và cần line-height nhỉnh hơn sans-serif.
- **Cấu trúc thị giác là thông tin.** Viền, số thứ tự, eyebrow, divider, nhãn... phải *mã hoá thông tin*, không trang trí. Chỉ đánh số (01/02/03) khi nội dung thật sự là một chuỗi tuần tự (quy trình, timeline).
- **Chuyển động không do người dùng kích hoạt: dùng tiết chế.** Một khoảnh khắc được dàn dựng (một chuỗi page-load, một reveal) tốt hơn nhiều hiệu ứng rải rác. Fade-slide-up ở mọi section và hover transition ở mọi card là mặc định AI — tránh. Chuyển động *đáp lại hành động* của người dùng (mở, mở rộng, xác nhận) thì được khuyến khích vì nó cho thấy cái gì vừa thay đổi.

### Tránh các "tell" typography mặc định (dấu hiệu trang do máy sinh)
- Nhấn mạnh đúng một từ/cụm trong tiêu đề (một từ in nghiêng/đậm/đổi màu).
- Dùng ALL CAPS cho label.
- Thêm nhãn typographic thừa phía trên nội dung.

## Hiệu chỉnh: các khuôn mẫu AI hay rơi vào (tránh trừ khi brief yêu cầu)
1. Nền kem ấm (~#F4F1EA) + serif display tương phản cao + accent đất nung (~#D97757 — vốn là accent của Claude, nên trên brief của khách nó là một "tell").
2. Nền gần-đen + một accent xanh acid hoặc đỏ son chói.
3. Bố cục kiểu báo giấy: hairline rules, border-radius 0, cột dày đặc.
4. "SaaS-card kit": nội dung băm thành card bo góc giống hệt nhau, một border-radius cho tất cả bất kể cấp bậc, cùng một shadow xám mềm `rgba(0,0,0,.1)`, gradient wash làm trang trí.
5. Chrome template xuất hiện bất kể chủ đề: eyebrow ALL-CAPS giãn chữ trên mọi heading; chuỗi meta nối bằng dấu chấm giữa ('A · B · C'); nhãn 'WORD — fragment' với em dash; near-black (#0B0B0B, #111) thay cho đen; mono face cho data label nhỏ; '→' thêm vào cuối link/nút.

> Tất cả đều hợp lệ **cho một số brief**, nhưng là *mặc định* chứ không phải *lựa chọn*. Nơi brief đã chốt hướng thị giác thì theo đúng brief (kể cả khi brief đòi một trong các look trên). Nơi brief để trống một trục, **đừng tiêu sự tự do đó vào một mặc định**.

## Quy trình: plan → review với brief → build → critique
Làm **hai pass**:

**Pass 1 — Design plan ngắn** (token system gọn):
- **Color:** 4–6 hex có đặt tên cho palette gốc.
- **Type:** các typeface và vai trò của chúng.
- **Layout:** một concept bố cục, mô tả một câu + wireframe ASCII để so sánh. Nêu căn lề (trái/giữa/justify).
- **Principles:** điều gì làm màn này khác biệt.

**Review plan với brief trước khi code:** nếu phần nào đọc như *mặc định generic* (thử tưởng tượng một prompt tương tự có ra kết quả giống không) thay vì lựa chọn riêng cho brief này — sửa lại, nói rõ đã đổi gì và vì sao. Chỉ khi chắc chắn plan đủ riêng mới bắt đầu viết code theo plan đã sửa.

**Khi viết CSS:** cẩn thận độ ưu tiên (specificity) của selector — dễ sinh các class triệt tiêu nhau (nhất là selector kiểu `.section` và `.cta`), hay gặp ở padding/margin giữa các section.

## Tiết chế & tự phản biện
- **Dồn độ táo bạo vào một chỗ.** Để một phần tử là thứ đáng nhớ, giữ mọi thứ quanh nó im lặng và kỷ luật; cắt mọi trang trí không phục vụ brief.
- **Quality floor (bắt buộc ở mọi màn, không cần tuyên bố):** responsive xuống mobile; focus bàn phím nhìn thấy được; tôn trọng `prefers-reduced-motion`; tương phản màu đạt (visually accessible); palette hài hoà.
- **Tự critique khi build**, chụp màn hình để soi nếu môi trường cho phép — "một bức ảnh đáng 1000 token".
- Lời khuyên của Chanel: trước khi ra khỏi nhà, nhìn gương và **bỏ bớt một phụ kiện**.

## Viết chữ trong thiết kế (UX writing) — áp dụng ở MỌI màn
Chữ xuất hiện trong UI vì một lý do: giúp **dễ hiểu, dễ dùng**. Nó là *nội dung thiết kế*, không phải trang trí. Mang cùng sự tối giản như với màu và khoảng cách.

- **Viết từ góc người dùng cuối.** Gọi tên theo cái user hiểu, không theo cách hệ thống xây: "Quản lý thông báo", không phải "Cấu hình webhook". Mô tả bằng từ đời thường, đừng bán hàng. Rõ ràng > khôn khéo.
- **Dùng thể chủ động.** CTA nói đúng việc sắp xảy ra: "Lưu thay đổi", không phải "Gửi". Giữ **nguyên động từ suốt luồng**: nút "Giao việc" → toast "Đã giao việc"; nút "Khoá tài khoản" → toast "Đã khoá tài khoản". Vốn từ giao diện là biển chỉ đường — nhất quán giúp người dùng thuộc đường.
- **Lỗi và trạng thái rỗng là lúc chỉ đường, không phải để tỏ cảm xúc.** Lỗi giải thích *đã sai gì* và *sửa thế nào*, bằng giọng của giao diện, không xin lỗi, không mơ hồ. Màn rỗng là lời mời hành động.
- **Giọng hội thoại:** động từ đơn giản, sentence case, không chữ thừa, tông khớp thương hiệu và người đọc. Mỗi phần chữ làm đúng một việc.

## Điều hoà với quy ước CMS hiện có (bắt buộc)
- Vẫn tuân `web-feature`: chỉ dùng **token màu từ theme** (`bg-background`, `text-muted-foreground`...), **không hard-code hex** trong component. Muốn đổi hướng màu/typography thì chỉnh ở **theme/biến CSS** (`tailwind`/`globals.css` / lớp theme của shadcn), không rải màu vào từng chỗ.
- Component shadcn thêm qua CLI vào `src/components/ui`; tuỳ biến bằng biến CSS, không sửa lung tung.
- Giao diện **tiếng Việt**, gom chữ một chỗ trong feature để dễ sửa; ngày giờ `Intl.DateTimeFormat('vi-VN')`.
- 3 trạng thái loading/rỗng/lỗi vẫn bắt buộc; empty/error state viết theo mục UX writing ở trên.
- Nếu đổi token theme toàn cục (màu, font, radius), nêu rõ trong báo cáo để BA/PM ghi lại; thay đổi lớn về hướng thị giác nên hỏi trước.

## Checklist trước khi báo "xong" (bổ sung cho fe-dev)
- [ ] Có design plan ngắn (color/type/layout/principles) đã review với brief, không rơi vào "tell" generic.
- [ ] Độ táo bạo dồn vào một điểm nhấn; phần còn lại kỷ luật.
- [ ] Quality floor: responsive mobile, focus bàn phím, `prefers-reduced-motion`, tương phản đạt.
- [ ] Chuyển động tiết chế; ưu tiên motion đáp lại hành động người dùng.
- [ ] CTA/empty/error theo UX writing; động từ nhất quán suốt luồng; tiếng Việt sentence case.
- [ ] Chỉ dùng token theme, không hard-code màu; đổi hướng màu/font làm ở theme.
