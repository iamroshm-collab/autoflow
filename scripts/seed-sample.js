const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    console.log('Seeding sample supplier, product and purchase...');

    const supplier = await prisma.supplier.create({
      data: {
        supplierName: 'AutoTest Supplier',
        mobileNo: '9999999999',
        address: 'Test Address',
      },
    });

    const product = await prisma.product.create({
      data: {
        supplierId: supplier.supplierId,
        productName: 'Test Product A',
        purchasePrice: 120,
        salePrice: 180,
      },
    });

    const purchase = await prisma.purchase.create({
      data: {
        purchaseDate: new Date(),
        supplierId: supplier.supplierId,
        supplier: supplier.supplierName,
        refDocument: 'REF-001',
        billNumber: 'BILL-001',
        taxable: true,
        purchaseDetails: {
          create: [
            {
              productId: product.productId,
              product: product.productName,
              qnty: 3,
              purchasePrice: 120,
              totalAmount: 3 * 120,
            },
          ],
        },
      },
      include: { purchaseDetails: true },
    });

    console.log('Seed complete:', { supplierId: supplier.supplierId, productId: product.productId, purchaseId: purchase.purchaseId });
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await prisma.$disconnect();
  }
})();
