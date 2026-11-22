export interface AssetTranslation {
  readonly descriptionVi: string;
  readonly itemsVi: readonly string[];
}

export const SKILLS_VI: Readonly<Record<string, AssetTranslation>> = {
  archify: {
    descriptionVi:
      'Uỷ quyền tạo sơ đồ HTML tương tác và trang giải thích một trang (one-page explainer) cho bộ máy Archify cục bộ mà không sao chép trùng lặp schema hay trình kết xuất gốc. Sử dụng skill này bất cứ khi nào người dùng yêu cầu vẽ, trực quan hoá hoặc lập sơ đồ hệ thống, luồng công việc, sequence, luồng dữ liệu, vòng đời, ERD, mô hình lớp, cây, timeline, waterfall, chuyển đổi cú pháp Mermaid hoặc dựng trang giải thích.',
    itemsVi: [
      'Xác định Bộ máy Archify Cục bộ',
      'Chọn Chế độ và Đọc Hợp đồng Nguồn (Upstream Contracts)',
      'Soạn thảo Bản ứng viên (Candidate) và Chọn Vị trí Đầu ra',
      'Hoàn thiện và Kiểm chứng Sản phẩm (Finalize & Validate)',
      'Bàn giao Đầu ra HTML Đã Kiểm chứng',
    ],
  },
  'asset-architect': {
    descriptionVi:
      'Thiết kế kiến trúc, khởi tạo khung (scaffold), kiểm chứng và đồng bộ hoá các tài nguyên AI chuẩn mới (skills, rules, agents, principles) tuân thủ hợp đồng kho lưu trữ và đa nền tảng công cụ. Sử dụng skill này khi người dùng muốn tạo mới, tinh chỉnh hoặc khởi tạo một skill, rule, hồ sơ agent hoặc nguyên tắc kỹ thuật.',
    itemsVi: [
      'Xác định Phân loại Tài nguyên',
      'Thu thập Siêu dữ liệu Bắt buộc (Theo Content Contract)',
      'Khởi tạo Cấu trúc Thư mục',
      'Kiểm chứng Tính toàn vẹn của Tài nguyên',
      'Đồng bộ hoá Đa công cụ & Trang Tài liệu (Site)',
    ],
  },
  'conversation-flow': {
    descriptionVi:
      'Chuyển đổi các cuộc hội thoại AI nhiều lượt hoặc bản ghi phiên hiện tại từ Claude, Gemini, Grok, ChatGPT và các coding agent thành cấu trúc JSON ConversationFlow v1 theo dõi raw prompt, kết quả kỳ vọng so với thực tế và độ lệch phạm vi. Sử dụng khi phân tích hoặc trực quan hoá luồng hội thoại AI.',
    itemsVi: [
      'Thu thập hoặc Tiếp nhận Bản ghi Hội thoại',
      'Bảo toàn Nguyên văn Prompt & Phân tích Khối Hợp đồng (Flow Contract)',
      'Trích xuất Kỳ vọng so với Thực tế & Phân loại Độ lệch (Delta)',
      'Xuất dữ liệu JSON ConversationFlow v1',
    ],
  },
  'git-commit': {
    descriptionVi:
      'Phân tích các tệp đã chỉnh sửa và chưa theo dõi, gom nhóm các thay đổi liên quan về mặt logic thành các commit nguyên tử (atomic commits), và soạn thảo thông điệp Conventional Commit chuẩn mực. Sử dụng skill này khi người dùng yêu cầu stage, commit hoặc tạo git commit cho thay đổi mã nguồn.',
    itemsVi: [
      'Kiểm tra Trạng thái (Status) và Khác biệt (Diff)',
      'Gom nhóm Tệp thành các Commit Nguyên tử (Atomic Commits)',
      'Soạn thảo Thông điệp Conventional Commit',
      'Stage và Commit Tuần tự Từng Nhóm',
      'Kiểm tra Xác thực Sau Commit',
    ],
  },
  'github-pr': {
    descriptionVi:
      'Kiểm tra danh sách commit, xác thực trạng thái nhánh, đẩy (push) an toàn lên remote và tạo GitHub Pull Request với tiêu đề chuẩn hoá cùng mô tả toàn diện. Sử dụng skill này khi người dùng yêu cầu đẩy nhánh, mở hoặc tạo GitHub PR, hoặc sinh nội dung mô tả pull request.',
    itemsVi: [
      'Xác thực Nhánh và Cây Thư mục Làm việc',
      'Đồng bộ hoá và Đẩy lên Remote (Push)',
      'Phân tích Commit và Soạn thảo Nội dung PR',
      'Tạo Pull Request qua GitHub CLI (gh)',
    ],
  },
  humanizer: {
    descriptionVi:
      'Uỷ quyền biên tập tự nhiên hoá văn phong AI (de-slopping) cho gói kỹ năng Humanizer cục bộ mà không sao chép danh mục mẫu gốc. Sử dụng skill này khi biên tập, viết lại hoặc rà soát văn bản để loại bỏ dấu vết AI như cấu trúc đối lập "không phải X mà là Y", câu kết một dòng sáo rỗng, bộ ba gượng ép, lạm dụng dấu gạch ngang dài (em-dash), ngôn ngữ quảng cáo phóng đại hoặc dư lượng chatbot.',
    itemsVi: [
      'Xác định Gói Humanizer Cục bộ',
      'Xác định Chế độ Đầu vào và Giọng điệu (Voice)',
      'Thực hiện Quy trình Biên tập 4 Lượt (Four-Pass Rewrite)',
      'Bàn giao Kết quả Theo Chế độ Đã Chọn',
    ],
  },
  'slide-generator': {
    descriptionVi:
      'Hướng dẫn người dùng từ chủ đề thuyết trình qua nghiên cứu đa nguồn, thống nhất mối quan tâm, phê duyệt nội dung từng trang chiếu, chọn mẫu phong cách trực quan và xuất tệp PPTX hoàn chỉnh. Sử dụng skill này bất cứ khi nào người dùng yêu cầu tạo, thiết kế hoặc sinh slide thuyết trình / bài trình chiếu PowerPoint.',
    itemsVi: [
      'Tiếp nhận Chủ đề & Làm rõ Phạm vi',
      'Nghiên cứu Đa nguồn & Đối chiếu Mối quan tâm',
      'Soạn thảo & Duyệt Nội dung Từng Slide',
      'Đề xuất Phong cách & Xem Mẫu Trực quan',
      'Sinh Tệp Trình chiếu PPTX',
      'Kiểm chứng Đầu ra & Bàn giao',
    ],
  },
};

export const RULES_VI: Readonly<Record<string, AssetTranslation>> = {
  'confirm-intent-output': {
    descriptionVi:
      'Áp dụng tiêu đề xác nhận Ý định / Đầu vào / Kết quả Kỳ vọng trước khi chạy (Pre-Run) và phần tổng kết Kết quả Thực tế / Độ lệch Phạm vi sau khi chạy (Post-Run) trên Claude, Gemini, Grok, ChatGPT và các coding agent để mọi lượt hội thoại đều có thể theo dõi và trực quan hoá theo thời gian thực.',
    itemsVi: [
      '**Tiêu đề Hợp đồng Trước khi Chạy (Pre-Run Contract Header)**: Trước khi trả lời bất kỳ yêu cầu không tầm thường nào, xuất khối trích dẫn `[Flow Contract | Pre-Run]` nêu rõ `Goal`, `Input`, `Expected Output` và `Gate`.',
      '**Cổng Xác nhận Thích ứng (Adaptive Confirmation Gate)**: Tiến hành trực tiếp sau khi nêu hợp đồng Pre-Run nếu yêu cầu đã rõ ràng; CHỈ tạm dừng hỏi người dùng khi yêu cầu mơ hồ hoặc tác vụ có chi phí cao / tác động phá huỷ.',
      '**Chân trang Hợp đồng Sau khi Chạy (Post-Run Contract Footer)**: Ở cuối câu trả lời, xuất khối trích dẫn `[Flow Contract | Post-Run]` nêu rõ `Actual Output`, `Delta`, `Delta Note` và `Extras` (nếu có).',
      '**Phân loại Độ lệch Phạm vi Trung thực (Honest Scope Delta Classification)**: Phân loại `Delta` nghiêm ngặt thành `Matched` (khớp kỳ vọng), `Expanded` (đạt kỳ vọng kèm phát hiện nghiên cứu mở rộng), `Pivoted` (đổi hướng tiếp cận) hoặc `Partial` (bị chặn hoặc chưa hoàn tất).',
      '**Bình thường hoá Mở rộng Nghiên cứu (Normalize Research Expansion)**: Coi `Expanded` là kết quả lành mạnh, tự nhiên trong quá trình điều tra hoặc nghiên cứu sâu; liệt kê các phát hiện bổ sung trong `Extras` ngăn cách bằng dấu chấm phẩy.',
      '**Bỏ qua Thủ tục với Truy vấn Đơn giản (Skip Ceremony on Trivial Queries)**: Bỏ qua cả hai khối hợp đồng đối với các câu hỏi tra cứu một dòng hoặc lời chào hỏi thông thường.',
    ],
  },
};
