let allMenus = [];
let currentCategory = 'all';
let currentOrderId = null;
let paymentModalObj = null;
let adminModalObj = null;

document.addEventListener("DOMContentLoaded", () => {
    paymentModalObj = new bootstrap.Modal(document.getElementById('paymentModal'));
    adminModalObj = new bootstrap.Modal(document.getElementById('adminLoginModal'));
    loadMenus();
    loadUnpaidOrders();
    loadSavedCustomers();
});

// เปิดหน้าต่างใส่รหัส Admin
function openAdminLogin() {
    document.getElementById('adminPasswordInput').value = '';
    document.getElementById('adminErrorMsg').classList.add('d-none');
    adminModalObj.show();
    setTimeout(() => document.getElementById('adminPasswordInput').focus(), 400);
}

// ตรวจสอบรหัสผ่าน Admin (เฉพาะรหัส 67111873 เท่านั้น)
function verifyAdminPassword() {
    const pass = document.getElementById('adminPasswordInput').value.trim();
    if (pass === '67111873') {
        sessionStorage.setItem('daily_cater_admin_auth', '67111873');
        adminModalObj.hide();
        window.location.href = '/admin.html';
    } else {
        document.getElementById('adminErrorMsg').classList.remove('d-none');
        document.getElementById('adminPasswordInput').value = '';
        document.getElementById('adminPasswordInput').focus();
    }
}

// โหลดรายการเมนูทั้งหมด 12 รายการ
async function loadMenus() {
    try {
        const res = await fetch('/api/menus');
        allMenus = await res.json();
        
        const menuSelect = document.getElementById('menuSelect');
        menuSelect.innerHTML = '';
        allMenus.forEach(m => {
            menuSelect.innerHTML += `<option value="${m.id}" data-price="${m.price}">${m.menu_name} (${m.price} บาท)</option>`;
        });

        renderMenuGrid(allMenus);
        calculatePreviewPrice();
    } catch (err) {
        console.error('Error loading menus', err);
    }
}

// แสดงการ์ดเมนูอาหาร
function renderMenuGrid(menusToRender) {
    const grid = document.getElementById('menuGrid');
    grid.innerHTML = '';

    if (menusToRender.length === 0) {
        grid.innerHTML = `<div class="col-12 text-center py-4 text-muted">ไม่พบเมนูอาหารที่ค้นหา</div>`;
        return;
    }

    menusToRender.forEach(m => {
        const badgeClass = m.category === 'snackbox' ? 'badge-snack' : 'badge-lunch';
        const badgeText = m.category === 'snackbox' ? '🥐 ชุดเบรค (Snackbox)' : '🍱 อาหารกลางวัน (Lunchbox)';

        grid.innerHTML += `
            <div class="col-sm-6 col-md-4 col-lg-3">
                <div class="menu-card d-flex flex-column">
                    <img src="${m.img}" alt="${m.menu_name}">
                    <div class="p-3 d-flex flex-column flex-grow-1">
                        <div class="mb-2">
                            <span class="badge ${badgeClass} rounded-pill px-2 py-1 small">${badgeText}</span>
                        </div>
                        <h6 class="fw-bold mb-1">${m.menu_name}</h6>
                        <p class="text-muted small flex-grow-1 mb-3">${m.desc}</p>
                        <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">
                            <span class="fw-bold fs-5" style="color: var(--brand-teal);">${m.price} ฿</span>
                            <button class="btn btn-pill-orange btn-sm px-3" onclick="chooseMenu(${m.id})">สั่งเมนูนี้</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
}

function selectCategory(cat) {
    currentCategory = cat;
    document.getElementById('btnCatAll').classList.toggle('active', cat === 'all');
    document.getElementById('btnCatSnack').classList.toggle('active', cat === 'snackbox');
    document.getElementById('btnCatLunch').classList.toggle('active', cat === 'lunchbox');
    filterMenus();
    document.getElementById('menu-section').scrollIntoView({ behavior: 'smooth' });
}

function filterMenus() {
    const keyword = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allMenus.filter(m => {
        const matchCat = currentCategory === 'all' || m.category === currentCategory;
        const matchText = m.menu_name.toLowerCase().includes(keyword) || m.desc.toLowerCase().includes(keyword);
        return matchCat && matchText;
    });
    renderMenuGrid(filtered);
}

function chooseMenu(menuId) {
    document.getElementById('menuSelect').value = menuId;
    calculatePreviewPrice();
    document.getElementById('order-section').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('customerName').focus();
}

function calculatePreviewPrice() {
    const select = document.getElementById('menuSelect');
    const selectedOption = select.options[select.selectedIndex];
    if (!selectedOption) return;

    const price = parseFloat(selectedOption.getAttribute('data-price')) || 0;
    const qty = parseInt(document.getElementById('quantity').value) || 0;
    const total = price * qty;
    const deposit = total * 0.5;

    document.getElementById('pricePreview').innerText = `${total.toLocaleString()} / ${deposit.toLocaleString()} บาท`;
}

async function loadSavedCustomers() {
    try {
        const res = await fetch('/api/customers');
        const customers = await res.json();
        const listDiv = document.getElementById('savedCustomersList');
        document.getElementById('customerCountBadge').innerText = `${customers.length} รายชื่อ`;
        listDiv.innerHTML = '';

        customers.forEach(c => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-outline-secondary btn-sm rounded-pill';
            btn.innerHTML = `👤 ${c.name} (${c.phone})`;
            btn.onclick = () => {
                document.getElementById('customerName').value = c.name;
                document.getElementById('phone').value = c.phone;
                document.getElementById('address').value = c.address || '';
            };
            listDiv.appendChild(btn);
        });
    } catch (err) {
        console.error('Error loading customers', err);
    }
}

async function loadUnpaidOrders() {
    try {
        const res = await fetch('/api/orders/unpaid');
        const data = await res.json();
        const tbody = document.getElementById('unpaidTableBody');
        tbody.innerHTML = '';

        if (data.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">ไม่มีรายการค้างชำระมัดจำ 👍</td></tr>`;
            return;
        }

        data.data.forEach(order => {
            tbody.innerHTML += `
                <tr>
                    <td>#${order.id}</td>
                    <td>
                        <strong>${order.customer_name}</strong><br>
                        <small class="text-muted">${order.items_text}</small>
                    </td>
                    <td><strong class="text-danger">${order.deposit_price} ฿</strong></td>
                    <td><span class="badge bg-danger">ค้างชำระ</span></td>
                    <td>
                        <button class="btn btn-sm btn-success rounded-pill px-3 fw-bold mb-1" onclick="openPaymentModal(${order.id}, '${order.customer_name}', ${order.deposit_price}, ${order.total_price}, ${order.remaining_price}, '${order.payment_method}')">💳 ชำระเงิน</button>
                        <button class="btn btn-sm btn-outline-danger rounded-pill" onclick="deleteOrder(${order.id})">ยกเลิก</button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        console.error('Error loading unpaid orders', err);
    }
}

function openPaymentModal(id, customerName, depositPrice, totalPrice, remainingPrice, paymentMethod) {
    currentOrderId = id;
    document.getElementById('modalCustomerName').innerText = `ผู้สั่งซื้อ: ${customerName}`;
    document.getElementById('modalDepositAmount').innerText = `ยอดมัดจำ 50% ที่ต้องชำระ: ${depositPrice} บาท`;
    document.getElementById('modalRemainingAmount').innerText = `(ราคารวม ${totalPrice} บาท / คงเหลืออีก ${remainingPrice} บาทชำระเมื่อได้รับของ)`;

    if (paymentMethod === 'promptpay') {
        document.getElementById('promptpaySection').classList.remove('d-none');
        document.getElementById('cashSection').classList.add('d-none');
    } else {
        document.getElementById('promptpaySection').classList.add('d-none');
        document.getElementById('cashSection').classList.remove('d-none');
    }

    paymentModalObj.show();
}

document.getElementById('orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const customerName = document.getElementById('customerName').value;
    const phone = document.getElementById('phone').value;
    const address = document.getElementById('address').value;
    const menuId = document.getElementById('menuSelect').value;
    const quantity = document.getElementById('quantity').value;
    const deliveryDate = document.getElementById('deliveryDate').value;
    const deliveryTime = document.getElementById('deliveryTime').value;
    const paymentMethod = document.getElementById('paymentMethod').value;

    const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName, phone, address, menuId, quantity, deliveryDate, deliveryTime, paymentMethod })
    });

    const result = await res.json();
    loadUnpaidOrders();
    loadSavedCustomers();

    openPaymentModal(result.order.id, result.order.customer_name, result.order.deposit_price, result.order.total_price, result.order.remaining_price, result.order.payment_method);
});

document.getElementById('btnConfirmPay').addEventListener('click', async () => {
    if (!currentOrderId) return;

    await fetch(`/api/orders/${currentOrderId}/pay-deposit`, { method: 'PUT' });

    alert('✅ บันทึกข้อมูลและชำระมัดจำ 50% เรียบร้อยแล้ว! ออเดอร์ถูกส่งไปยังร้านค้าทันที');
    paymentModalObj.hide();
    loadUnpaidOrders();
});

async function deleteOrder(id) {
    if (confirm('คุณต้องการยกเลิกออเดอร์นี้ใช่หรือไม่?')) {
        await fetch(`/api/orders/${id}`, { method: 'DELETE' });
        loadUnpaidOrders();
    }
}