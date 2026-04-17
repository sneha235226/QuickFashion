const axios = require('axios');
const jwt = require('./src/utils/jwt');

const API_URL = 'http://localhost:3000/api';
const phone = '9999999999';

async function verifyFlow() {
    console.log('--- SELLER END TO END FLOW TEST ---');

    // Generate onboarding token directly (bypass msg91 for test)
    console.log('1. Mocking MSG91 OTP Verification -> generating onboarding token');
    const onboardingToken = jwt.generateOnboardingToken({ phone });
    const authHeader = { Authorization: `Bearer ${onboardingToken}` };

    try {
        console.log('2. Step 1 (Basic Details)');
        const step1 = await axios.post(`${API_URL}/seller/onboarding/step1`, {
            firstName: 'Test',
            lastName: 'Seller',
            gender: 'MALE',
            email: 'test' + Date.now() + '@seller.com',
            password: 'password123'
        }, { headers: authHeader });
        console.log('Step 1 Success:', step1.data.message);

        console.log('3. Step 2 (Business Details)');
        const step2 = await axios.post(`${API_URL}/seller/onboarding/step2`, {
            businessName: 'My Awesome Store',
            ownerName: 'Test Seller',
            productCategories: ['Electronics'],
            businessType: 'individual',
            storeType: 'retail',
            gstNumber: '22AAAAA0000A1Z5',
            gstDocument: 'https://s3.amazonaws.com/test/gst.pdf',
            address: {
                line1: '123 Fake Street',
                state: 'Delhi',
                city: 'New Delhi',
                pincode: '110001'
            }
        }, { headers: authHeader });
        console.log('Step 2 Success:', step2.data.message);

        console.log('4. Step 3 (Bank Details)');
        const step3 = await axios.post(`${API_URL}/seller/onboarding/step3`, {
            accountHolderName: 'Test Seller',
            accountNumber: '1234567890',
            IFSC: 'HDFC0001234',
            bankName: 'HDFC',
            branchName: 'Delhi Central'
        }, { headers: authHeader });
        console.log('Step 3 Success:', step3.data.message);

        // Now admin approval flow
        console.log('5. Admin Approval');
        const prisma = require('./src/config/database');
        let admin = await prisma.admin.findUnique({ where: { email: 'admin@quickfashion.com' } });
        if (!admin) {
            admin = await prisma.admin.create({
                data: { username: 'admin', email: 'admin@quickfashion.com', passwordHash: 'hash' }
            });
        }

        const adminToken = jwt.generateAdminTokens({ adminId: admin.id, email: 'admin@quickfashion.com', role: 'admin' });
        const adminHeader = { Authorization: `Bearer ${adminToken.accessToken}` };

        const pending = await axios.get(`${API_URL}/admin/sellers/pending`, { headers: adminHeader });
        const pendingSellers = pending.data.data.sellers;
        console.log('Pending Sellers count:', pendingSellers.length);

        // Find our testing seller
        const ourSeller = pendingSellers.find(s => s.phone === phone);
        if (!ourSeller) throw new Error('Seller not found in pending list');

        console.log('Approving seller:', ourSeller.id);
        const approve = await axios.post(`${API_URL}/admin/sellers/${ourSeller.id}/approve`, {}, { headers: adminHeader });
        console.log('Approve Success:', approve.data.message);

        console.log('6. Seller Login (Post-approval)');
        const login = await axios.post(`${API_URL}/seller/auth/login`, {
            mobile: phone,
            password: 'password123'
        });
        console.log('Login Success! Got Access Token:', !!login.data.data.accessToken);

        console.log('✅ Flow verified successfully!');
        process.exit(0);
    } catch (err) {
        if (err.response) {
            console.error('API Error Status:', err.response.status);
            console.error('API Error Data:', err.response.data);
        } else {
            console.error('Error:', err.message);
        }
        process.exit(1);
    }
}

verifyFlow();
