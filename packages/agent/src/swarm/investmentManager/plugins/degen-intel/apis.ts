import { Route } from "@elizaos/core";
import DB from "./database";
import {
  SentimentArraySchema,
  TweetArraySchema
} from "./schemas";

export const routes: Route[] = [
  {
    type: "POST",
    path: "/trending",
    handler: async (req: any, res: any) => {
      const data = await DB.Token.find()
        .sort("rank")
        .select("-_id -__v")
        .lean();
      res.json(data);
    },
  },
  {
    type: "POST",
    path: "/wallet",
    handler: async (_req: any, res: any) => {
      const history = await DB.TransactionHistory.find({
        "data.mainAction": "received",
      })
        .limit(100)
        .sort("-blockTime")
        .lean();
      const portfolio = (await DB.Data.findOne({ key: "PORTFOLIO" }).lean())
        ?.data;
      res.json({ history, portfolio });
    },
  },
  {
    type: "GET",
    path: "/tweets",
    handler: async (_req: any, res: any) => {
      try {
        const data = await DB.RawTweet.find()
          .sort("-timestamp")
          .limit(50)
          .select("-_id -__v")
          .lean();

        const validatedData = TweetArraySchema.parse(data);
        res.json(validatedData);
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    },
  },
  {
    type: "GET",
    path: "/sentiment",
    handler: async (_req: any, res: any) => {
      try {
        const data = await DB.Sentiment.find({
          processed: true,
          $expr: {
            $gt: [{ $size: "$occuringTokens" }, 1],
          },
        })
          .limit(30)
          .sort("-timeslot")
          .lean();

        const validatedData = SentimentArraySchema.parse(data);
        res.json(validatedData);
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    },
  },
  {
    type: "POST",
    path: "/signal",
    handler: async (_req: any, res: any) => {
      const signal = await DB.Data.findOne({ key: "BUY_SIGNAL" }).lean();
      res.json(signal?.data || {});
    },
  }
];

export default routes;