# Frontend Redesign Proposal

## Muc tieu

Nang cap frontend hien tai tu mot dashboard "du dung" thanh mot he thong **AI Operations Console** cho nhan dien khuon mat va cham cong, du dep va an tuong de demo cho lanh dao, nhung van giu duoc tinh enterprise, on dinh va de van hanh.

Cam giac tong the can dat duoc:

- Hien dai
- Tin cay
- Cong nghe cao
- Co dau tu thiet ke
- Mang DNA Viettel
- Khac biet voi cac admin template pho thong

## Dinh huong tong the

Phong cach de xuat: **Viettel High Tech Control Center**

Dac trung cua phong cach nay:

- Nen sach, gon, cao cap
- Diem nhan do Viettel
- Duong net ky thuat, chinh xac
- Card, bang, bieu do ro rang va sang
- Chuyen dong tinh te, khong pho truong
- Co chat security, AI, monitoring, realtime

Noi ngan gon, khi nhin vao giao dien nguoi xem can cam thay day la mot he thong cong nghe nghiem tuc, duoc dau tu, khong phai giao dien dashboard thong thuong.

## Mau sac

Frontend hien tai dang nghieng ve `slate + teal`, kha an toan nhung hoi generic. Huong moi se tap trung vao bo mau co ban sac hon.

### Dinh huong mau chinh

- Do Viettel lam mau thuong hieu va mau nhan
- Trang, xam sang cao cap cho light theme
- Xanh den, than cong nghe cho dark theme
- Mau trang thai rieng cho success, warning, danger

### Palette goi y

- `Primary`: do Viettel
- `Primary hover`: do dam hon
- `Background light`: trang xam rat nhat
- `Surface`: trang sach
- `Ink`: xam than dam
- `Dark background`: xanh den sau
- `Dark surface`: xanh than
- `Border`: xam lanh trung tinh

### Nguyen tac su dung mau

- Do chi dung de tao nhan dien va nhan manh
- Khong lam dung do cho moi thanh phan
- Loi nghiem trong van can mau danger rieng de tranh lan voi mau brand
- Bieu do, badge, CTA, active state can co cap do uu tien mau ro rang

## Theme sang toi

Theme sang toi nen la mot phan cot loi cua he thong moi, khong phai mot tinh nang gan them sau.

### Muc tieu

- Ho tro `light theme`
- Ho tro `dark theme`
- Ho tro `system mode`
- Toan bo mau su dung qua `design tokens`

### Dinh huong light theme

- Sang
- Sach
- Cao cap
- Phu hop thao tac van hanh, bao cao, nghiep vu hang ngay

### Dinh huong dark theme

- Kieu "monitoring center"
- Hop voi camera realtime, alert, dashboard AI
- Tao hieu ung demo rat tot khi trinh bay

Dark theme khong nen den thuan, ma nen:

- Xanh den sau
- Surface noi tinh te
- Accent do Viettel
- Glow nhe, duoc kiem soat

### Huong trien khai ky thuat

- Dung `data-theme="light"` va `data-theme="dark"` tren the `html`
- Dinh nghia token mau trong `globals.css`
- Moi component dung token thay vi mau hardcoded
- Theme switcher luu lua chon trong `localStorage`
- Co fallback theo `prefers-color-scheme`

## Typography

Typography can duoc nang cap de trong "ra san pham" hon.

### Dinh huong

- Tieu de ro, chac, co trong luong
- KPI va so lieu de quet nhanh
- Label, caption, meta text gon va sach
- Hierarchy manh hon giua title, subtitle, body, data label

Nhung khu vuc nhu dashboard, login, panel dieu khien can duoc nhan manh hierarchy de tang cam giac cao cap va chuyen nghiep.

## Icon he thong

Nen co **mot lop icon nhan dien rieng** cho cac chuc nang cot loi.

Khong nhat thiet bo hoan toan `lucide-react`. Huong hop ly:

- Tiep tuc dung line icon chuan cho thao tac thong thuong
- Tao them nhom `signature icons` cho nhung diem nhan he thong

### Cac icon nen co ban sac rieng

- Face recognition
- Camera AI
- Attendance
- Spoof alert
- Realtime monitoring
- Department network
- Admin control
- Event review

### Phong cach icon

- Net manh, gon
- Hoi vuong, ky thuat
- Co motif scan frame, signal, grid, node, tracking box
- Toi gian nhung khac biet

Chi can 6-10 icon rieng tot la he thong se giam cam giac template rat nhieu.

## Motion va nen dong

Nen co motion va nen dong, nhung phai rat tinh te va co chu dich.

### Khu vuc nen ap dung

- Login page
- Dashboard hero hoac top section
- Background shell o muc do rat nhe
- Camera, realtime, event states

### Loai hieu ung phu hop

- Luoi cong nghe mo
- Scan line chuyen dong cham
- Node hoac line connection nhe
- Gradient shift rat cham
- Card reveal, hover, glow nhe
- Alert pulse tiet che

### Dieu can tranh

- Particle qua nhieu
- Anh sang neon gat
- Animation nhanh
- Nen dong lam kho doc du lieu

Muc tieu la tao cam giac "cao cap va thong minh", khong phai "pho dien".

## Ngon ngu duong net

Frontend can co mot ngon ngu thiet ke thong nhat giup UI co ca tinh va nho lau.

### Nguyen tac

- Bo goc vua phai, khong qua tron
- Border manh, sach
- Shadow mem, khong day
- Co the dung scan bracket o mot so panel quan trong
- Divider manh, khoang trang thoang
- Pattern luoi hoac line rat nhe o mot so nen

Neu cac chi tiet nay lap lai co chu dich, giao dien se dep va giong mot he thong duoc thiet ke bai ban.

## Bo cuc giao dien

Day la mot dashboard enterprise, vi vay bo cuc nen duoc nang cap theo ngon ngu "control center".

### Login

- Bien thanh man hinh "secure access portal"
- Co background dong nhe
- Branding ro hon
- Co phan gioi thieu cong nghe, AI, monitoring
- Tao cam giac day la he thong trong yeu, hien dai

### App shell

- Sidebar dep hon, active state co dau an rieng
- Top area, account, notifications tinh gon hon
- Theme switcher va language switcher dat hop ly
- Tong the shell can tao an tuong cao cap ngay tu lan nhin dau

### Dashboard

- KPI card co nhip thi giac manh hon
- Camera panel noi bat hon
- Latest events, alerts, charts duoc to chuc nhu trung tam dieu hanh
- Co trong tam ro rang, tranh trai deu va qua phang

### Data pages

- Table, filter, date picker, dropdown, dialog can duoc dua len cung mot chuan
- Giam cam giac form nghiep vu kho
- Tang do sang bang spacing, typography, hover, focus, badge

## Design system

Can xay mot mini design system de toan bo he thong dep dong nhat va mo rong ben vung.

### Thanh phan can co

- Color tokens
- Light and dark tokens
- Spacing scale
- Radius scale
- Shadow scale
- Typography levels
- Button variants
- Input, select, textarea styles
- Badge, status styles
- Card, dialog, dropdown, toast styles

Khi lam xong lop nen nay, viec nang cap cac man hinh se nhanh va it vo dong bo hon.

## Trang thai du lieu va trai nghiem san pham

Mot he thong dep khong chi dep o mau sac, ma con o cach xu ly va hien thi trang thai.

### Cac trang thai can duoc thiet ke ky

- Loading
- Empty state
- Success
- Error
- Realtime connected and disconnected
- Alert severity
- Disabled
- Selected row
- Active filter

Neu lam tot phan nay, san pham se ra chat enterprise hon rat nhieu.

## Yeu to gay an tuong voi lanh dao

Khi demo, thu dap vao mat nhat thuong khong phai code ma la:

- Ban sac thuong hieu
- Do chi chu
- Cam giac hien dai
- Su nhat quan
- Trai nghiem muot

Vi vay frontend moi can tao duoc 4 lop an tuong:

- Nhan dien Viettel ro nhung tinh te
- Dashboard nhin nhu san pham lon
- Dark mode rat sang
- Motion va icon du khac biet de nguoi xem nho

## Lo trinh trien khai de xuat

### Giai doan 1: Xay nen theme system

- Tao token mau
- Ho tro light, dark, system mode
- Tao theme provider
- Them theme switcher

### Giai doan 2: Refactor shared UI

- Button
- Input
- Card
- Badge
- Dialog
- Dropdown
- Toast

### Giai doan 3: Nang cap app shell

- Sidebar
- Top account area
- Notification area
- Theme switcher

### Giai doan 4: Lam lai login

- Branding
- Motion
- Nen dong
- Cam giac secure portal

### Giai doan 5: Lam lai dashboard

- KPI
- Camera
- Events
- Alerts
- Charts
- Executive look

### Giai doan 6: Nang cap data pages

- Persons
- Attendance
- Departments
- Events

### Giai doan 7: Bo sung chi tiet nhan dien

- Signature icons
- Grid, scan, signal details
- Micro motion

## Ket luan

Dinh huong frontend moi cua he thong se la:

- Mot giao dien mang phong cach **Viettel High Tech AI Control Center**
- Co **theme sang toi** bai ban
- Co **palette do Viettel + nen sang cao cap + dark mode xanh den**
- Co **icon nhan dien rieng** cho cac chuc nang cot loi
- Co **motion va nen dong nhe** de tang wow factor
- Co **design system dong nhat** de toan he thong dep that, khong chi dep vai man
- Uu tien `login + app shell + dashboard` de tao an tuong manh nhat khi demo

## Buoc tiep theo de xuat

Co the trien khai theo mot trong hai huong:

1. Viet tiep mot tai lieu chi tiet hon gom palette chinh thuc, token light-dark, phong cach icon, layout login va dashboard.
2. Bat dau trien khai code tu nen mong theme system truoc, sau do nang cap dan `shared UI`, `app shell`, `login`, `dashboard`.

Huong uu tien de dat hieu qua thuc te nhanh nhat:

- Xay theme system
- Nang cap login
- Nang cap app shell
- Nang cap dashboard
