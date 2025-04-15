import { compare, hash } from "bcryptjs";

export const encryptPassword = async (password: string) => {
  const hashing = await hash(password, 10);
  return hashing;
};

export const HashingMatch = async (
  myPassword?: string,
  receivePassword?: string
) => {
  const isMatch =
    receivePassword &&
    myPassword &&
    (await compare(myPassword, receivePassword));

  return isMatch;
};
