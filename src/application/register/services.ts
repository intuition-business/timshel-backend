import { RegisterModel } from "./model";
import { IUser } from "./types";

class RegisterService {
  constructor() {}

  async create(data: IUser) {
    const registerModel = new RegisterModel(data);
    const result = await registerModel.save();
    return result;
  }

  async findByEmail(email: string) {
    const existingEmailUser = await RegisterModel.findOne({ email });
    return existingEmailUser;
  }

  async findByPhonenumber(phone: string) {
    const existingPhoneUser = await RegisterModel.findOne({ phone });
    return existingPhoneUser;
  }
}

export default RegisterService;
