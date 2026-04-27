const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:3000/seller/auth/login', {
      emailOrPhone: 'apple@example.com', // wait, I need a seller token. Or I can just check the controller.
    });
  } catch (e) {
    console.error(e.message);
  }
}
test();
