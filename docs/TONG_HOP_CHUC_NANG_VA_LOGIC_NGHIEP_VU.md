# TỔNG HỢP CÁC CHỨC NĂNG VÀ LOGIC NGHIỆP VỤ

## Phạm vi tài liệu

- Tài liệu này tổng hợp các chức năng nghiệp vụ chính của hệ thống MHV dựa trên mã nguồn thực tế ở backend `Spring Boot` và frontend `React/Vite`.
- Mỗi mục gồm 3 phần chính: mô tả tính năng, logic nghiệp vụ và tệp mã nguồn tham chiếu kèm phạm vi dòng.
- Trọng tâm của tài liệu là logic nghiệp vụ ở tầng `service`, `repository`, `entity` và các controller liên quan trực tiếp đến luồng nghiệp vụ.
- Các phạm vi dòng được ghi theo trạng thái mã nguồn hiện tại tại thời điểm rà soát; nếu mã nguồn thay đổi về sau thì line range có thể dịch chuyển.

## 1. Nhóm chức năng quản lý danh mục hệ thống

### 1.1. Quản lý người dùng và phân quyền

**Mô tả và diễn giải tính năng**

- Chức năng này cho phép quản trị viên quản lý tài khoản sử dụng hệ thống, bao gồm tạo mới, cập nhật, khóa hoặc xóa người dùng.
- Dữ liệu người dùng không chỉ phục vụ đăng nhập mà còn là nền tảng cho các luồng mượn trả, báo hỏng, phân công kỹ thuật viên, kiểm kê và thông báo.
- Vai trò người dùng hiện được chuẩn hóa thành các nhóm chính: `Admin`, `NhanVien`, `TechSupport`, `ConsumableManager`.

**Logic nghiệp vụ**

- Chỉ `Admin` được phép CRUD tài khoản người dùng, danh sách có hỗ trợ lọc theo từ khóa, vai trò và trạng thái.
- Khi tạo hoặc cập nhật người dùng, hệ thống kiểm tra trùng `username` và `email` để bảo đảm tính duy nhất của tài khoản.
- Dữ liệu hồ sơ còn được kiểm tra nghiệp vụ: ngày sinh phải là ngày trong quá khứ, số điện thoại phải đúng định dạng 10 số và bắt đầu bằng `0`.
- Trạng thái tài khoản chỉ chấp nhận 2 giá trị nghiệp vụ là `Hoạt động` và `Khóa`.
- Nếu người dùng có vai trò `TechSupport` thì bắt buộc phải gắn ít nhất một chuyên môn kỹ thuật; đây là điều kiện để sau này hệ thống phân công ticket đúng chuyên môn.
- Hệ thống không cho xóa tài khoản `admin` mặc định nhằm tránh mất tài khoản quản trị gốc.
- Mọi thao tác tạo, sửa, xóa user đều sinh thông báo nội bộ để phục vụ audit vận hành.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/UserService.java 105:231`
- `src/main/java/com/poly/mhv/service/UserService.java 289:383`
- `src/main/java/com/poly/mhv/controller/UserController.java 27:119`
- `src/main/java/com/poly/mhv/entity/AppUser.java 22:71`
- `src/main/java/com/poly/mhv/repository/AppUserRepository.java 12:73`

### 1.2. Xác thực và bảo mật truy cập

**Mô tả và diễn giải tính năng**

- Đây là nhóm chức năng bảo đảm chỉ người dùng hợp lệ mới truy cập được hệ thống và mỗi vai trò chỉ đi vào đúng nhóm màn hình, đúng API.
- Chức năng này tuy không phải CRUD danh mục, nhưng là logic nền bắt buộc để toàn bộ nghiệp vụ còn lại hoạt động đúng.

**Logic nghiệp vụ**

- Người dùng đăng nhập bằng `username/password`; nếu tài khoản bị khóa hoặc thông tin không hợp lệ thì hệ thống trả lỗi tương ứng.
- Khi đăng nhập thành công, backend sinh `JWT` và trả kèm thông tin người dùng, vai trò và danh sách chuyên môn kỹ thuật.
- `JWT` được dùng để xác thực cho toàn bộ API, trừ nhóm `/api/auth/**` là public.
- Hệ thống chạy theo cơ chế `stateless`, mọi request nghiệp vụ sau đăng nhập đều phải mang token hợp lệ.
- Role được ánh xạ sang authority dạng `ROLE_*`, do đó việc phân quyền ở controller và route dựa trực tiếp trên role đã chuẩn hóa.
- Nếu tài khoản ở trạng thái `Khóa`, phần `UserDetails` sẽ coi tài khoản là không được phép hoạt động.
- Ở frontend, sau khi đăng nhập hệ thống lưu token và thông tin user vào `localStorage`, đồng thời điều hướng tới khu vực tương ứng với vai trò.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/controller/AuthController.java 25:70`
- `src/main/java/com/poly/mhv/security/SecurityConfig.java 47:72`
- `src/main/java/com/poly/mhv/security/services/UserDetailsImpl.java 28:50`
- `src/main/java/com/poly/mhv/security/services/UserDetailsImpl.java 111:128`
- `src/main/java/com/poly/mhv/security/services/UserDetailsServiceImpl.java 20:26`
- `src/main/java/com/poly/mhv/security/jwt/JwtUtils.java 24:50`
- `frontend/src/context/AuthContext.jsx 7:92`
- `frontend/src/App.jsx 55:77`
- `frontend/src/App.jsx 135:236`

### 1.3. Quản lý nhà cung cấp

**Mô tả và diễn giải tính năng**

- Danh mục nhà cung cấp được dùng để gắn nguồn gốc mua sắm cho tài sản và vật tư, đồng thời phục vụ tra cứu bảo hành, thống kê và báo cáo.
- Đây là một danh mục nền dùng lại ở nhiều phân hệ, đặc biệt là tài sản cố định và vật tư tiêu hao.

**Logic nghiệp vụ**

- Hệ thống cho phép quản lý danh sách nhà cung cấp có tìm kiếm theo tên.
- Khi không truyền từ khóa, danh sách nhà cung cấp được cache ngắn hạn để giảm tải đọc dữ liệu lặp lại.
- Tên nhà cung cấp không được trùng, tránh tạo nhiều bản ghi đại diện cho cùng một đơn vị.
- Khi trả danh sách nhà cung cấp, hệ thống đồng thời tính `assetCount` để cho biết nhà cung cấp đó đang được bao nhiêu tài sản sử dụng.
- Không cho phép xóa nhà cung cấp nếu vẫn còn tài sản đang tham chiếu tới nhà cung cấp đó.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/SupplierService.java 21:62`
- `src/main/java/com/poly/mhv/service/SupplierService.java 69:156`
- `src/main/java/com/poly/mhv/service/SupplierService.java 171:224`
- `src/main/java/com/poly/mhv/controller/SupplierController.java 28:104`
- `src/main/java/com/poly/mhv/entity/Supplier.java 19:44`
- `src/main/java/com/poly/mhv/repository/SupplierRepository.java 9:29`

### 1.4. Quản lý danh mục loại tài sản và vật tư

**Mô tả và diễn giải tính năng**

- Danh mục loại là lớp cấu hình nghiệp vụ cực kỳ quan trọng vì nó quyết định một đối tượng được theo dõi theo dạng `ITEMIZED` hay `CONSUMABLE`.
- Mỗi loại còn có thể mang mẫu thông số kỹ thuật, tiền tố sinh mã QA và liên kết với nhóm chuyên môn kỹ thuật.

**Logic nghiệp vụ**

- Hệ thống chia category thành 2 loại nghiệp vụ chính là `ITEMIZED` và `CONSUMABLE`.
- Với category `ITEMIZED`, bắt buộc phải gắn `techSupportType` để phục vụ phân công xử lý ticket sau này.
- Với category `CONSUMABLE`, không gắn nhóm kỹ thuật, vì vật tư tiêu hao không đi qua luồng ticket sửa chữa như tài sản đơn chiếc.
- Backend tự sinh `codePrefix` từ tên danh mục để làm tiền tố cho mã QA.
- `specTemplates` của category được lưu như cấu hình mẫu, giúp chuẩn hóa trường thông số kỹ thuật khi tạo tài sản.
- Không cho phép đổi `categoryKind` nếu đã có tài sản hoặc vật tư đang dùng category đó, nhằm tránh phá vỡ logic theo dõi hiện có.
- Không cho phép xóa category nếu vẫn còn bản ghi tài sản/vật tư đang tham chiếu.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/CategoryService.java 33:89`
- `src/main/java/com/poly/mhv/service/CategoryService.java 91:188`
- `src/main/java/com/poly/mhv/service/CategoryService.java 200:262`
- `src/main/java/com/poly/mhv/controller/CategoryController.java 29:114`
- `src/main/java/com/poly/mhv/entity/Category.java 20:53`
- `src/main/java/com/poly/mhv/repository/CategoryRepository.java 19:72`

### 1.5. Quản lý chuyên môn kỹ thuật

**Mô tả và diễn giải tính năng**

- Nhóm chức năng này quản lý danh mục chuyên môn của kỹ thuật viên, ví dụ điện, mạng, máy tính, máy in.
- Danh mục này là cầu nối giữa loại thiết bị và nhân sự kỹ thuật, giúp hệ thống chọn đúng người để xử lý ticket.

**Logic nghiệp vụ**

- Hệ thống cho phép tạo, sửa, xóa chuyên môn kỹ thuật và cung cấp danh sách option gọn cho form.
- Tên chuyên môn không được trùng.
- `id` của nhóm chuyên môn được cấp theo logic `max(id)+1`.
- Dữ liệu có `id = 0` là nhóm mặc định hệ thống, không thuộc phạm vi quản trị thông thường.
- Không cho xóa chuyên môn nếu vẫn còn category hoặc user đang gắn với chuyên môn đó.
- Khi trả danh sách, hệ thống có thể đếm luôn số category và số kỹ thuật viên đang dùng từng chuyên môn.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/TechSupportTypeService.java 42:146`
- `src/main/java/com/poly/mhv/service/TechSupportTypeService.java 148:183`
- `src/main/java/com/poly/mhv/controller/TechSupportTypeController.java 29:116`
- `src/main/java/com/poly/mhv/entity/TechSupportType.java 12:25`
- `src/main/java/com/poly/mhv/repository/TechSupportTypeRepository.java 11:45`
- `src/main/java/com/poly/mhv/config/DatabaseSeeder.java 53:67`

### 1.6. Quản lý loại khu vực

**Mô tả và diễn giải tính năng**

- Loại khu vực được dùng để phân loại các phòng/khu vực nghiệp vụ trong hệ thống, đồng thời làm dữ liệu nền cho module sơ đồ và vật tư.
- Một loại khu vực có thể đại diện cho lớp học, phòng thí nghiệm, văn phòng, kho vật tư hoặc các không gian đặc thù khác.

**Logic nghiệp vụ**

- Hệ thống luôn seed sẵn một bộ loại khu vực mặc định để người dùng có thể sử dụng ngay sau khi khởi tạo.
- Khi tạo mới loại khu vực, hệ thống sinh `typeKey` từ nhãn hiển thị để dùng làm khóa nghiệp vụ ổn định.
- Một loại khu vực có cờ `isStorageWarehouse`; đây là logic rất quan trọng để phân biệt kho vật tư với phòng sử dụng thông thường.
- Các loại khu vực `builtIn` không được xóa để bảo toàn bộ danh mục nền chuẩn.
- Không cho xóa loại khu vực nếu vẫn còn `RoomShape` hoặc `Location` đang sử dụng.
- Không cho bỏ cờ `isStorageWarehouse` nếu hiện còn location được đánh dấu là kho theo loại khu vực đó.
- Sau mỗi thay đổi, cache location liên quan bị làm mới để tránh dữ liệu cũ tiếp tục được dùng.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/AreaTypeCatalogService.java 27:68`
- `src/main/java/com/poly/mhv/service/AreaTypeCatalogService.java 70:133`
- `src/main/java/com/poly/mhv/service/AreaTypeCatalogService.java 135:208`
- `src/main/java/com/poly/mhv/service/AreaTypeCatalogService.java 240:250`
- `src/main/java/com/poly/mhv/entity/AreaTypeCatalog.java 18:74`
- `src/main/java/com/poly/mhv/controller/AssetMapController.java 73:99`

### 1.7. Quản lý phòng và kho nghiệp vụ

**Mô tả và diễn giải tính năng**

- Chức năng này quản lý danh sách phòng/kho dùng chung toàn hệ thống để gắn cho tài sản, vật tư, kiểm kê, sơ đồ và lịch sử mượn trả.
- Một location có thể là phòng sử dụng thông thường hoặc kho vật tư tùy theo loại khu vực được gán.

**Logic nghiệp vụ**

- `roomName` là bắt buộc và không được trùng, nhằm bảo đảm mỗi location có định danh nghiệp vụ rõ ràng.
- Location có thể được gắn với `floor`, `areaTypeKey`, `areaTypeLabel`; từ đó hệ thống suy ra location có phải là kho hay không.
- Danh sách location có thể được cache 60 giây khi truy xuất lặp lại.
- Khi tạo, sửa, xóa location, hệ thống phát notification nội bộ để phục vụ audit vận hành.
- Không cho xóa location nếu nó còn bị tham chiếu bởi tài sản hiện tại, phòng gốc của tài sản, usage history, lô nhập vật tư, phiếu cấp phát, yêu cầu cấp phát hoặc chuyển kho nội bộ.
- Xóa nhiều location chỉ được phép nếu toàn bộ các location trong danh sách đều vượt qua cùng bộ kiểm tra ràng buộc.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/LocationService.java 30:95`
- `src/main/java/com/poly/mhv/service/LocationService.java 97:192`
- `src/main/java/com/poly/mhv/service/LocationService.java 225:298`
- `src/main/java/com/poly/mhv/controller/LocationController.java 28:108`
- `src/main/java/com/poly/mhv/entity/Location.java 22:67`
- `src/main/java/com/poly/mhv/repository/LocationRepository.java 9:35`

## 2. Nhóm chức năng quản lý tài sản và mượn trả

### 2.1. Quản lý tài sản cố định

**Mô tả và diễn giải tính năng**

- Đây là phân hệ quản lý các tài sản đơn chiếc như máy tính, máy chiếu, máy in, thiết bị mạng.
- Mỗi tài sản có mã QA riêng, vị trí gốc, vị trí hiện tại, tình trạng kỹ thuật, trạng thái sử dụng, thông số kỹ thuật, bảo hành và nhà cung cấp.

**Logic nghiệp vụ**

- Khi tạo tài sản, backend chuẩn hóa `trackingMode`, kiểm tra category phù hợp với loại theo dõi và sinh mã QA tự động.
- Hệ thống gắn đồng thời `homeLocation` và `location`; `homeLocation` là vị trí gốc, còn `location` là vị trí hiện tại của tài sản.
- Tài sản mới được khởi tạo với bộ trạng thái ban đầu phù hợp và có thể phát notification phục vụ đồng bộ màn hình quản trị.
- Với tài sản `ITEMIZED`, hệ thống lưu chi tiết tình trạng kỹ thuật và trạng thái sử dụng để phục vụ các luồng báo hỏng, mượn trả, kiểm kê.
- Dữ liệu tài sản được truy vấn theo nhiều điều kiện phục vụ màn hình admin, bản đồ tài sản và dashboard.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/AssetService.java 150:267`
- `src/main/java/com/poly/mhv/service/AssetService.java 269:312`
- `src/main/java/com/poly/mhv/controller/AssetController.java 73:172`
- `src/main/java/com/poly/mhv/entity/Asset.java 22:115`
- `src/main/java/com/poly/mhv/repository/AssetRepository.java 116:219`

### 2.2. Import tài sản hàng loạt từ Excel

**Mô tả và diễn giải tính năng**

- Chức năng import giúp quản trị viên nạp hàng loạt tài sản từ Excel thay vì nhập tay từng bản ghi.
- Luồng import được thiết kế theo 3 bước: tải mẫu, xem trước dữ liệu, xác nhận commit.

**Logic nghiệp vụ**

- Hệ thống cung cấp một file mẫu có sẵn cấu trúc cột, dữ liệu hướng dẫn và các danh mục hợp lệ để người dùng nhập đúng chuẩn.
- Ở bước preview, backend đọc từng dòng, kiểm tra giá trị hợp lệ và gom lỗi theo từng bản ghi.
- `ITEMIZED` bắt buộc có phòng gốc; `CONSUMABLE` bắt buộc có số lượng tồn hợp lệ.
- Chỉ các dòng hợp lệ mới được đưa sang bước commit; các dòng lỗi bị bỏ qua và trả về thống kê `imported`, `skipped`, `errors`.
- Việc build request import được chuẩn hóa về cùng cấu trúc dữ liệu với luồng tạo tài sản thông thường, do đó giảm rủi ro lệch nghiệp vụ.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/AssetImportService.java 37:128`
- `src/main/java/com/poly/mhv/service/AssetImportService.java 210:272`
- `src/main/java/com/poly/mhv/service/AssetImportService.java 274:382`
- `src/main/java/com/poly/mhv/controller/AssetImportController.java 22:64`
- `frontend/src/pages/admin/AssetManagement.jsx 1454:1507`

### 2.3. Sinh mã QA và QR code tài sản

**Mô tả và diễn giải tính năng**

- Mỗi tài sản cố định được nhận diện bằng `qaCode`, đồng thời hệ thống sinh QR từ mã QA để phục vụ quét, in tem và tra cứu nhanh.
- Đây là logic nền cho các phân hệ mượn trả, kiểm kê và định vị.

**Logic nghiệp vụ**

- `qaCode` được sinh dựa trên `codePrefix` của category và số thứ tự tăng dần trong từng nhóm danh mục.
- QR code không lưu dữ liệu phức tạp mà dùng payload JSON đơn giản chứa `qa_code`.
- Hệ thống cache QR và chi tiết asset để giảm chi phí sinh lại dữ liệu lặp đi lặp lại.
- Vật tư tiêu hao bị chặn khỏi luồng QR/QA của tài sản đơn chiếc, vì không theo dõi ở cấp từng đơn vị item.
- Khi dữ liệu asset thay đổi, cache liên quan bị xóa để tránh trả về QR hoặc chi tiết lỗi thời.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/AssetService.java 340:370`
- `src/main/java/com/poly/mhv/service/AssetService.java 1419:1453`
- `src/main/java/com/poly/mhv/service/AssetService.java 1546:1562`
- `src/main/java/com/poly/mhv/controller/AssetController.java 367:387`
- `frontend/src/pages/admin/AssetManagement.jsx 2262:2581`

### 2.4. Mượn tài sản

**Mô tả và diễn giải tính năng**

- Chức năng mượn cho phép nhân viên mang thiết bị từ phòng gốc sang một phòng sử dụng khác bằng cách quét QR hoặc nhập tay mã QA.
- Mục tiêu của luồng này là ghi nhận chính xác lịch sử di chuyển tài sản giữa các phòng.

**Logic nghiệp vụ**

- Chỉ tài sản `ITEMIZED` mới được phép mượn.
- Không cho mượn nếu tài sản đang hỏng, thất lạc, đang sửa hoặc đang ở trong một phiên mượn mở khác.
- Phòng mượn đến không được trùng với phòng hiện tại của tài sản.
- Khi mượn hợp lệ, hệ thống tạo một bản ghi `UsageHistory` đang mở, chuyển `location` của asset sang phòng đích và đổi trạng thái sử dụng sang đang mượn.
- Sau thao tác mượn, hệ thống phát notification để các vai trò liên quan nắm được biến động thiết bị.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/UsageHistoryService.java 60:126`
- `src/main/java/com/poly/mhv/service/UsageHistoryService.java 247:271`
- `src/main/java/com/poly/mhv/controller/UsageHistoryController.java 37:57`
- `frontend/src/pages/QRScanner.jsx 190:241`
- `frontend/src/pages/QRScanner.jsx 243:349`

### 2.5. Trả tài sản

**Mô tả và diễn giải tính năng**

- Chức năng trả tài sản kết thúc phiên mượn và đưa thiết bị trở lại phòng gốc.
- Đây là bước bắt buộc để hệ thống đóng đúng vòng đời một lần mượn.

**Logic nghiệp vụ**

- Chỉ người đã mượn tài sản mới được phép thực hiện trả tài sản, tránh việc người khác tự ý đóng phiên mượn.
- Khi trả, hệ thống cập nhật `endTime` của usage history đang mở.
- Asset được đưa trở lại `homeLocation`, đồng thời trạng thái sử dụng được đổi về trạng thái bình thường tại phòng gốc.
- Sau khi trả, notification tiếp tục được bắn để cập nhật cho các màn hình quản trị và người dùng liên quan.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/UsageHistoryService.java 128:181`
- `src/main/java/com/poly/mhv/controller/UsageHistoryController.java 37:57`
- `frontend/src/pages/QRScanner.jsx 190:241`
- `frontend/src/pages/QRScanner.jsx 275:345`

### 2.6. Quản lý lịch sử mượn trả và báo cáo

**Mô tả và diễn giải tính năng**

- Phân hệ này giúp người dùng và quản trị viên xem lại toàn bộ lịch sử mượn trả theo nhiều điều kiện lọc khác nhau.
- Đây là cơ sở để truy vết tài sản, kiểm tra tần suất sử dụng và xuất báo cáo quản trị.

**Logic nghiệp vụ**

- Nhân viên có thể xem lịch sử mượn của cá nhân mình.
- Quản trị viên có thể tra cứu lịch sử toàn hệ thống theo tên tài sản, phòng gốc, người mượn, trạng thái đã trả/chưa trả và khoảng ngày.
- Query động được xây dựng bằng `Criteria API`, cho phép lọc và sắp xếp theo nhiều trường lồng nhau như tài sản, phòng, người dùng.
- Hệ thống có thể xuất Excel lịch sử mượn trả theo đúng bộ lọc đang áp dụng.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/UsageHistoryService.java 183:345`
- `src/main/java/com/poly/mhv/repository/UsageHistoryRepository.java 67:185`
- `src/main/java/com/poly/mhv/repository/UsageHistoryRepositoryImpl.java 35:178`
- `src/main/java/com/poly/mhv/controller/UsageHistoryController.java 59:99`
- `src/main/java/com/poly/mhv/service/ReportService.java 137:215`
- `frontend/src/pages/admin/UsageHistoryManagement.jsx 48:470`

## 3. Nhóm chức năng quản lý vật tư tiêu hao

### 3.1. Quản lý vật tư tiêu hao và mô hình tồn kho tổng

**Mô tả và diễn giải tính năng**

- Hệ thống dùng chung bảng `Asset` để lưu cả vật tư tiêu hao, nhưng áp dụng logic riêng với `trackingMode = CONSUMABLE`.
- Tồn kho vật tư không theo từng item riêng lẻ, mà theo số lượng tổng, lô nhập và tồn tại từng phòng/kho.

**Logic nghiệp vụ**

- Một vật tư consumable có các thuộc tính đặc thù như `quantityOnHand`, `minimumStock`, `expiryTrackingEnabled`, quy đổi đơn vị và vị trí kho gốc.
- `Asset.quantityOnHand` không phải số nhập tay độc lập mà được tính lại từ tổng `quantityRemaining` của các lô nhập kho còn mở.
- Trạng thái tồn kho chỉ có 2 mức nghiệp vụ chính: `Còn hàng` và `Cần nhập`, dựa trên so sánh giữa tồn thực tế và `minimumStock`.
- Vị trí nghiệp vụ của consumable phải là kho hợp lệ; đây là điều kiện nền cho mọi luồng nhập, xuất, cấp phát và tiêu hủy.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/entity/Asset.java 22:115`
- `src/main/java/com/poly/mhv/service/AssetService.java 150:243`
- `src/main/java/com/poly/mhv/service/AssetService.java 1931:1938`
- `src/main/java/com/poly/mhv/service/AssetService.java 2489:2495`
- `src/main/java/com/poly/mhv/config/StorageWarehouseMigrationRunner.java 16:145`

### 3.2. Nhập kho vật tư theo lô

**Mô tả và diễn giải tính năng**

- Vật tư được nhập kho theo từng lô (`receipt lot`) để theo dõi hạn sử dụng, đơn giá, nhà cung cấp và tồn còn lại của từng lần nhập.
- Đây là logic cốt lõi để hệ thống truy vết được vật tư hết hạn và cấp phát đúng theo lô.

**Logic nghiệp vụ**

- Khi tạo mới một consumable có tồn đầu kỳ, hệ thống có thể tự tạo lô `INIT-*`.
- Khi nhập bổ sung, hệ thống kiểm tra số lượng nhập phải lớn hơn 0, xác định kho nhập, nhà cung cấp, ngày nhập và hạn sử dụng.
- Dữ liệu nhập được chuẩn hóa về đơn vị lẻ để việc cộng/trừ tồn nhất quán.
- Sau khi tạo lô mới, hệ thống cập nhật lại tồn tổng của vật tư bằng cách cộng từ các lô.
- Hạn dùng tổng trên asset được đồng bộ từ lô gần hết hạn còn tồn.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/AssetService.java 621:692`
- `src/main/java/com/poly/mhv/service/AssetService.java 2157:2210`
- `src/main/java/com/poly/mhv/service/AssetService.java 2213:2229`
- `src/main/java/com/poly/mhv/controller/AssetController.java 197:214`
- `src/main/java/com/poly/mhv/entity/ConsumableReceiptLot.java 21:76`
- `src/main/java/com/poly/mhv/repository/ConsumableReceiptLotRepository.java 13:53`
- `src/main/java/com/poly/mhv/repository/ConsumableReceiptLotRepository.java 173:187`

### 3.3. Cấp phát trực tiếp vật tư cho phòng

**Mô tả và diễn giải tính năng**

- Luồng này cho phép xuất vật tư từ kho sang một phòng sử dụng cụ thể mà không cần qua phiếu yêu cầu trước.
- Đây là luồng vận hành trực tiếp dành cho tình huống cần cấp phát ngay.

**Logic nghiệp vụ**

- Request cấp phát phải có vật tư, phòng nhận, kho xuất và số lượng.
- Hệ thống kiểm tra tồn tổng đủ trước khi xử lý.
- Khi xuất kho, hệ thống không trừ một cách ngẫu nhiên mà phân bổ số lượng theo nhiều lot của kho nguồn.
- Chiến lược phân bổ lot ưu tiên lô gần hết hạn trước để giảm rủi ro tồn kho hết hạn.
- Sau khi cấp phát, hệ thống ghi `ConsumableIssue`, đồng thời cập nhật hoặc tạo mới `ConsumableLocationStock` cho phòng nhận.
- Ghi chú truy vết lô được ghép vào lịch sử xuất để có thể đối chiếu ngược về sau.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/AssetService.java 539:618`
- `src/main/java/com/poly/mhv/service/AssetService.java 2231:2312`
- `src/main/java/com/poly/mhv/service/AssetService.java 2351:2412`
- `src/main/java/com/poly/mhv/controller/AssetController.java 188:195`

### 3.4. Yêu cầu cấp phát và phê duyệt cấp phát

**Mô tả và diễn giải tính năng**

- Ngoài cấp phát trực tiếp, hệ thống còn hỗ trợ luồng yêu cầu cấp phát để nhân viên hoặc bộ phận liên quan gửi đề nghị và chờ phê duyệt.
- Luồng này làm rõ trách nhiệm giữa người yêu cầu và người duyệt cấp phát.

**Logic nghiệp vụ**

- Khi tạo yêu cầu, phải có mã vật tư, phòng nhận, kho xuất, số lượng và lý do; trạng thái ban đầu là `PENDING`.
- Duyệt yêu cầu không chỉ đổi trạng thái, mà còn thực hiện cấp phát thực tế: chọn kho, allocate lot, trừ tồn kho, ghi issue và cập nhật tồn phòng.
- Nếu từ chối yêu cầu, hệ thống đổi trạng thái sang `REJECTED` và bắt buộc có lý do từ chối.
- Logic kho nguồn có thể lấy từ dữ liệu duyệt, dữ liệu đã lưu trong phiếu hoặc fallback về kho mặc định của vật tư.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/AssetService.java 1111:1167`
- `src/main/java/com/poly/mhv/service/AssetService.java 1170:1255`
- `src/main/java/com/poly/mhv/service/AssetService.java 1258:1302`
- `src/main/java/com/poly/mhv/service/AssetService.java 2683:2715`
- `src/main/java/com/poly/mhv/controller/AssetController.java 240:355`
- `src/main/java/com/poly/mhv/entity/ConsumableRequest.java 19:73`

### 3.5. Theo dõi tồn phòng, tồn kho và lịch sử vật tư

**Mô tả và diễn giải tính năng**

- Phân hệ này giúp quan sát vật tư ở cả hai lát cắt: tồn tại kho và tồn đã cấp phát cho từng phòng.
- Đây là lớp thông tin quan trọng cho dashboard vật tư, kiểm soát thiếu hụt và đối chiếu cấp phát.

**Logic nghiệp vụ**

- Kho và phòng được phân biệt bằng `areaTypeKey` cùng cờ `isStorageWarehouse`.
- `ConsumableLocationStock` lưu lượng đã cấp và lượng còn lại ở từng phòng; dữ liệu này tách biệt với lô nhập kho.
- Hệ thống có các API tổng hợp tồn kho vật tư, lịch sử xuất, tồn tại từng location và tổng quan các kho.
- KPI tồn kho gồm tổng số vật tư, số vật tư đủ tồn, cần nhập, số lô hết hạn và giá trị tồn kho.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/AssetService.java 315:338`
- `src/main/java/com/poly/mhv/service/AssetService.java 785:915`
- `src/main/java/com/poly/mhv/service/AssetService.java 1629:1648`
- `src/main/java/com/poly/mhv/controller/AssetController.java 174:289`
- `src/main/java/com/poly/mhv/entity/ConsumableLocationStock.java 20:64`
- `src/main/java/com/poly/mhv/repository/ConsumableLocationStockRepository.java 21:33`
- `src/main/java/com/poly/mhv/repository/ConsumableIssueRepository.java 19:31`

### 3.6. Chuyển kho nội bộ

**Mô tả và diễn giải tính năng**

- Chức năng này phục vụ việc điều phối vật tư giữa các kho nội bộ trong cùng hệ thống.
- Đây là nghiệp vụ cần thiết khi một kho thiếu vật tư còn kho khác đang dư.

**Logic nghiệp vụ**

- Bắt buộc phải có kho nguồn và kho đích khác nhau.
- Hệ thống phân bổ vật tư từ các lot của kho nguồn theo cùng chiến lược xuất kho thông thường.
- Khi chuyển sang kho đích, hệ thống tạo lại lot tương ứng ở kho đích để vẫn bảo toàn truy vết lô.
- Đồng thời ghi lịch sử `ConsumableWarehouseTransfer` phục vụ tra cứu sau này.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/AssetService.java 694:782`
- `src/main/java/com/poly/mhv/service/AssetService.java 2415:2471`
- `src/main/java/com/poly/mhv/controller/AssetController.java 206:214`
- `src/main/java/com/poly/mhv/entity/ConsumableWarehouseTransfer.java 20:63`

### 3.7. Tiêu hủy vật tư hết hạn

**Mô tả và diễn giải tính năng**

- Chức năng này xử lý các lô vật tư đã hết hạn nhưng còn tồn, nhằm loại bỏ khỏi kho một cách có kiểm soát và có phê duyệt.
- Đây là một luồng nghiệp vụ riêng, không được gộp chung với cấp phát thông thường.

**Logic nghiệp vụ**

- Hệ thống chỉ cho phép tiêu hủy các lot đã hết hạn, còn tồn và thuộc vật tư có bật theo dõi hạn sử dụng.
- Khi tạo phiếu tiêu hủy, hệ thống chặn trường hợp một lot đã nằm trong phiếu `PENDING` khác.
- Có thể tạo phiếu tiêu hủy theo nhiều lot hoặc từ một lot cụ thể.
- Khi duyệt tiêu hủy, hệ thống trừ `quantityRemaining` trên từng lot, tính lại tồn tổng của vật tư và cập nhật lại thông tin HSD tổng.
- Nếu từ chối, phiếu chỉ chuyển sang `REJECTED` và lưu lý do, không tác động đến số lượng tồn.
- Hệ thống còn hỗ trợ xuất `DOCX` biên bản tiêu hủy cho các phiếu đã duyệt.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/AssetService.java 854:860`
- `src/main/java/com/poly/mhv/service/AssetService.java 929:999`
- `src/main/java/com/poly/mhv/service/AssetService.java 1002:1108`
- `src/main/java/com/poly/mhv/service/AssetService.java 2773:2843`
- `src/main/java/com/poly/mhv/controller/AssetController.java 247:355`
- `src/main/java/com/poly/mhv/service/ReportService.java 317:440`
- `src/main/java/com/poly/mhv/entity/ConsumableDisposalRequest.java 22:74`
- `src/main/java/com/poly/mhv/entity/ConsumableDisposalRequestItem.java 17:39`

## 4. Nhóm chức năng quản lý sự cố kỹ thuật và helpdesk

### 4.1. Tạo ticket báo hỏng thiết bị

**Mô tả và diễn giải tính năng**

- Chức năng này cho phép người dùng tạo ticket khi phát hiện tài sản cố định gặp sự cố cần xử lý kỹ thuật.
- Ticket là hạt nhân của toàn bộ phân hệ helpdesk, từ phân công, xử lý, gia hạn SLA đến đánh giá hài lòng.

**Logic nghiệp vụ**

- Chỉ tài sản đơn chiếc mới được tạo ticket; consumable bị chặn khỏi luồng này.
- Khi tạo ticket, hệ thống tính SLA mặc định theo mức ưu tiên: `HIGH`, `MEDIUM`, `LOW`.
- Ticket mới sinh ở trạng thái `PENDING`.
- Đồng thời, tài sản được đánh dấu hỏng để các phân hệ khác biết đây là thiết bị đang có sự cố.
- Hệ thống tạo notification và ghi event timeline ngay từ thời điểm phát sinh ticket.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/TicketService.java 63:174`
- `src/main/java/com/poly/mhv/controller/TicketController.java 57:96`
- `src/main/java/com/poly/mhv/service/MaintenanceService.java 44:66`

### 4.2. Phân công, nhận việc và hoàn tất ticket

**Mô tả và diễn giải tính năng**

- Sau khi ticket được tạo, quản trị viên có thể phân công cho kỹ thuật viên phù hợp để xử lý.
- Kỹ thuật viên tiếp nhận, xử lý và đóng ticket sau khi hoàn thành công việc.

**Logic nghiệp vụ**

- Chỉ ticket ở trạng thái `PENDING` mới được phép phân công.
- Kỹ thuật viên được phân công phải phù hợp chuyên môn với loại thiết bị đang gặp sự cố.
- Khi nhận việc, ticket chuyển sang `IN_PROGRESS` và ghi nhận thời điểm `acceptedAt`.
- Khi hoàn tất, ticket chuyển sang `RESOLVED`, đồng thời asset được trả về trạng thái kỹ thuật tốt.
- Dashboard và KPI có thể bị invalidate sau các thay đổi trạng thái này để luôn phản ánh số liệu mới.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/TicketService.java 176:318`
- `src/main/java/com/poly/mhv/service/TicketService.java 532:581`
- `src/main/java/com/poly/mhv/controller/TicketController.java 98:126`

### 4.3. Quyền truy cập, danh sách và chi tiết ticket

**Mô tả và diễn giải tính năng**

- Hệ thống cung cấp các chế độ xem ticket khác nhau cho quản trị viên, người báo hỏng và kỹ thuật viên.
- Đây là lớp logic bảo đảm mỗi người chỉ thấy các ticket đúng vai trò và phạm vi trách nhiệm.

**Logic nghiệp vụ**

- `Admin` xem toàn bộ ticket trong hệ thống.
- `NhanVien` chỉ xem ticket do chính mình tạo.
- `TechSupport` xem ticket đúng chuyên môn hoặc ticket được giao cho mình.
- Service có hàm kiểm tra `canAccessTicket` để dùng lại trong các nhánh nghiệp vụ khác như chat, timeline, chi tiết ticket.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/TicketService.java 372:443`
- `src/main/java/com/poly/mhv/service/TicketService.java 603:622`
- `src/main/java/com/poly/mhv/controller/TicketController.java 156:227`

### 4.4. Gia hạn SLA và cảnh báo SLA

**Mô tả và diễn giải tính năng**

- Đây là nhóm chức năng giám sát tiến độ xử lý ticket theo cam kết thời gian.
- Hệ thống hỗ trợ cả luồng xin gia hạn thủ công và cảnh báo tự động khi sắp hết thời gian SLA.

**Logic nghiệp vụ**

- Chỉ kỹ thuật viên đang phụ trách ticket `IN_PROGRESS` mới được xin gia hạn.
- `Admin` có quyền duyệt hoặc từ chối yêu cầu gia hạn.
- Nếu duyệt, `dueDate` của ticket được kéo dài thêm, đồng thời metadata phạm vi SLA trong `description` cũng được cập nhật.
- Scheduler chạy mỗi 5 phút để rà các ticket `PENDING` và `IN_PROGRESS`.
- Khi tỷ lệ thời gian đã dùng đạt ngưỡng 75% hoặc 90%, hệ thống gửi cảnh báo tới `Admin` và kỹ thuật viên phụ trách.
- Event cảnh báo SLA được ghi vào timeline để tránh gửi lặp lại nhiều lần cho cùng một mốc cảnh báo.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/TicketService.java 687:895`
- `src/main/java/com/poly/mhv/controller/TicketController.java 193:252`
- `src/main/java/com/poly/mhv/service/TicketSlaWarningScheduler.java 31:113`

### 4.5. Đánh giá hài lòng và timeline ticket

**Mô tả và diễn giải tính năng**

- Sau khi ticket hoàn tất, hệ thống cho phép đánh giá mức độ hài lòng nhằm phục vụ đo chất lượng xử lý kỹ thuật.
- Song song, mỗi ticket có một timeline để theo dõi toàn bộ diễn biến nghiệp vụ theo thời gian.

**Logic nghiệp vụ**

- Chỉ ticket `RESOLVED` mới được phép chấm điểm hài lòng.
- Người được chấm có thể là `Admin` hoặc chính người tạo ticket.
- Mỗi lần đánh giá sẽ được lưu vào ticket và đồng thời ghi event vào timeline.
- Timeline tổng hợp nhiều loại sự kiện: tạo ticket, phân công, đổi trạng thái, chat, cảnh báo SLA, gia hạn.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/TicketService.java 320:370`
- `src/main/java/com/poly/mhv/service/TicketEventService.java 30:89`
- `src/main/java/com/poly/mhv/service/TicketEventService.java 50:60`
- `src/main/java/com/poly/mhv/controller/TicketController.java 128:154`

### 4.6. Chat nội bộ trên ticket và media đính kèm

**Mô tả và diễn giải tính năng**

- Ticket hỗ trợ trao đổi trực tiếp giữa người báo hỏng và kỹ thuật viên xử lý ngay trong từng phiếu.
- Ngoài tin nhắn văn bản, hệ thống còn hỗ trợ ảnh và ghi âm để mô tả sự cố trực quan hơn.

**Logic nghiệp vụ**

- Chỉ reporter và assignee mới được quyền xem và gửi chat của ticket.
- Khi lưu tin nhắn, hệ thống tạo thêm một event `TICKET_CHAT` vào timeline.
- Media upload được kiểm soát loại nội dung để phục vụ đúng mục đích chat hỗ trợ.
- Hệ thống còn tạo preview thân thiện như `[Ảnh]` hoặc `[Ghi âm]` để hiển thị ở thông báo và danh sách chat.
- Sau khi lưu message, dữ liệu có thể được broadcast realtime qua WebSocket tới các bên liên quan.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/ChatService.java 40:128`
- `src/main/java/com/poly/mhv/service/ChatService.java 172:181`
- `src/main/java/com/poly/mhv/controller/ChatController.java 41:105`
- `src/main/java/com/poly/mhv/controller/WebSocketChatController.java 22:36`
- `src/main/java/com/poly/mhv/service/ChatRealtimeService.java 19:66`

### 4.7. Thông báo realtime và cảnh báo vận hành

**Mô tả và diễn giải tính năng**

- Phân hệ thông báo cung cấp một luồng feed hợp nhất cho nhiều sự kiện: user, ticket, vật tư, kiểm kê, bảo hành, cảnh báo SLA.
- Ngoài feed đọc sau, hệ thống còn có các cơ chế realtime để báo ngay cho người dùng hoặc quản trị viên.

**Logic nghiệp vụ**

- Notification có thể gửi theo `role` hoặc `user` cụ thể.
- Hệ thống tự loại bỏ các target trùng lặp theo người nhận và đường dẫn điều hướng.
- Mỗi notification có `linkPath` để người dùng bấm vào là đi đúng màn hình nghiệp vụ.
- `AdminAlertSseService` giữ danh sách `SseEmitter` để đẩy cảnh báo realtime theo cơ chế SSE cho quản trị viên.
- Với frontend, nếu realtime bị gián đoạn thì còn có cơ chế polling feed định kỳ.
- Scheduler bảo hành chạy hằng ngày lúc 7h sáng để phát thông báo khi tài sản sắp hết hạn bảo hành sau 3 ngày.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/NotificationService.java 48:146`
- `src/main/java/com/poly/mhv/service/NotificationService.java 177:234`
- `src/main/java/com/poly/mhv/controller/NotificationController.java 31:73`
- `src/main/java/com/poly/mhv/service/AdminAlertSseService.java 17:59`
- `src/main/java/com/poly/mhv/service/WarrantyAlertScheduler.java 27:47`
- `frontend/src/components/GlobalNotification.jsx 54:163`

## 5. Nhóm chức năng kiểm kê tài sản

### 5.1. Tạo phiên kiểm kê

**Mô tả và diễn giải tính năng**

- Mỗi phiên kiểm kê gắn với một phòng cụ thể và được tạo ra để đối chiếu tài sản dự kiến với tài sản thực tế hiện diện.
- Đây là điểm khởi đầu của toàn bộ quy trình kiểm kê.

**Logic nghiệp vụ**

- Mỗi phòng chỉ được có một phiên kiểm kê `OPEN` hợp lệ tại cùng một thời điểm.
- Nếu tồn tại phiên `OPEN` đã quá hạn, hệ thống có thể tự chuyển phiên đó sang `OVERDUE` trước khi cho tạo phiên mới.
- Khi tạo phiên kiểm kê, hệ thống tính trước danh sách tài sản kỳ vọng trong phòng để làm mẫu đối chiếu khi hoàn tất phiên.
- Số lượng kỳ vọng không lấy đơn giản theo tài sản thuộc phòng gốc, mà dựa trên tài sản hiện đang ở phòng tại thời điểm tạo phiên sau khi loại trừ các trạng thái không hợp lệ.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/InventoryAuditService.java 82:162`
- `src/main/java/com/poly/mhv/controller/InventoryAuditController.java 44:88`

### 5.2. Quét tài sản trong phiên kiểm kê

**Mô tả và diễn giải tính năng**

- Trong thời gian phiên còn mở, kỹ thuật viên quét QR hoặc nhập mã QA để ghi nhận các tài sản thực tế có mặt tại phòng.
- Việc quét này là đầu vào để hệ thống tự đối chiếu tài sản thiếu và tài sản hiện diện.

**Logic nghiệp vụ**

- Chỉ quét được khi phiên còn `OPEN` và chưa quá hạn.
- Chỉ tài sản `ITEMIZED` mới được đưa vào kiểm kê theo cơ chế này.
- Tài sản phải đang ở đúng phòng kiểm kê, không được ở trạng thái hỏng, đang sửa, thất lạc hoặc đã quét trước đó.
- Khi quét thành công, hệ thống thêm một bản ghi `InventoryAuditItem` và tăng số lượng đã quét.
- Màn hình chi tiết kiểm kê có thể tách danh sách đã quét, tài sản kỳ vọng, tài sản đang cho mượn, tài sản mượn từ phòng khác và tài sản đang sửa.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/InventoryAuditService.java 254:314`
- `src/main/java/com/poly/mhv/service/InventoryAuditService.java 434:470`
- `src/main/java/com/poly/mhv/controller/InventoryAuditController.java 123:149`
- `src/main/java/com/poly/mhv/dto/inventory/InventoryAuditDetailResponse.java 1:999`

### 5.3. Hoàn tất phiên kiểm kê và xử lý thiếu hụt

**Mô tả và diễn giải tính năng**

- Khi người kiểm kê bấm hoàn tất, hệ thống khóa phiên và tự động xác định các tài sản thiếu dựa trên đối chiếu dữ liệu.
- Các trường hợp thiếu này sau đó được quản trị viên xử lý tiếp theo quy trình nghiệp vụ.

**Logic nghiệp vụ**

- Khi complete, hệ thống so sánh danh sách tài sản kỳ vọng với danh sách đã quét thực tế.
- Những tài sản nằm trong expected nhưng không có trong scanned sẽ được ghi vào `InventoryAuditMissing`.
- Asset thiếu được đánh dấu trạng thái `LOST` để phản ánh rủi ro thất lạc sau kiểm kê.
- `Admin` có thể xử lý tiếp các bản ghi thiếu theo 2 hướng: xác nhận `FOUND` nếu tìm lại được hoặc xác nhận mất hẳn theo nhánh `LOST`.
- Kỹ thuật viên không trực tiếp chỉnh tay thiếu hụt; phần chênh lệch được hệ thống tự tính khi hoàn tất phiên.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/InventoryAuditService.java 316:428`
- `src/main/java/com/poly/mhv/controller/InventoryAuditController.java 151:179`

### 5.4. Logic expected assets, borrowed, lent, repairing và báo cáo kiểm kê

**Mô tả và diễn giải tính năng**

- Đây là lớp logic giúp kiểm kê phản ánh đúng bối cảnh vận hành thực tế của tài sản trong phòng.
- Hệ thống không chỉ đếm đơn thuần tài sản thuộc phòng, mà còn tách các nhóm đang cho mượn, mượn từ nơi khác hoặc đang sửa chữa.

**Logic nghiệp vụ**

- `expectedAssets` là các tài sản hiện đang ở phòng và đủ điều kiện kiểm kê.
- `borrowedItems` là tài sản có phòng gốc ở nơi khác nhưng đang hiện diện tại phòng kiểm kê.
- `lentItems` là tài sản có phòng gốc tại phòng kiểm kê nhưng đang nằm ở nơi khác tại thời điểm kiểm kê.
- `repairingItems` là tài sản đang hỏng hoặc đang sửa, được tách riêng ra khỏi expected để không làm sai lệch đối chiếu.
- Hệ thống hỗ trợ xuất Excel biên bản kiểm kê theo từng phiên để lưu hồ sơ đối chiếu.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/InventoryAuditService.java 538:567`
- `src/main/java/com/poly/mhv/service/InventoryAuditService.java 434:470`
- `src/main/java/com/poly/mhv/service/ReportService.java 219:314`
- `frontend/src/pages/InventoryAuditScanner.jsx 1390:1457`
- `frontend/src/pages/tech/TechSupportInventoryAuditHistory.jsx 54:115`

## 6. Nhóm chức năng quản lý sơ đồ và định vị tài sản

### 6.1. Quản lý sơ đồ tầng

**Mô tả và diễn giải tính năng**

- Module sơ đồ cho phép quản trị viên quản lý mặt bằng nhiều tầng theo 2 chế độ: `GRID` và `IMAGE`.
- Đây là nền tảng để gắn phòng/khu vực và hỗ trợ tìm tài sản trên không gian trực quan.

**Logic nghiệp vụ**

- Có thể tạo, sửa, xóa tầng; mỗi tầng có tên, chế độ hiển thị, số hàng/cột hoặc kích thước ảnh nền.
- Không cho tạo hoặc sửa tầng với tên trùng.
- Nếu tầng ở chế độ `IMAGE`, bắt buộc phải có ảnh nền và kích thước ảnh hợp lệ.
- Khi thu nhỏ canvas, hệ thống kiểm tra để bảo đảm không làm mất hoặc cắt vùng phòng đã vẽ trước đó.
- Bootstrap của module trả về đồng thời danh sách tầng, phòng, loại khu vực và các danh mục phụ trợ để frontend dựng màn hình một lần.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/AssetMapService.java 70:148`
- `src/main/java/com/poly/mhv/service/AssetMapService.java 414:428`
- `src/main/java/com/poly/mhv/service/AssetMapService.java 595:635`
- `src/main/java/com/poly/mhv/controller/AssetMapController.java 61:99`

### 6.2. Vẽ khu vực phòng và gắn với phòng nghiệp vụ

**Mô tả và diễn giải tính năng**

- Sau khi có tầng, quản trị viên có thể vẽ các vùng phòng/khu vực trên sơ đồ và gắn chúng với `Location` nghiệp vụ.
- Mỗi vùng vừa là hình hiển thị trên sơ đồ, vừa là liên kết tới dữ liệu phòng dùng chung toàn hệ thống.

**Logic nghiệp vụ**

- Khi lưu layout, hệ thống kiểm tra chồng lấn ô hoặc chồng lấn vùng để bảo đảm sơ đồ không bị trùng lặp bất hợp lệ.
- Một `Location` không được gắn với nhiều `RoomShape` cùng lúc.
- Người dùng có thể gắn shape với một location có sẵn hoặc tạo location mới rồi gắn ngay.
- Với mode `IMAGE`, shape còn mang thông tin polygon/bounds để vẽ đúng trên nền ảnh.
- Xóa shape trên sơ đồ không đồng nghĩa xóa location nghiệp vụ khỏi hệ thống.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/AssetMapService.java 167:231`
- `src/main/java/com/poly/mhv/service/AssetMapService.java 248:300`
- `src/main/java/com/poly/mhv/controller/AssetMapController.java 127:145`

### 6.3. Tìm tài sản trên sơ đồ và bootstrap dữ liệu

**Mô tả và diễn giải tính năng**

- Chức năng này cho phép quản trị viên tìm tài sản theo vị trí hiện tại và xem nhanh tài sản đang nằm ở phòng nào trên mặt bằng.
- Đây là lớp kết nối giữa dữ liệu asset và giao diện bản đồ trực quan.

**Logic nghiệp vụ**

- Tìm kiếm asset trên sơ đồ dựa trên `location` hiện tại của tài sản, không chỉ dựa trên phòng gốc.
- Bootstrap ban đầu trả các dữ liệu cần thiết để frontend dựng cây tầng, phòng, loại khu vực và danh sách tài sản.
- Từ sơ đồ, người dùng có thể mở ra danh sách asset theo từng khu vực để phục vụ tra cứu hoặc kiểm kê thực địa.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/AssetMapService.java 71:77`
- `src/main/java/com/poly/mhv/service/AssetMapService.java 233:246`
- `src/main/java/com/poly/mhv/controller/AssetMapController.java 61:77`
- `src/main/java/com/poly/mhv/repository/AssetRepository.java 176:212`
- `frontend/src/pages/admin/AssetMapManagement.jsx 1392:1549`
- `frontend/src/pages/admin/AssetMapManagement.jsx 2573:3002`

### 6.4. Import ảnh sơ đồ tầng

**Mô tả và diễn giải tính năng**

- Ngoài cách tạo tầng `GRID`, hệ thống còn hỗ trợ import ảnh bản vẽ tầng để dựng nhanh tầng ở chế độ `IMAGE`.
- Đây là chức năng hỗ trợ số hóa mặt bằng thực tế vào hệ thống.

**Logic nghiệp vụ**

- Chỉ chấp nhận ảnh `PNG`, `JPG`, `JPEG`.
- Ảnh upload phải đi qua `MediaSecurityService` để kiểm tra an toàn.
- Hệ thống tạo một session import tạm thời, lưu metadata và file nguồn vào thư mục tạm.
- Khi người dùng xác nhận apply, backend tạo floor `IMAGE`, tự suy ra kích thước grid theo tỷ lệ ảnh và lưu ảnh nền vào media storage chính thức.
- Sau khi apply xong, session tạm được dọn dẹp.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/AssetMapImportService.java 71:155`
- `src/main/java/com/poly/mhv/service/AssetMapImportService.java 157:270`

## 7. Nhóm chức năng dashboard, KPI và báo cáo quản trị

### 7.1. Dashboard tổng quan tài sản và gợi ý quản trị

**Mô tả và diễn giải tính năng**

- Dashboard cung cấp cái nhìn nhanh về tình trạng vận hành của tài sản trên toàn hệ thống.
- Bên cạnh số liệu tổng hợp, hệ thống còn sinh ra các gợi ý quản trị thông minh dựa trên lịch sử sử dụng và sự cố.

**Logic nghiệp vụ**

- Dashboard summary đếm các nhóm chính như tổng tài sản, đang mượn, đang hỏng, đang sửa và sẵn sàng sử dụng.
- Dữ liệu summary được cache ngắn hạn để giảm tải cho các màn hình truy cập thường xuyên.
- Tính năng `smart suggestions` phân tích số lần báo hỏng trong tháng và số lượt sử dụng để đưa ra gợi ý như theo dõi định kỳ, bảo trì chuyên sâu hoặc thanh lý và mua mới.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/DashboardService.java 42:133`
- `src/main/java/com/poly/mhv/controller/DashboardController.java 33:85`

### 7.2. KPI helpdesk cho quản trị viên và kỹ thuật viên

**Mô tả và diễn giải tính năng**

- Phân hệ KPI giúp theo dõi hiệu quả xử lý sự cố, tuân thủ SLA và chất lượng phục vụ của đội kỹ thuật.
- KPI được chia thành góc nhìn của quản trị viên và góc nhìn của từng kỹ thuật viên.

**Logic nghiệp vụ**

- KPI admin theo dõi các chỉ số như tỷ lệ xử lý đúng hạn, số ticket quá hạn, sức khỏe tài sản, tái lỗi, vật tư tồn thấp và kiểm kê đúng hạn.
- KPI kỹ thuật viên theo dõi thời gian phản hồi đầu tiên, tỷ lệ xử lý đúng hạn, first-time fix, mức độ hài lòng và điểm hiệu suất tổng hợp.
- Hệ thống có công thức chấm điểm và xếp loại thành các mức như `Xuất sắc`, `Tốt`, `Khá`, `Trung bình`, `Yếu`.
- Dữ liệu KPI cũng được cache ngắn hạn để tối ưu hiệu năng hiển thị dashboard.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/HelpdeskKpiService.java 45:148`
- `src/main/java/com/poly/mhv/service/HelpdeskKpiService.java 150:285`
- `src/main/java/com/poly/mhv/service/HelpdeskKpiService.java 287:405`
- `src/main/java/com/poly/mhv/service/HelpdeskKpiService.java 432:588`
- `src/main/java/com/poly/mhv/service/HelpdeskKpiService.java 723:749`
- `frontend/src/components/HelpdeskKpiPanel.jsx 61:292`

### 7.3. Xuất báo cáo nghiệp vụ

**Mô tả và diễn giải tính năng**

- Hệ thống có các chức năng xuất báo cáo để phục vụ lưu trữ, trình ký, đối chiếu và tổng hợp vận hành.
- Dữ liệu báo cáo được sinh trực tiếp từ logic nghiệp vụ hiện hành, không phải dữ liệu nhập tay.

**Logic nghiệp vụ**

- Hỗ trợ xuất Excel danh sách tài sản theo trật tự vị trí.
- Hỗ trợ xuất Excel lịch sử mượn trả theo bộ lọc.
- Hỗ trợ xuất Excel biên bản kiểm kê theo từng phiên.
- Hỗ trợ xuất `DOCX` biên bản tiêu hủy vật tư hết hạn cho các phiếu đã được duyệt.
- Các mẫu báo cáo đồng thời phản ánh nhiều quy tắc nghiệp vụ như phân loại `ITEMIZED/CONSUMABLE`, trạng thái trả tài sản, số lượng dự kiến và số lượng thiếu khi kiểm kê.

**Tệp mã nguồn tham chiếu**

- `src/main/java/com/poly/mhv/service/ReportService.java 81:217`
- `src/main/java/com/poly/mhv/service/ReportService.java 219:440`
- `src/main/java/com/poly/mhv/controller/ReportController.java 36:130`

## 8. Kết luận tổng hợp

- Hệ thống MHV không chỉ là một phần mềm CRUD tài sản đơn thuần mà đã hiện thực hóa khá đầy đủ các luồng nghiệp vụ vận hành thực tế: quản lý danh mục nền, tài sản đơn chiếc, vật tư tiêu hao, ticket helpdesk, kiểm kê, định vị và dashboard quản trị.
- Điểm mạnh nổi bật của thiết kế là dùng một lõi dữ liệu thống nhất nhưng tách logic rõ theo từng loại hình theo dõi: `ITEMIZED` cho tài sản đơn chiếc và `CONSUMABLE` cho vật tư tiêu hao.
- Nhiều quy tắc nghiệp vụ quan trọng đã được mã hóa trực tiếp trong tầng service, ví dụ: bắt buộc chuyên môn cho kỹ thuật viên, cấm xóa danh mục còn tham chiếu, mượn trả theo `homeLocation/location`, cấp phát vật tư theo lot gần hết hạn, xử lý thiếu hụt sau kiểm kê, cảnh báo SLA định kỳ.
- Về mặt triển khai tài liệu, các tệp tham chiếu được liệt kê trong từng mục có thể dùng trực tiếp làm căn cứ chứng minh nghiệp vụ khi viết báo cáo đồ án, bảo vệ hoặc đối chiếu với sơ đồ Use Case, ERD và đặc tả yêu cầu.
