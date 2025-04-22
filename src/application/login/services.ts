import { RegisterModel } from "../register/model";

class LoginService {
  constructor() {}

  async findByEmail(email: string) {
    const existingEmailUser = await RegisterModel.findOne({ email });
    return existingEmailUser;
  }

  async findByPhonenumber(phone: string) {
    const existingPhoneUser = await RegisterModel.findOne({ phone });
    return existingPhoneUser;
  }
}

export default LoginService;
