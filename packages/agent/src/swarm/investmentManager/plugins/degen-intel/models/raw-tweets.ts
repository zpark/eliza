// TODO: Store in cache, replace mongoose with cache adapter

import type { IRawTweet } from "../types";
import Mongoose, { Schema } from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const schema = new Schema<IRawTweet, Mongoose.Model<IRawTweet>>(
	{
		id: { type: String },
		timestamp: { type: Date },
		text: { type: String },
		username: { type: String },
		likes: { type: Number },
		retweets: { type: Number },
	},
	{ timestamps: true },
);

schema.plugin(mongoosePaginate);

schema.index({ id: 1 });
schema.index({ timestamp: 1 });

const Model = Mongoose.model<IRawTweet, Mongoose.PaginateModel<IRawTweet>>("RawTweet", schema);

Model.syncIndexes();

export default Model;
