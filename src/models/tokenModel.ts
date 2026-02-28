import mongoose, { type Document, type Model, type Schema } from 'mongoose';

export interface IRedemptionDetails {
  ip?: string;
  deviceInfo?: string;
  timestamp?: Date;
}

export interface IToken {
  token: string;
  email: string;
  name: string;
  phone: string;
  createdAt: Date;
  expiresAt: Date;
  isRedeemed: boolean;
  redeemedAt?: Date;
  machineId?: string;
  redemptionDetails?: IRedemptionDetails;
}

export type ITokenDocument = IToken & Document;

const tokenSchema: Schema<ITokenDocument> = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  isRedeemed: { type: Boolean, default: false },
  redeemedAt: { type: Date },
  machineId: { type: String },
  redemptionDetails: {
    ip: String,
    deviceInfo: String,
    timestamp: Date,
  },
});

const Token: Model<ITokenDocument> = mongoose.model<ITokenDocument>('Token', tokenSchema);

export default Token;
