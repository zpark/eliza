// TODO: Store in cache, replace mongoose with cache adapter

import type { ITransactionHistory } from "../types";
import Mongoose, { Schema } from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const schema = new Schema<ITransactionHistory, Mongoose.Model<ITransactionHistory>>(
	{
		txHash: { type: String },
		blockTime: { type: Date },
		data: { type: Object },
	},
	{ timestamps: true },
);

schema.plugin(mongoosePaginate);

schema.index({ txHash: 1 }, { unique: true });
schema.index({ "data.mainAction": 1 });
schema.index({ blockTime: 1 });

const Model = Mongoose.model<ITransactionHistory, Mongoose.PaginateModel<ITransactionHistory>>("TransactionHistory", schema);

Model.syncIndexes();

export default Model;
