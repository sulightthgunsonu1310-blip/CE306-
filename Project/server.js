const express = require('express');
const path = require('path');
const fs = require('fs');
const initialData = require('./data');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = path.join(__dirname, 'database.json');

function loadDB() {
    if (fs.existsSync(DB_FILE)) {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    return initialData;
}

function saveDB(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

let db = loadDB();

// [READ] ดึงรายการเมนูทั้งหมด
app.get('/api/menus', (req, res) => {
    res.json(db.menus);
});

// [CREATE] เพิ่มเมนูอาหารใหม่จากหน้า Admin
app.post('/api/menus', (req, res) => {
    const { menu_name, category, price, desc, img } = req.body;
    const newMenu = {
        id: db.menus.length > 0 ? Math.max(...db.menus.map(m => m.id)) + 1 : 1,
        menu_name,
        category,
        price: parseFloat(price),
        desc: desc || 'เมนูแนะนำประจำวันจาก DAILY CATER',
        img: img || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80'
    };
    db.menus.push(newMenu);
    saveDB(db);
    res.status(201).json(newMenu);
});

// [READ] ดึงข้อมูลลูกค้าทั้งหมด
app.get('/api/customers', (req, res) => {
    res.json(db.users);
});

// [READ] ดึงรายการออเดอร์ทั้งหมด
app.get('/api/orders/all', (req, res) => {
    res.json({ total: db.orders.length, data: db.orders });
});

// [READ] ดึงเฉพาะรายการที่ "ค้างชำระ" (unpaid)
app.get('/api/orders/unpaid', (req, res) => {
    const unpaidOrders = db.orders.filter(o => o.payment_status === 'unpaid');
    res.json({ total: unpaidOrders.length, data: unpaidOrders });
});

// [READ] ดึงเฉพาะรายการที่ "ชำระมัดจำแล้ว" (paid_deposit)
app.get('/api/orders/paid', (req, res) => {
    const paidOrders = db.orders.filter(o => o.payment_status === 'paid_deposit');
    res.json({ total: paidOrders.length, data: paidOrders });
});

// [READ] สถิติเปรียบเทียบรายได้แต่ละเดือน (Monthly Revenue Comparison)
app.get('/api/analytics/monthly', (req, res) => {
    const paidOrders = db.orders.filter(o => o.payment_status === 'paid_deposit');
    const currentMonthTotal = paidOrders.reduce((sum, o) => sum + o.total_price, 0);
    const currentMonthDeposit = paidOrders.reduce((sum, o) => sum + o.deposit_price, 0);

    // ข้อมูลเปรียบเทียบ 6 เดือน (พ.ย. คำนวณจากออเดอร์จริงในระบบแบบ Real-time)
    const monthlyStats = [
        { month: 'มิ.ย. 2026', snackbox: 12500, lunchbox: 18400, total: 30900 },
        { month: 'ก.ค. 2026', snackbox: 14200, lunchbox: 21000, total: 35200 },
        { month: 'ส.ค. 2026', snackbox: 13800, lunchbox: 19500, total: 33300 },
        { month: 'ก.ย. 2026', snackbox: 16900, lunchbox: 24800, total: 41700 },
        { month: 'ต.ค. 2026', snackbox: 18500, lunchbox: 26200, total: 44700 },
        { 
            month: 'พ.ย. 2026 (ปัจจุบัน)', 
            snackbox: paidOrders.filter(o => o.items_text.includes('ชุดเบรค')).reduce((s, o) => s + o.total_price, 0),
            lunchbox: paidOrders.filter(o => !o.items_text.includes('ชุดเบรค')).reduce((s, o) => s + o.total_price, 0),
            total: currentMonthTotal 
        }
    ];

    res.json({
        monthlyStats,
        currentMonthTotal,
        currentMonthDeposit,
        lastMonthTotal: 44700
    });
});

// [CREATE] สร้างออเดอร์ใหม่ + บันทึกข้อมูลลูกค้า
app.post('/api/orders', (req, res) => {
    const { customerName, phone, address, menuId, quantity, deliveryDate, deliveryTime, paymentMethod } = req.body;
    const selectedMenu = db.menus.find(m => m.id === parseInt(menuId));
    
    let existingUser = db.users.find(u => u.phone === phone);
    if (existingUser) {
        existingUser.name = customerName;
        existingUser.address = address;
    } else {
        db.users.push({
            id: db.users.length + 1,
            name: customerName,
            phone: phone,
            address: address,
            role: 'snackbox'
        });
    }

    const totalPrice = selectedMenu ? selectedMenu.price * parseInt(quantity) : 0;
    const depositPrice = totalPrice * 0.5;
    const remainingPrice = totalPrice - depositPrice;

    const newOrder = {
        id: db.orders.length > 0 ? Math.max(...db.orders.map(o => o.id)) + 1 : 1,
        customer_name: customerName,
        phone: phone,
        address: address,
        delivery_date: deliveryDate,
        delivery_time: deliveryTime,
        total_price: totalPrice,
        deposit_price: depositPrice,
        remaining_price: remainingPrice,
        payment_method: paymentMethod,
        payment_status: 'unpaid',
        status: 'pending',
        items_text: `${selectedMenu ? selectedMenu.menu_name : 'ชุดอาหาร'} (x${quantity})`
    };
    
    db.orders.unshift(newOrder);
    saveDB(db);

    res.status(201).json({ message: 'Order & Customer saved successfully', order: newOrder });
});

// [UPDATE] ยืนยันชำระมัดจำ 50%
app.put('/api/orders/:id/pay-deposit', (req, res) => {
    const { id } = req.params;
    const order = db.orders.find(o => o.id === parseInt(id));
    if (order) {
        order.payment_status = 'paid_deposit';
        saveDB(db);
        res.json({ message: 'Deposit paid successfully', order });
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
});

// [UPDATE] ร้านค้าอัปเดตสถานะออเดอร์
app.put('/api/orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const order = db.orders.find(o => o.id === parseInt(id));
    if (order) {
        order.status = status;
        saveDB(db);
        res.json({ message: `Order status updated to ${status}`, order });
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
});

// [DELETE] ยกเลิกออเดอร์
app.delete('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    db.orders = db.orders.filter(o => o.id !== parseInt(id));
    saveDB(db);
    res.json({ message: 'Order deleted' });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 DAILY CATER Server running at http://localhost:${PORT}`);
});