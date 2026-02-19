
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCounts() {
    try {
        const customerCount = await prisma.customer.count();
        const employeeCount = await prisma.employee.count();
        const productCount = await prisma.product.count();
        console.log(JSON.stringify({
            customers: customerCount,
            employees: employeeCount,
            products: productCount
        }));
    } catch (e) {
        console.error("DB Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkCounts();
