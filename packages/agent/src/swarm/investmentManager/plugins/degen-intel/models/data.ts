// TODO: Store in cache, replace mongoose with cache adapter

import type { IData } from "../types";
import Mongoose, { Schema } from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const schema = new Schema<IData, Mongoose.Model<IData>>(
	{
		key: { type: String },
		data: { type: Object },
	},
	{ timestamps: true },
);

schema.plugin(mongoosePaginate);

schema.index({ key: 1 });

const Model = Mongoose.model<IData, Mongoose.PaginateModel<IData>>("Data", schema);

Model.syncIndexes();

export default Model;
