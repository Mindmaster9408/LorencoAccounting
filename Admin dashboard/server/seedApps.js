const mongoose = require('mongoose');
const App = require('./models/App');

const apps = [
  { name: 'Lorenco Ecosystum', company: 'Lorenco' },
  { name: 'Checkout Charlie', company: 'Lorenco' },
  { name: 'Lorenco Paytime', company: 'Lorenco' },
  { name: 'Lorenco Accounting', company: 'Lorenco' },
  { name: 'Lorenco Inventory Boss', company: 'Lorenco' },
  { name: 'Lorenco Business Doks', company: 'Lorenco' },
  { name: 'Lorenco Practise', company: 'Lorenco' },
  { name: 'Sean', company: 'Other' },
  { name: 'The Infinite Legacy', company: 'Other' },
  { name: 'Lorenco Legacy Reports', company: 'Lorenco' }
];

async function seedApps() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/admin-dashboard');
  await App.deleteMany({});
  await App.insertMany(apps);
  console.log('Apps seeded');
  mongoose.disconnect();
}

seedApps();
