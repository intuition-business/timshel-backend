import { connect } from "mongoose";
import { DB_PASSWORD, DB_USER } from "../../config";
const URI = `mongodb+srv://${DB_USER}:${DB_PASSWORD}@learning.4yxzohu.mongodb.net/timshel`;
const connectionMongo = async () => {
  try {
    await connect(URI);
    console.log(`Connect With Data Base`);
  } catch (error) {
    console.log(`[NOT Connect With Data Base]: ${error}`);
  }
};

export default connectionMongo;
