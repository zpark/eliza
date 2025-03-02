// TODO: Store in cache, replace mongoose with cache adapter

import type { ISentiment } from "../types";
import Mongoose, { Schema } from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const schema = new Schema<ISentiment, Mongoose.Model<ISentiment>>(
	{
		timeslot: { type: Date },
		processed: { type: Boolean, default: false },
		text: { type: String },
		occuringTokens: [
			{
				token: { type: String },
				sentiment: { type: Number },
				reason: { type: String },
			},
		],
	},
	{ timestamps: true },
);

schema.plugin(mongoosePaginate);

schema.index({ processed: 1 });
schema.index({ timeslot: 1 });

const Model = Mongoose.model<ISentiment, Mongoose.PaginateModel<ISentiment>>("Sentiment", schema);

Model.syncIndexes();

export default Model;
