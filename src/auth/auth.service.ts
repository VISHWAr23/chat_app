import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../mongo/user.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private normalizeEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  private validateGmail(email: string): void {
    if (!/^[^\s@]+@gmail\.com$/i.test(email)) {
      throw new BadRequestException('Only Gmail addresses are allowed.');
    }
  }

  async signup(email: string, password: string, name?: string) {
    const normalizedEmail = this.normalizeEmail(email);
    this.validateGmail(normalizedEmail);

    const normalizedPassword = (password || '').trim();
    if (!normalizedPassword || normalizedPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters.');
    }

    const existing = await this.userModel.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      throw new ConflictException('User already exists.');
    }

    const passwordHash = await bcrypt.hash(normalizedPassword, 10);
    const saved = await this.userModel.create({
      email: normalizedEmail,
      password: passwordHash,
      name: (name || normalizedEmail.split('@')[0]).trim(),
    });

    return {
      message: 'Signup successful.',
      user: {
        id: saved.email,
        email: saved.email,
        name: saved.name,
      },
    };
  }

  async login(email: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);
    this.validateGmail(normalizedEmail);

    const normalizedPassword = (password || '').trim();
    if (!normalizedPassword) {
      throw new BadRequestException('Password is required.');
    }

    const user = await this.userModel.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (typeof user.password !== 'string' || user.password.length === 0) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const ok = await bcrypt.compare(normalizedPassword, user.password);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return {
      message: 'Login successful.',
      user: {
        id: user.email,
        email: user.email,
        name: user.name,
      },
    };
  }

  async listUsers(excludeEmail?: string) {
    const normalizedExclude = this.normalizeEmail(excludeEmail || '');
    const query = normalizedExclude ? { email: { $ne: normalizedExclude } } : {};

    const users = await this.userModel
      .find(query)
      .select('email name')
      .sort({ name: 1 })
      .lean();

    return {
      users: users.map((u) => ({
        id: u.email,
        email: u.email,
        name: u.name,
      })),
    };
  }
}
