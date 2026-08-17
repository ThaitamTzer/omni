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

  // Default settings
  const settings = [
    { key: 'ai_tone', value: 'Thân thiện, lịch sự, xưng hô "dạ/ạ" với khách hàng.' },
    { key: 'ai_language', value: 'vi' },
    { key: 'ai_auto_reply_enabled', value: 'true' },
    { key: 'ai_max_replies_per_hour', value: '10' },
    { key: 'ai_max_replies_per_conversation', value: '10' },
    { key: 'business_hours', value: '{"mon-fri":"08:00-18:00","sat":"08:00-12:00"}' },
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
