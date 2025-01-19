// src/models/tokenModel.js
const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  isRedeemed: { type: Boolean, default: false },
  redeemedAt: { type: Date },
  machineId: { type: String }, // Identificador único de la máquina
  redemptionDetails: {
    ip: String,
    deviceInfo: String,
    timestamp: Date
  }
});

module.exports = mongoose.model('Token', tokenSchema);