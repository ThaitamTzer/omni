import { PrismaClient, StaffRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Default admin account (change password on first login!)
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@omni.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';

  const existing = await prisma.staff.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.staff.create({
      data: { email, name: 'Quản trị viên', passwordHash, role: StaffRole.ADMIN },
    });
    console.log(`Created admin staff: ${email} / ${password}`);
  } else {
    console.log(`Admin staff already exists: ${email}`);
  }

  // Default AI rules
  const rules = [
    {
      name: 'Hỏi giá sản phẩm',
      keywords: ['giá', 'bao nhiêu', 'bảng giá', 'chi phí', 'cost', 'price'],
      responseTemplate: 'Dạ, giá sản phẩm của shop là 1.500.000đ. Anh/chị cần tư vấn thêm gì ạ?',
      priority: 10,
    },
    {
      name: 'Thời gian giao hàng',
      keywords: ['giao hàng', 'khi nào nhận', 'ship', 'bao lâu', 'vận chuyển', 'delivery'],
      responseTemplate: 'Dạ, đơn hàng nội thành sẽ giao trong 1-2 ngày, ngoại tỉnh 3-5 ngày ạ.',
      priority: 8,
    },
  ];
  for (const rule of rules) {
    const existingRule = await prisma.aiRule.findFirst({ where: { name: rule.name } });
    if (!existingRule) {
      await prisma.aiRule.create({ data: rule });
      console.log(`Created AI rule: ${rule.name}`);
    }
  }

  // Default FAQ
  const faqs = [
    {
      question: 'Thời gian giao hàng bao lâu?',
      answer: 'Dạ, đơn hàng nội thành giao trong 1-2 ngày, ngoại tỉnh 3-5 ngày làm việc ạ.',
      keywords: ['giao hàng', 'khi nào nhận', 'ship', 'bao lâu', 'vận chuyển'],
      category: 'giao-hang',
    },
    {
      question: 'Chính sách đổi trả như thế nào?',
      answer: 'Dạ, trong vòng 7 ngày kể từ khi nhận hàng, sản phẩm còn nguyên tem mác được đổi trả. Hoàn tiền trong 3-5 ngày làm việc ạ.',
      keywords: ['đổi trả', 'trả hàng', 'hoàn tiền', 'refund', 'đổi size'],
      category: 'doi-tra',
    },
    {
      question: 'Sản phẩm có bảo hành không?',
      answer: 'Dạ, sản phẩm được bảo hành 12 tháng. Lỗi do nhà sản xuất sẽ được 1 đổi 1 miễn phí ạ.',
      keywords: ['bảo hành', 'warranty', 'hỏng', 'lỗi'],
      category: 'bao-hanh',
    },
    {
      question: 'Thanh toán bằng những hình thức nào?',
      answer: 'Dạ, shop hỗ trợ thanh toán khi nhận hàng (COD), chuyển khoản ngân hàng, và ví điện tử (MoMo, ZaloPay) ạ.',
      keywords: ['thanh toán', 'chuyển khoản', 'cod', 'momo', 'zalopay', 'trả tiền'],
      category: 'thanh-toan',
    },
  ];
  for (const faq of faqs) {
    const existing = await prisma.faq.findFirst({ where: { question: faq.question } });
    if (!existing) {
      await prisma.faq.create({ data: { ...faq, keywords: faq.keywords as unknown as object } });
      console.log(`Created FAQ: ${faq.question}`);
    }
  }

  // Sample products
  const products = [
    { sku: 'AO-001', name: 'Áo thun cotton cao cấp', description: 'Chất cotton 100%, nhiều màu, form rộng thoáng', price: 299000, stock: 120 },
    { sku: 'AO-002', name: 'Áo sơ mi công sở', description: 'Vải kaki cao cấp, chống nhăn, phù hợp văn phòng', price: 399000, stock: 60 },
    { sku: 'QUAN-001', name: 'Quần jeans nam', description: 'Denim Nhật Bản, co giãn nhẹ, dáng slim', price: 549000, stock: 40 },
    { sku: 'GI-001', name: 'Giày thể thao', description: 'Đế EVA êm, thoáng khí, phù hợp chạy bộ', price: 899000, stock: 25 },
    { sku: 'TUI-001', name: 'Túi xách da tổng hợp', description: 'Chống nước, nhiều ngăn, phong cách công sở', price: 459000, stock: 15 },
  ];
  for (const product of products) {
    const existing = await prisma.product.findUnique({ where: { sku: product.sku } });
    if (!existing) {
      await prisma.product.create({ data: product });
      console.log(`Created product: ${product.name}`);
    }
  }

  // Sample orders
  const orders = [
    { orderCode: 'DH12345', customerName: 'Lê Trần Thái Tâm', customerFbId: '26356230307316772', status: 'shipping', carrier: 'GHTK', estimatedDelivery: new Date(Date.now() + 2 * 86400000), items: [{ productName: 'Áo thun cotton cao cấp', qty: 2, price: 299000 }] },
    { orderCode: 'DH12346', customerName: 'Nguyễn Văn An', status: 'processing', carrier: null, estimatedDelivery: new Date(Date.now() + 4 * 86400000), items: [{ productName: 'Giày thể thao', qty: 1, price: 899000 }] },
    { orderCode: 'DH12347', customerName: 'Lê Trần Thái Tâm', customerFbId: '26356230307316772', status: 'delivered', carrier: 'Viettel Post', estimatedDelivery: new Date(Date.now() - 2 * 86400000), items: [{ productName: 'Quần jeans nam', qty: 1, price: 549000 }] },
  ];
  for (const order of orders) {
    const existing = await prisma.order.findUnique({ where: { orderCode: order.orderCode } });
    if (!existing) {
      await prisma.order.create({ data: { ...order, items: order.items as unknown as object } });
      console.log(`Created order: ${order.orderCode}`);
    }
  }

  // Default settings
  const settings = [
    { key: 'ai_tone', value: 'Thân thiện, lịch sự, xưng hô "dạ/ạ" với khách hàng.' },
    { key: 'ai_max_replies_per_hour', value: '10' },
    { key: 'ai_max_replies_per_conversation', value: '10' },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  console.log('Seed hoàn tất.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
