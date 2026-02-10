const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AppSchema = new Schema({
  name: { type: String, required: true },
  company: { type: String, required: true }, // Company that owns the app
  apiEndpoint: { type: String }, // For webhook/reminder integration
});

module.exports = mongoose.model('App', AppSchema);