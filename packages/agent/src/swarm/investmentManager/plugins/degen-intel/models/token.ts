// TODO: Store in cache, replace mongoose with cache adapter

import type { IToken } from "../types";
import Mongoose, { Schema } from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const schema = new Schema<IToken, Mongoose.Model<IToken>>(
	{
		provider: { type: String },
		chain: { type: String },
		address: { type: String },
		decimals: { type: Number },
		liquidity: { type: Number },
		logoURI: { type: String },
		name: { type: String },
		marketcap: { type: Number },
		symbol: { type: String },
		volume24hUSD: { type: Number },
		rank: { type: Number },
		price: { type: Number },
		price24hChangePercent: { type: Number },
		last_updated: { type: Date },
	},
	{ timestamps: true },
);

schema.plugin(mongoosePaginate);

schema.index({ address: 1, chain: 1 });
schema.index({ provider: 1 });
schema.index({ rank: 1 });

const Model = Mongoose.model<IToken, Mongoose.PaginateModel<IToken>>("Token", schema);

Model.syncIndexes();

export default Model;
