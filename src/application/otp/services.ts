import { ObjectId } from "mongoose";
import { OtpModel } from "./model";
import { ICreateOtp } from "./sendOtp/types";

class OtpService {
  constructor() {}

  async create(data: ICreateOtp) {
    const otpModel = new OtpModel(data);
    const result = await otpModel.save();
    return result;
  }

  async findOtpByEmail(email: string) {
    const existingEmailUser = await OtpModel.findOne({ email });
    return existingEmailUser;
  }

  async findOtpByPhonenumber(phone: string) {
    const existingPhoneUser = await OtpModel.findOne({ phone });
    return existingPhoneUser;
  }

  async remove(id: ObjectId | any) {
    await OtpModel.deleteOne({ _id: id });
    return true;
  }
}

export default OtpService;
