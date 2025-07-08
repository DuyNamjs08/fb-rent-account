import prisma from '../config/prisma';
class UserService {
  async createUser({
    email,
    password,
    role_id,
    referral_code,
    username,
    phone = '',
    role,
  }: {
    email: string;
    password: string;
    role_id: string;
    referral_code: string;
    username: string;
    phone: string;
    role: string;
  }) {
    const User = await prisma.user.create({
      data: {
        email,
        password,
        role_id,
        role,
        referral_code,
        username,
        phone,
      },
    });
    return User;
  }
  async getUserByReferralCode(code: string) {
    return prisma.user.findUnique({
      where: { referral_code: code },
    });
  }
  async getAllUsers() {
    return await prisma.user.findMany({
      orderBy: {
        created_at: 'desc',
      },
    });
  }
  async getUserById(id: string) {
    const User = await prisma.user.findUnique({
      where: { id },
    });
    return User;
  }
  async getUserByEmail(email: string) {
    console.log('email', email);
    const User = await prisma.user.findUnique({
      where: { email },
    });
    return User;
  }

  async updateUser(id: string, updateData: any) {
    const User = await prisma.user.update({
      where: { id },
      data: updateData,
    });
    return User;
  }

  async deleteUser(id: string) {
    const User = await prisma.user.delete({
      where: { id },
    });
    return User;
  }
  async getUserByRoleId(role_id: string) {
    const User = await prisma.user.findMany({
      where: { role_id },
    });
    return User;
  }
}

export default new UserService();
